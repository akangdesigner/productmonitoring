const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { runScrapeJob } = require('../jobs/scheduledScrape');

// POST /api/scraper/run — 手動觸發全部
router.post('/run', async (req, res) => {
  try {
    const result = await runScrapeJob('all');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/scraper/run/:platform — 觸發單一平台
router.post('/run/:platform', async (req, res) => {
  const { platform } = req.params;
  const allowed = ['watsons', 'cosmed', 'momo', 'pchome'];
  if (!allowed.includes(platform)) return res.status(400).json({ error: '未知平台' });
  try {
    const result = await runScrapeJob(platform);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/scraper/status
router.get('/status', (req, res) => {
  const db = getDB();
  const running = db.prepare(`SELECT * FROM scrape_jobs WHERE status = 'running' ORDER BY started_at DESC LIMIT 1`).get();
  res.json({
    status: running ? 'running' : 'idle',
    currentJob: running || null,
  });
});

// GET /api/scraper/history
router.get('/history', (req, res) => {
  const db = getDB();
  const { limit = 20 } = req.query;
  res.json(db.prepare('SELECT * FROM scrape_jobs ORDER BY started_at DESC LIMIT ?').all(parseInt(limit)));
});

module.exports = router;
