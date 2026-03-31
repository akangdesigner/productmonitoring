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
