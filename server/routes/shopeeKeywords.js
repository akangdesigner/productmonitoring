const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const cron    = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');

const ACTOR_ID = '4nhvc7lTKzkDrk7bD';
const BASE_URL = 'https://api.apify.com/v2';

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
      params: { token, clean: true, format: 'json' },
      timeout: 300_000,
      headers: { 'Content-Type': 'application/json' },
    }
  );

  const raw = Array.isArray(response.data) ? response.data : [];
  return raw.map(item => ({
    shop_id:        item.shop_id,
    item_id:        item.item_id,
    name:           item.name,
    price:          item.price != null ? Math.round(item.price / 100) : null,
    original_price: item.original_price != null ? Math.round(item.original_price / 100) : null,
    discount_pct:   item.discount_pct,
    rating:         item.rating,
    sold_count:     item.sold_count,
    is_mall:        item.is_mall,
    location:       item.location,
    image_url:      item.image_url,
    url:            item.url,
  }));
}

// ── 執行單一關鍵字並存結果 ──
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
  } catch (err) {
    console.error(`[蝦皮追蹤] "${kw.keyword}" 失敗：`, err.message);
  }
}

// ── 獨立排程：每天凌晨 2:00 執行所有已啟用關鍵字 ──
cron.schedule('0 2 * * *', async () => {
  const db = getDB();
  const keywords = db.prepare(`
    SELECT * FROM shopee_keywords WHERE enabled = 1 AND schedule_type = 'daily'
  `).all();
  console.log(`[蝦皮排程] 開始執行，共 ${keywords.length} 個關鍵字`);
  for (const kw of keywords) {
    await runKeyword(kw);
  }
}, { timezone: 'Asia/Taipei' });

// ── GET /api/shopee-keywords ── 取得所有追蹤關鍵字
router.get('/', (req, res) => {
  const db = getDB();
  const rows = db.prepare(`
    SELECT * FROM shopee_keywords ORDER BY created_at DESC
  `).all();
  res.json(rows);
});

// ── POST /api/shopee-keywords ── 新增關鍵字
router.post('/', (req, res) => {
  const { keyword, max_products = 30, schedule_type = 'daily' } = req.body;
  if (!keyword?.trim()) return res.status(400).json({ error: '請提供關鍵字' });

  const db = getDB();
  const existing = db.prepare('SELECT id FROM shopee_keywords WHERE keyword = ?').get(keyword.trim());
  if (existing) return res.status(409).json({ error: '此關鍵字已在追蹤清單中' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO shopee_keywords (id, keyword, max_products, schedule_type)
    VALUES (?, ?, ?, ?)
  `).run(id, keyword.trim(), Number(max_products), schedule_type);

  res.json({ ok: true, id });
});

// ── DELETE /api/shopee-keywords/:id ── 刪除關鍵字
router.delete('/:id', (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM shopee_keywords WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── PATCH /api/shopee-keywords/:id ── 切換啟用狀態
router.patch('/:id', (req, res) => {
  const { enabled } = req.body;
  if (enabled === undefined) return res.status(400).json({ error: '請提供 enabled' });
  const db = getDB();
  db.prepare('UPDATE shopee_keywords SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

// ── POST /api/shopee-keywords/:id/run ── 手動立即執行
router.post('/:id/run', async (req, res) => {
  const db = getDB();
  const kw = db.prepare('SELECT * FROM shopee_keywords WHERE id = ?').get(req.params.id);
  if (!kw) return res.status(404).json({ error: '找不到此關鍵字' });

  res.json({ ok: true, message: '已開始執行，請稍候' });
  runKeyword(kw); // 非同步執行，不等結果
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
