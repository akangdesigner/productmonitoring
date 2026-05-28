const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const cron    = require('node-cron');
const path    = require('path');
const fs      = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');

const ACTOR_ID    = '4nhvc7lTKzkDrk7bD';
const BASE_URL    = 'https://api.apify.com/v2';
const SCHED_FILE  = path.join(__dirname, '../db/shopee-keyword-schedule.json');

// ── 排程設定讀寫 ──
function loadSchedule() {
  try {
    return JSON.parse(fs.readFileSync(SCHED_FILE, 'utf8'));
  } catch {
    return { enabled: true, time: '02:00' };
  }
}

function saveSchedule(s) {
  fs.writeFileSync(SCHED_FILE, JSON.stringify(s, null, 2), 'utf8');
}

// ── 動態 cron 管理 ──
let cronTask = null;

function buildCronExpr(time) {
  const [hh, mm] = time.split(':').map(Number);
  return `${mm} ${hh} * * *`;
}

function applySchedule(s) {
  if (cronTask) { cronTask.stop(); cronTask = null; }
  if (!s.enabled) return;
  const expr = buildCronExpr(s.time);
  cronTask = cron.schedule(expr, runAll, { timezone: 'Asia/Taipei' });
  console.log(`[蝦皮排程] 已套用：每天 ${s.time}（${expr}）`);
}

// 啟動時載入排程
applySchedule(loadSchedule());

// ── 呼叫 Apify 搜尋蝦皮 ──
async function fetchShopee(keyword, maxProducts = 30) {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error('後端尚未設定 APIFY_TOKEN');

  const response = await axios.post(
    `${BASE_URL}/acts/${ACTOR_ID}/run-sync-get-dataset-items`,
    {
      country: 'tw',
      keyword: keyword.trim(),
      maxProducts: Number(maxProducts),
      mode: 'keyword',
      sort: 'relevancy',
      fetchDetail: false,
      delay: 1,
    },
    {
      params: { token, clean: true, format: 'json', limit: Number(maxProducts) },
      timeout: 300_000,
      headers: { 'Content-Type': 'application/json' },
    }
  );

  const raw = Array.isArray(response.data) ? response.data : [];
  return raw.map(item => ({
    shop_id:        item.shop_id,
    shop_name:      item.shop_name || item.shopName || item.seller_name || item.seller || null,
    item_id:        item.item_id,
    name:           item.name,
    price:          item.price != null ? Math.round(item.price) : null,
    original_price: item.original_price != null ? Math.round(item.original_price) : null,
    discount_pct:   item.discount_pct,
    rating:         item.rating,
    sold_count:     item.sold_count,
    is_mall:        item.is_mall,
    location:       item.location,
    image_url:      item.image_url,
    url:            item.url,
  }));
}

// ── 執行單一關鍵字並存結果，回傳是否成功 ──
async function runKeyword(kw) {
  const db = getDB();
  try {
    const items = await fetchShopee(kw.keyword, kw.max_products);
    const resultId = uuidv4();
    db.prepare(`
      INSERT INTO shopee_results (id, keyword_id, item_count, items)
      VALUES (?, ?, ?, ?)
    `).run(resultId, kw.id, items.length, JSON.stringify(items));

    db.prepare(`
      UPDATE shopee_keywords
      SET last_run_at = datetime('now','localtime'), item_count = ?
      WHERE id = ?
    `).run(items.length, kw.id);

    // 只保留最近 10 筆結果
    db.prepare(`
      DELETE FROM shopee_results
      WHERE keyword_id = ?
        AND id NOT IN (
          SELECT id FROM shopee_results
          WHERE keyword_id = ?
          ORDER BY run_at DESC
          LIMIT 10
        )
    `).run(kw.id, kw.id);

    console.log(`[蝦皮追蹤] "${kw.keyword}" 完成，${items.length} 筆`);
    return { ok: true, count: items.length };
  } catch (err) {
    console.error(`[蝦皮追蹤] "${kw.keyword}" 失敗：`, err.message);
    return { ok: false, error: err.message };
  }
}

// ── 排程批次執行所有啟用關鍵字 ──
async function runAll() {
  const db = getDB();
  const keywords = db.prepare('SELECT * FROM shopee_keywords WHERE enabled = 1').all();
  console.log(`[蝦皮排程] 開始執行，共 ${keywords.length} 個關鍵字`);
  for (const kw of keywords) {
    await runKeyword(kw);
  }
}

// ═══════════════════════════════════════════════════
// API 路由
// ═══════════════════════════════════════════════════

// ── GET /api/shopee-keywords/schedule ── 取得排程設定
router.get('/schedule', (req, res) => {
  res.json(loadSchedule());
});

// ── PUT /api/shopee-keywords/schedule ── 更新排程設定
router.put('/schedule', (req, res) => {
  const { enabled, time } = req.body;
  if (!time || !/^\d{2}:\d{2}$/.test(time)) {
    return res.status(400).json({ error: '時間格式錯誤，請用 HH:MM' });
  }
  const s = { enabled: !!enabled, time };
  saveSchedule(s);
  applySchedule(s);
  res.json({ ok: true, ...s });
});

// ── GET /api/shopee-keywords ── 取得所有追蹤關鍵字
router.get('/', (req, res) => {
  const db = getDB();
  const rows = db.prepare('SELECT * FROM shopee_keywords ORDER BY created_at DESC').all();
  res.json(rows);
});

// ── POST /api/shopee-keywords ── 新增關鍵字（可附帶初始結果一起存入）
router.post('/', (req, res) => {
  const { keyword, max_products = 30, initial_items } = req.body;
  if (!keyword?.trim()) return res.status(400).json({ error: '請提供關鍵字' });

  const db = getDB();
  const existing = db.prepare('SELECT id FROM shopee_keywords WHERE keyword = ?').get(keyword.trim());
  if (existing) return res.status(409).json({ error: '此關鍵字已在追蹤清單中' });

  const id = uuidv4();

  db.transaction(() => {
    const items = Array.isArray(initial_items) ? initial_items : [];
    const count = items.length;

    db.prepare(`
      INSERT INTO shopee_keywords (id, keyword, max_products, last_run_at, item_count)
      VALUES (?, ?, ?, ${count > 0 ? "datetime('now','localtime')" : 'NULL'}, ?)
    `).run(id, keyword.trim(), Number(max_products), count);

    if (count > 0) {
      db.prepare(`
        INSERT INTO shopee_results (id, keyword_id, item_count, items)
        VALUES (?, ?, ?, ?)
      `).run(uuidv4(), id, count, JSON.stringify(items));
    }
  })();

  res.json({ ok: true, id });
});

// ── DELETE /api/shopee-keywords/:id ── 刪除關鍵字
router.delete('/:id', (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM shopee_keywords WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── PATCH /api/shopee-keywords/:id ── 更新關鍵字設定（enabled / max_products）
router.patch('/:id', (req, res) => {
  const { enabled, max_products } = req.body;
  const db = getDB();
  if (enabled !== undefined) {
    db.prepare('UPDATE shopee_keywords SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, req.params.id);
  }
  if (max_products !== undefined) {
    const n = Math.max(1, Math.min(100, Number(max_products) || 30));
    db.prepare('UPDATE shopee_keywords SET max_products = ? WHERE id = ?').run(n, req.params.id);
  }
  res.json({ ok: true });
});

// ── POST /api/shopee-keywords/:id/run ── 手動立即執行（等待結果回傳）
router.post('/:id/run', async (req, res) => {
  const db = getDB();
  const kw = db.prepare('SELECT * FROM shopee_keywords WHERE id = ?').get(req.params.id);
  if (!kw) return res.status(404).json({ error: '找不到此關鍵字' });

  const result = await runKeyword(kw);
  if (result.ok) {
    res.json({ ok: true, count: result.count });
  } else {
    res.status(500).json({ error: result.error });
  }
});

// ── GET /api/shopee-keywords/:id/results ── 取得最新一次搜尋結果
router.get('/:id/results', (req, res) => {
  const db = getDB();
  const row = db.prepare(`
    SELECT * FROM shopee_results
    WHERE keyword_id = ?
    ORDER BY run_at DESC
    LIMIT 1
  `).get(req.params.id);

  if (!row) return res.json({ items: [], run_at: null });

  res.json({
    run_at:     row.run_at,
    item_count: row.item_count,
    items:      JSON.parse(row.items || '[]'),
  });
});

module.exports = router;
