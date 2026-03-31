const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');

// GET /api/products
router.get('/', (req, res) => {
  const db = getDB();
  const products = db.prepare('SELECT * FROM products WHERE is_active = 1 ORDER BY brand, name').all();
  const result = products.map(p => ({
    ...p,
    urls: db.prepare('SELECT * FROM product_urls WHERE product_id = ?').all(p.id),
  }));
  res.json(result);
});

// POST /api/products
router.post('/', (req, res) => {
  const db = getDB();
  const { name, brand, category = 'skincare', emoji = '✨', urls = [] } = req.body;
  if (!name) return res.status(400).json({ error: '商品名稱為必填' });

  const id = uuidv4();
  db.prepare('INSERT INTO products (id, name, brand, category, emoji) VALUES (?, ?, ?, ?, ?)').run(id, name, brand, category, emoji);

  urls.forEach(({ platform, url, platform_sku }) => {
    db.prepare('INSERT INTO product_urls (id, product_id, platform, url, platform_sku) VALUES (?, ?, ?, ?, ?)').run(uuidv4(), id, platform, url, platform_sku || null);
  });

  res.status(201).json({ id, name, brand, category });
});

// PUT /api/products/:id
router.put('/:id', (req, res) => {
  const db = getDB();
  const { name, brand, category, emoji } = req.body;
  db.prepare('UPDATE products SET name=?, brand=?, category=?, emoji=?, updated_at=datetime(\'now\',\'localtime\') WHERE id=?').run(name, brand, category, emoji, req.params.id);
  res.json({ ok: true });
});

// DELETE /api/products/:id
router.delete('/:id', (req, res) => {
  const db = getDB();
  db.prepare('UPDATE products SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
