const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const LineService = require('../services/LineService');

// GET /api/line/settings
router.get('/settings', (req, res) => {
  const db = getDB();
  const s = db.prepare('SELECT * FROM line_settings WHERE id = 1').get();
  // 隱藏敏感 token，只回傳是否已設定
  res.json({
    ...s,
    channel_access_token: s.channel_access_token ? '••••••••' : '',
    channel_secret:       s.channel_secret        ? '••••••••' : '',
    hasToken:             !!s.channel_access_token,
    hasSecret:            !!s.channel_secret,
  });
});

// PUT /api/line/settings
router.put('/settings', (req, res) => {
  const db = getDB();
  const {
    channel_access_token, channel_secret, user_id,
    notify_price_drop, notify_gift_change,
    price_drop_threshold, daily_report_enabled, daily_report_time,
  } = req.body;

  // 只更新有傳入的欄位（token 前綴 •• 表示未變更）
  const current = db.prepare('SELECT * FROM line_settings WHERE id = 1').get();
  db.prepare(`
    UPDATE line_settings SET
      channel_access_token  = ?,
      channel_secret        = ?,
      user_id               = ?,
      notify_price_drop     = ?,
      notify_gift_change    = ?,
      price_drop_threshold  = ?,
      daily_report_enabled  = ?,
      daily_report_time     = ?,
      updated_at            = datetime('now','localtime')
    WHERE id = 1
  `).run(
    channel_access_token?.startsWith('••') ? current.channel_access_token : (channel_access_token || ''),
    channel_secret?.startsWith('••')       ? current.channel_secret       : (channel_secret || ''),
    user_id               ?? current.user_id,
    notify_price_drop     ?? current.notify_price_drop,
    notify_gift_change    ?? current.notify_gift_change,
    price_drop_threshold  ?? current.price_drop_threshold,
    daily_report_enabled  ?? current.daily_report_enabled,
    daily_report_time     ?? current.daily_report_time,
  );

  res.json({ ok: true });
});

// POST /api/line/test
router.post('/test', async (req, res) => {
  try {
    const db = getDB();
    const s = db.prepare('SELECT channel_access_token, user_id FROM line_settings WHERE id = 1').get();
    const { token: bodyToken, userId: bodyUserId } = req.body;

    // 優先用 env，再用 body（若非遮罩值），最後才用 DB
    const token  = process.env.LINE_CHANNEL_ACCESS_TOKEN
      || (!bodyToken?.startsWith('••') ? bodyToken : null)
      || s?.channel_access_token || '';
    const userId = process.env.LINE_USER_ID
      || bodyUserId
      || s?.user_id || '';

    if (!token)  return res.status(400).json({ error: '尚未設定 LINE Channel Access Token' });
    if (!userId) return res.status(400).json({ error: '尚未設定推播目標 User ID' });

    await LineService.testConnection(token, userId);
    res.json({ ok: true, message: '測試訊息已發送' });
  } catch (err) {
    const detail = err.originalError?.response?.data || err.response?.data || err.message;
    console.error('[LINE test]', JSON.stringify(detail));
    res.status(400).json({ error: `LINE 連線失敗：${JSON.stringify(detail)}` });
  }
});

// POST /api/line/report/gaps — 手動發送價差報告
router.post('/report/gaps', async (req, res) => {
  try {
    const db = getDB();
    const rows = db.prepare(`
      WITH latest AS (
        SELECT pr.product_id, pr.platform, pr.price,
          ROW_NUMBER() OVER (PARTITION BY pr.product_id, pr.platform ORDER BY pr.scraped_at DESC) rn
        FROM price_records pr
        JOIN products p ON p.id = pr.product_id WHERE p.is_active = 1
          AND pr.platform IN ('watsons','cosmed','poya')
      )
      SELECT p.id, p.name, p.brand,
        MAX(CASE WHEN l.platform='watsons' THEN l.price END) AS watsons,
        MAX(CASE WHEN l.platform='cosmed'  THEN l.price END) AS cosmed,
        MAX(CASE WHEN l.platform='poya'    THEN l.price END) AS poya
      FROM products p
      LEFT JOIN latest l ON l.product_id = p.id AND l.rn = 1
      WHERE p.is_active = 1
      GROUP BY p.id
    `).all();

    const gaps = rows.map(r => {
      const prices = [r.watsons, r.cosmed, r.poya].filter(v => v > 0);
      if (prices.length < 2) return null;
      const min = Math.min(...prices), max = Math.max(...prices);
      if (max - min <= 0) return null;
      return { ...r, min, max, gap: max - min };
    }).filter(Boolean).sort((a, b) => b.gap - a.gap).slice(0, 10);

    if (gaps.length === 0) return res.status(400).json({ error: '目前無跨平台價差資料' });

    await LineService.sendGapReport(gaps);
    res.json({ ok: true, count: gaps.length });
  } catch (err) {
    const detail = err.originalError?.response?.data || err.message;
    res.status(400).json({ error: `發送失敗：${JSON.stringify(detail)}` });
  }
});

// POST /api/line/webhook — LINE Bot Webhook
router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  // 簡易 Webhook 接收（可依需求擴充互動功能）
  res.sendStatus(200);
});

module.exports = router;
