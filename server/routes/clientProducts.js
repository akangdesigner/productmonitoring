const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');

// GET /api/my-products
router.get('/', (req, res) => {
  const rows = getDB().prepare('SELECT * FROM client_products WHERE is_active = 1 ORDER BY created_at DESC').all();
  res.json(rows);
});

// POST /api/my-products
router.post('/', (req, res) => {
  const { name, brand, category = 'skincare', image_url, price, note } = req.body;
  if (!name) return res.status(400).json({ error: '商品名稱為必填' });
  const id = uuidv4();
  getDB().prepare(`
    INSERT INTO client_products (id, name, brand, category, image_url, price, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, brand || null, category, image_url || null, price || null, note || null);
  res.status(201).json({ id, name, brand, category, image_url, price, note });
});

// PATCH /api/my-products/:id
router.patch('/:id', (req, res) => {
  const db = getDB();
  const p = db.prepare('SELECT * FROM client_products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: '找不到商品' });
  const { name, brand, category, image_url, price, note } = req.body;
  db.prepare(`
    UPDATE client_products SET
      name = ?, brand = ?, category = ?, image_url = ?, price = ?, note = ?,
      updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(
    name      ?? p.name,
    brand     !== undefined ? (brand || null)     : p.brand,
    category  ?? p.category,
    image_url !== undefined ? (image_url || null) : p.image_url,
    price     !== undefined ? (price || null)     : p.price,
    note      !== undefined ? (note || null)      : p.note,
    req.params.id
  );
  res.json({ ok: true });
});

// DELETE /api/my-products/all
router.delete('/all', (req, res) => {
  const result = getDB().prepare('UPDATE client_products SET is_active = 0 WHERE is_active = 1').run();
  res.json({ ok: true, deleted: result.changes });
});

// DELETE /api/my-products/:id
router.delete('/:id', (req, res) => {
  getDB().prepare('UPDATE client_products SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
