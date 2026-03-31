const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

// GET /api/gifts
router.get('/', (req, res) => {
  const db = getDB();
  const { productId, platform } = req.query;
  let q = 'SELECT gr.*, p.name, p.brand FROM gift_records gr JOIN products p ON p.id = gr.product_id WHERE 1=1';
  const params = [];
  if (productId) { q += ' AND gr.product_id = ?'; params.push(productId); }
  if (platform)  { q += ' AND gr.platform = ?';   params.push(platform); }
  q += ' ORDER BY gr.scraped_at DESC';
  res.json(db.prepare(q).all(...params));
});

// GET /api/gifts/latest — 目前有效贈品
router.get('/latest', (req, res) => {
  const db = getDB();
  res.json(db.prepare(`
    SELECT gr.*, p.name, p.brand
    FROM gift_records gr
    JOIN products p ON p.id = gr.product_id
    WHERE gr.is_active = 1 AND p.is_active = 1
    ORDER BY gr.scraped_at DESC
  `).all());
});

// GET /api/gifts/changes — 最近贈品變動
router.get('/changes', (req, res) => {
  const db = getDB();
  res.json(db.prepare(`
    SELECT a.*, p.name, p.brand
    FROM alerts a
    LEFT JOIN products p ON p.id = a.product_id
    WHERE a.type IN ('gift_added','gift_removed')
    ORDER BY a.created_at DESC LIMIT 50
  `).all());
});

module.exports = router;
