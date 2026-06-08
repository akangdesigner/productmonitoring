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
const DB_DIR      = path.join(__dirname, '../db');

// ── 排程設定讀寫（per-user）──
function schedFile(userId) { return path.join(DB_DIR, `shopee-keyword-schedule-${userId}.json`); }
function loadSchedule(userId) {
  try { return JSON.parse(fs.readFileSync(schedFile(userId), 'utf8')); }
  catch { return { enabled: true, time: '02:00' }; }
}
function saveSchedule(s, userId) {
  fs.writeFileSync(schedFile(userId), JSON.stringify(s, null, 2), 'utf8');
}

// ── 動態 cron 管理（Map<userId, cronTask>）──
const cronTasks = new Map();

function buildCronExpr(time) {
  const [hh, mm] = time.split(':').map(Number);
  return `${mm} ${hh} * * *`;
}

function applySchedule(s, userId) {
  if (cronTasks.has(userId)) { cronTasks.get(userId).stop(); cronTasks.delete(userId); }
  if (!s.enabled) return;
  const task = cron.schedule(buildCronExpr(s.time), () => runAll(userId), { timezone: 'Asia/Taipei' });
  cronTasks.set(userId, task);
  console.log(`[蝦皮排程:${userId.slice(0,8)}] 已套用：每天 ${s.time}`);
}

// 啟動時載入所有使用者的排程
function loadAllSchedules() {
  try {
    const files = fs.readdirSync(DB_DIR).filter(f => /^shopee-keyword-schedule-.+\.json$/.test(f));
    for (const f of files) {
      const userId = f.replace('shopee-keyword-schedule-', '').replace('.json', '');
      applySchedule(loadSchedule(userId), userId);
    }
  } catch {}
}
loadAllSchedules();

// ── 查蝦皮商家資訊 ──
async function fetchShopInfo(shopId) {
  try {
    const res = await axios.get(
      `https://shopee.tw/api/v4/shop/get_shop_detail?shopid=${shopId}&limit=1`,
      { headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://shopee.tw/',
        'Accept': 'application/json',
      }, timeout: 8000 }
    );
    const d = res.data?.data;
    if (!d) return null;
    return { name: d.name || null, is_official: !!d.is_official_shop };
  } catch { return null; }
}

// ── 呼叫 Apify 搜尋蝦皮 ──
async function fetchShopee(keyword, maxProducts = 30) {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error('後端尚未設定 APIFY_TOKEN');
  let response;
  try {
    response = await axios.post(
      `${BASE_URL}/acts/${ACTOR_ID}/run-sync-get-dataset-items`,
      { country: 'tw', keyword: keyword.trim(), maxProducts: Number(maxProducts) },
      { params: { token, clean: true, format: 'json', limit: Number(maxProducts) }, timeout: 300_000, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    console.error(`[Apify 403 detail] status=${err.response?.status} body=${detail}`);
    throw new Error(`Apify 錯誤 ${err.response?.status ?? ''}：${detail}`);
  }
  const raw = Array.isArray(response.data) ? response.data : [];
  const items = raw.map(item => ({
    shop_id: item.shop_id, shop_name: item.shop_name || item.shopName || item.seller_name || item.seller || null,
    item_id: item.item_id, name: item.name,
    price: item.price != null ? Math.round(item.price) : null,
    original_price: item.original_price != null ? Math.round(item.original_price) : null,
    discount_pct: item.discount_pct, rating: item.rating, sold_count: item.sold_count,
    is_mall: item.is_mall, location: item.location, image_url: item.image_url, url: item.url,
  }));
  const shopIds = [...new Set(items.map(i => i.shop_id).filter(Boolean))];
  const shopMap = {};
  for (const sid of shopIds) {
    const info = await fetchShopInfo(sid);
    if (info) shopMap[sid] = info;
    await new Promise(r => setTimeout(r, 200));
  }
  return items.map(item => ({
    ...item,
    shop_name: shopMap[item.shop_id]?.name ?? item.shop_name,
    is_mall:   shopMap[item.shop_id]?.is_official ?? item.is_mall,
  }));
}

// ── 執行單一關鍵字 ──
async function runKeyword(kw) {
  const db = getDB();
  try {
    const items = await fetchShopee(kw.keyword, kw.max_products);
    const resultId = uuidv4();
    db.prepare('INSERT INTO shopee_results (id, keyword_id, item_count, items) VALUES (?, ?, ?, ?)').run(resultId, kw.id, items.length, JSON.stringify(items));
    db.prepare("UPDATE shopee_keywords SET last_run_at = datetime('now','localtime'), item_count = ? WHERE id = ?").run(items.length, kw.id);
    db.prepare('DELETE FROM shopee_results WHERE keyword_id = ? AND id NOT IN (SELECT id FROM shopee_results WHERE keyword_id = ? ORDER BY run_at DESC LIMIT 10)').run(kw.id, kw.id);
    console.log(`[蝦皮追蹤] "${kw.keyword}" 完成，${items.length} 筆`);
    return { ok: true, count: items.length };
  } catch (err) {
    console.error(`[蝦皮追蹤] "${kw.keyword}" 失敗：`, err.message);
    return { ok: false, error: err.message };
  }
}

// ── 排程批次執行（per-user）──
async function runAll(userId) {
  const db = getDB();
  const keywords = db.prepare('SELECT * FROM shopee_keywords WHERE enabled = 1 AND user_id = ?').all(userId);
  console.log(`[蝦皮排程:${userId.slice(0,8)}] 共 ${keywords.length} 個關鍵字`);
  for (const kw of keywords) await runKeyword(kw);
}

// ═══════════════════════════════════════════════════
// API 路由
// ═══════════════════════════════════════════════════

// GET /api/shopee-keywords/schedule
router.get('/schedule', (req, res) => res.json(loadSchedule(req.user.sub)));

// PUT /api/shopee-keywords/schedule
router.put('/schedule', (req, res) => {
  const { enabled, time } = req.body;
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return res.status(400).json({ error: '時間格式錯誤，請用 HH:MM' });
  const s = { enabled: !!enabled, time };
  saveSchedule(s, req.user.sub);
  applySchedule(s, req.user.sub);
  res.json({ ok: true, ...s });
});

// GET /api/shopee-keywords
router.get('/', (req, res) => {
  const rows = getDB().prepare('SELECT * FROM shopee_keywords WHERE user_id = ? ORDER BY created_at DESC').all(req.user.sub);
  res.json(rows);
});

// POST /api/shopee-keywords
router.post('/', (req, res) => {
  const { keyword, max_products = 30, initial_items } = req.body;
  if (!keyword?.trim()) return res.status(400).json({ error: '請提供關鍵字' });
  const db = getDB();
  const uid = req.user.sub;
  const existing = db.prepare('SELECT id FROM shopee_keywords WHERE keyword = ? AND user_id = ?').get(keyword.trim(), uid);
  if (existing) return res.status(409).json({ error: '此關鍵字已在追蹤清單中' });
  const id = uuidv4();
  db.transaction(() => {
    const items = Array.isArray(initial_items) ? initial_items : [];
    const count = items.length;
    db.prepare(`
      INSERT INTO shopee_keywords (id, user_id, keyword, max_products, last_run_at, item_count)
      VALUES (?, ?, ?, ?, ${count > 0 ? "datetime('now','localtime')" : 'NULL'}, ?)
    `).run(id, uid, keyword.trim(), Number(max_products), count);
    if (count > 0) {
      db.prepare('INSERT INTO shopee_results (id, keyword_id, item_count, items) VALUES (?, ?, ?, ?)').run(uuidv4(), id, count, JSON.stringify(items));
    }
  })();
  res.json({ ok: true, id });
});

// DELETE /api/shopee-keywords/:id
router.delete('/:id', (req, res) => {
  getDB().prepare('DELETE FROM shopee_keywords WHERE id = ? AND user_id = ?').run(req.params.id, req.user.sub);
  res.json({ ok: true });
});

// PATCH /api/shopee-keywords/:id
router.patch('/:id', (req, res) => {
  const { enabled, max_products } = req.body;
  const db = getDB();
  const uid = req.user.sub;
  if (enabled !== undefined) db.prepare('UPDATE shopee_keywords SET enabled = ? WHERE id = ? AND user_id = ?').run(enabled ? 1 : 0, req.params.id, uid);
  if (max_products !== undefined) {
    const n = Math.max(1, Math.min(100, Number(max_products) || 30));
    db.prepare('UPDATE shopee_keywords SET max_products = ? WHERE id = ? AND user_id = ?').run(n, req.params.id, uid);
  }
  res.json({ ok: true });
});

// POST /api/shopee-keywords/:id/run
router.post('/:id/run', async (req, res) => {
  const kw = getDB().prepare('SELECT * FROM shopee_keywords WHERE id = ? AND user_id = ?').get(req.params.id, req.user.sub);
  if (!kw) return res.status(404).json({ error: '找不到此關鍵字' });
  const result = await runKeyword(kw);
  result.ok ? res.json({ ok: true, count: result.count }) : res.status(500).json({ error: result.error });
});

// GET /api/shopee-keywords/:id/results
router.get('/:id/results', (req, res) => {
  const kw = getDB().prepare('SELECT id FROM shopee_keywords WHERE id = ? AND user_id = ?').get(req.params.id, req.user.sub);
  if (!kw) return res.status(404).json({ error: '找不到此關鍵字' });
  const row = getDB().prepare('SELECT * FROM shopee_results WHERE keyword_id = ? ORDER BY run_at DESC LIMIT 1').get(req.params.id);
  if (!row) return res.json({ items: [], run_at: null });
  res.json({ run_at: row.run_at, item_count: row.item_count, items: JSON.parse(row.items || '[]') });
});

module.exports = router;
