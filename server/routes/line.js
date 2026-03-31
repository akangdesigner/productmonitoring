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
    const { token, userId } = req.body;
    await LineService.testConnection(token, userId);
    res.json({ ok: true, message: '測試訊息已發送' });
  } catch (err) {
    res.status(400).json({ error: `LINE 連線失敗：${err.message}` });
  }
});

// POST /api/line/webhook — LINE Bot Webhook
router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  // 簡易 Webhook 接收（可依需求擴充互動功能）
  res.sendStatus(200);
});

module.exports = router;
