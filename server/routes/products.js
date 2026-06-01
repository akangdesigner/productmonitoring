const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');
const fs   = require('fs');
const path = require('path');

function ownBrandsFile(userId) {
  return path.join(__dirname, `../db/own-brands-${userId}.json`);
}
function loadOwnBrands(userId) {
  try { return JSON.parse(fs.readFileSync(ownBrandsFile(userId), 'utf8')); } catch { return []; }
}
function saveOwnBrands(brands, userId) {
  fs.writeFileSync(ownBrandsFile(userId), JSON.stringify(brands));
}

// GET /api/products/own-brands
router.get('/own-brands', (req, res) => res.json(loadOwnBrands(req.user.sub)));

// PUT /api/products/own-brands
router.put('/own-brands', (req, res) => {
  const brands = (req.body.brands || []).map(b => b.trim()).filter(Boolean);
  saveOwnBrands(brands, req.user.sub);
  res.json({ ok: true, brands });
});

// GET /api/products
router.get('/', (req, res) => {
  const db = getDB();
  const uid = req.user.sub;
  const products = db.prepare('SELECT * FROM products WHERE is_active = 1 AND user_id = ? ORDER BY brand, name').all(uid);
  const result = products.map(p => ({
    ...p,
    urls: db.prepare('SELECT * FROM product_urls WHERE product_id = ?').all(p.id),
  }));
  res.json(result);
});

// POST /api/products
router.post('/', (req, res) => {
  const db = getDB();
  const uid = req.user.sub;
  const { name, brand, category = 'skincare', emoji = '✨', urls = [] } = req.body;
  if (!name) return res.status(400).json({ error: '商品名稱為必填' });

  const id = uuidv4();
  db.prepare('INSERT INTO products (id, user_id, name, brand, category, emoji) VALUES (?, ?, ?, ?, ?, ?)').run(id, uid, name, brand, category, emoji);

  urls.forEach(({ platform, url, platform_sku }) => {
    db.prepare('INSERT INTO product_urls (id, product_id, platform, url, platform_sku) VALUES (?, ?, ?, ?, ?)').run(uuidv4(), id, platform, url, platform_sku || null);
  });

  res.status(201).json({ id, name, brand, category });
});

// PUT /api/products/:id
router.put('/:id', (req, res) => {
  const db = getDB();
  const { name, brand, category, emoji } = req.body;
  db.prepare("UPDATE products SET name=?, brand=?, category=?, emoji=?, updated_at=datetime('now','localtime') WHERE id=? AND user_id=?").run(name, brand, category, emoji, req.params.id, req.user.sub);
  res.json({ ok: true });
});

// PATCH /api/products/:id
router.patch('/:id', (req, res) => {
  const db = getDB();
  const uid = req.user.sub;
  const { name, brand, base_name, category, emoji, image_url, own_price } = req.body;
  const p = db.prepare('SELECT * FROM products WHERE id = ? AND user_id = ?').get(req.params.id, uid);
  if (!p) return res.status(404).json({ error: '找不到商品' });
  db.prepare(`
    UPDATE products SET
      name       = ?,
      brand      = ?,
      base_name  = ?,
      category   = ?,
      emoji      = ?,
      image_url  = ?,
      own_price  = ?,
      updated_at = datetime('now','localtime')
    WHERE id = ? AND user_id = ?
  `).run(
    name      ?? p.name,
    brand     ?? p.brand,
    base_name ?? p.base_name,
    category  ?? p.category,
    emoji     ?? p.emoji,
    image_url !== undefined ? (image_url || null) : p.image_url,
    own_price !== undefined ? (own_price  || null) : p.own_price,
    req.params.id, uid
  );
  res.json({ ok: true });
});

// PATCH /api/products/:id/star
router.patch('/:id/star', (req, res) => {
  const db = getDB();
  const uid = req.user.sub;
  const p = db.prepare('SELECT is_starred FROM products WHERE id = ? AND user_id = ?').get(req.params.id, uid);
  if (!p) return res.status(404).json({ error: '找不到商品' });
  const next = p.is_starred ? 0 : 1;
  db.prepare('UPDATE products SET is_starred = ? WHERE id = ? AND user_id = ?').run(next, req.params.id, uid);
  res.json({ ok: true, is_starred: next });
});

// DELETE /api/products/all
router.delete('/all', (req, res) => {
  const db = getDB();
  const uid = req.user.sub;
  const ids = db.prepare('SELECT id FROM products WHERE user_id = ?').all(uid).map(r => r.id);
  if (ids.length > 0) {
    const ph = ids.map(() => '?').join(',');
    db.prepare(`DELETE FROM price_records WHERE product_id IN (${ph})`).run(...ids);
    db.prepare(`DELETE FROM product_urls WHERE product_id IN (${ph})`).run(...ids);
  }
  const result = db.prepare('DELETE FROM products WHERE user_id = ?').run(uid);
  res.json({ ok: true, deleted: result.changes });
});

// DELETE /api/products/:id
router.delete('/:id', (req, res) => {
  const db = getDB();
  db.prepare('UPDATE products SET is_active = 0 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.sub);
  res.json({ ok: true });
});

module.exports = router;
module.exports.loadOwnBrands = loadOwnBrands;
module.exports.saveOwnBrands = saveOwnBrands;
