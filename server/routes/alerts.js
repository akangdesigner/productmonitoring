const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

// GET /api/alerts
router.get('/', (req, res) => {
  const db = getDB();
  const { type, read, limit = 50 } = req.query;

  let query = 'SELECT a.*, p.name as product_name, p.brand FROM alerts a LEFT JOIN products p ON p.id = a.product_id WHERE 1=1';
  const params = [];

  if (type)        { query += ' AND a.type = ?';    params.push(type); }
  if (read === 'false') { query += ' AND a.is_read = 0'; }

  query += ' ORDER BY a.created_at DESC LIMIT ?';
  params.push(parseInt(limit));

  res.json(db.prepare(query).all(...params));
});

// GET /api/alerts/gaps?page=1&limit=20
// 同商品跨平台只要有價差（max-min > 0）就列出
router.get('/gaps', (req, res) => {
  const db = getDB();
  const page = Math.max(1, parseInt(req.query.page || 1, 10));
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || 20, 10)));
  const offset = (page - 1) * limit;

  const rows = db.prepare(`
    WITH latest AS (
      SELECT
        pr.product_id,
        pr.platform,
        pr.price,
        pr.scraped_at,
        ROW_NUMBER() OVER (
          PARTITION BY pr.product_id, pr.platform
          ORDER BY pr.scraped_at DESC
        ) rn
      FROM price_records pr
      JOIN products p ON p.id = pr.product_id
      WHERE p.is_active = 1
        AND pr.platform IN ('watsons','cosmed','poya')
    )
    SELECT
      COALESCE(p.base_name, p.name) AS group_key,
      COALESCE(p.base_name, p.name) AS product_name,
      MIN(p.brand) AS brand,
      MAX(CASE WHEN l.platform='watsons' THEN l.price END) AS watsons_price,
      MAX(CASE WHEN l.platform='cosmed'  THEN l.price END) AS cosmed_price,
      MAX(CASE WHEN l.platform='poya'    THEN l.price END) AS poya_price,
      MAX(CASE WHEN l.platform='watsons' THEN l.scraped_at END) AS watsons_at,
      MAX(CASE WHEN l.platform='cosmed'  THEN l.scraped_at END) AS cosmed_at,
      MAX(CASE WHEN l.platform='poya'    THEN l.scraped_at END) AS poya_at
    FROM products p
    LEFT JOIN latest l ON l.product_id = p.id AND l.rn = 1
    WHERE p.is_active = 1
    GROUP BY COALESCE(p.base_name, p.name)
  `).all();

  const gapRows = rows
    .map(r => {
      const prices = [r.watsons_price, r.cosmed_price, r.poya_price]
        .filter(v => typeof v === 'number' && v > 0);
      if (prices.length < 2) return null;

      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const gap = maxPrice - minPrice;
      if (gap <= 0) return null;

      const latestAt = [r.watsons_at, r.cosmed_at, r.poya_at]
        .filter(Boolean)
        .sort()
        .slice(-1)[0] || null;

      return {
        product_id: r.group_key,
        product_name: r.product_name,
        brand: r.brand,
        watsons_price: r.watsons_price ?? null,
        cosmed_price: r.cosmed_price ?? null,
        poya_price: r.poya_price ?? null,
        min_price: minPrice,
        max_price: maxPrice,
        gap,
        latest_at: latestAt,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.gap - a.gap);

  const total = gapRows.length;
  const items = gapRows.slice(offset, offset + limit);

  res.json({
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    items,
  });
});

// PUT /api/alerts/:id/read
router.put('/:id/read', (req, res) => {
  const db = getDB();
  db.prepare('UPDATE alerts SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// PUT /api/alerts/read-all
router.put('/read-all', (req, res) => {
  const db = getDB();
  const result = db.prepare('UPDATE alerts SET is_read = 1 WHERE is_read = 0').run();
  res.json({ updated: result.changes });
});

// DELETE /api/alerts/:id
router.delete('/:id', (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM alerts WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
