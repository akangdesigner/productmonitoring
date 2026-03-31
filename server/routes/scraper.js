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

// POST /api/scraper/category/watsons — 爬取屈臣氏分類頁
router.post('/category/watsons', async (req, res) => {
  const { baseUrl, pages = 9, saveToDb = false } = req.body;

  const defaultUrl = 'https://www.watsons.com.tw/%E5%8C%96%E5%A6%9D%E5%93%81/%E5%94%87%E8%86%8F/c/10440301?q=:bestSeller:category:10440301:priceValue:%5B99%20TO%20500%5D';

  const targetUrl = (baseUrl || defaultUrl).replace(/&currentPage=\d+$/, '');

  const WatsonsScraper = require('../scrapers/WatsonsScraper');
  const scraper = new WatsonsScraper();

  try {
    const products = await scraper.scrapeCategory(targetUrl, parseInt(pages));

    // 選擇性存入資料庫
    if (saveToDb && products.length > 0) {
      const { getDB } = require('../db');
      const { v4: uuidv4 } = require('uuid');
      const db = getDB();

      let saved = 0;
      for (const p of products) {
        if (!p.productUrl) continue;

        // 檢查是否已存在相同商品
        const exists = db.prepare('SELECT id FROM product_urls WHERE url = ?').get(p.productUrl);
        if (exists) continue;

        const productId = uuidv4();
        db.prepare('INSERT INTO products (id, name, brand, category, emoji) VALUES (?, ?, ?, ?, ?)')
          .run(productId, p.name, '屈臣氏', 'makeup', '💄');
        db.prepare('INSERT INTO product_urls (id, product_id, platform, url) VALUES (?, ?, ?, ?)')
          .run(uuidv4(), productId, 'watsons', p.productUrl);

        if (p.price) {
          db.prepare('INSERT INTO price_records (id, product_id, platform, price, original_price) VALUES (?, ?, ?, ?, ?)')
            .run(uuidv4(), productId, 'watsons', p.price, p.originalPrice || null);
        }
        saved++;
      }

      return res.json({ total: products.length, saved, products });
    }

    res.json({ total: products.length, products });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/scraper/history
router.get('/history', (req, res) => {
  const db = getDB();
  const { limit = 20 } = req.query;
  res.json(db.prepare('SELECT * FROM scrape_jobs ORDER BY started_at DESC LIMIT ?').all(parseInt(limit)));
});

module.exports = router;
