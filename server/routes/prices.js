const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

// GET /api/prices?productId=&platform=&days=30
router.get('/', (req, res) => {
  const db = getDB();
  const { productId, platform, days = 30 } = req.query;
  let q = `SELECT * FROM price_records WHERE scraped_at >= datetime('now', '-${parseInt(days)} days', 'localtime')`;
  const params = [];
  if (productId) { q += ' AND product_id = ?'; params.push(productId); }
  if (platform)  { q += ' AND platform = ?';   params.push(platform); }
  q += ' ORDER BY scraped_at DESC';
  res.json(db.prepare(q).all(...params));
});

// GET /api/prices/latest
router.get('/latest', (req, res) => {
  const db = getDB();
  const rows = db.prepare(`
    SELECT pr.*, p.name, p.brand
    FROM price_records pr
    JOIN products p ON p.id = pr.product_id
    WHERE pr.scraped_at = (
      SELECT MAX(scraped_at) FROM price_records
      WHERE product_id = pr.product_id AND platform = pr.platform
    ) AND p.is_active = 1
    ORDER BY p.brand, p.name
  `).all();
  res.json(rows);
});

// GET /api/prices/trend/:productId
router.get('/trend/:productId', (req, res) => {
  const db = getDB();
  const { productId } = req.params;
  const { days = 30 } = req.query;

  const rows = db.prepare(`
    SELECT platform,
      date(scraped_at) as date,
      MIN(price) as min_price,
      AVG(price) as avg_price
    FROM price_records
    WHERE product_id = ? AND scraped_at >= datetime('now', '-${parseInt(days)} days', 'localtime')
    GROUP BY platform, date(scraped_at)
    ORDER BY date ASC
  `).all(productId);

  // 轉換為前端 Chart.js 格式
  const platforms = ['watsons', 'cosmed', 'poya'];
  const result = {};
  platforms.forEach(pf => {
    result[pf] = rows.filter(r => r.platform === pf).map(r => ({ date: r.date, price: r.min_price }));
  });

  res.json(result);
});

module.exports = router;
