const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');
const AlertService = require('../services/AlertService');
const LineService = require('../services/LineService');
const logger = require('../utils/logger');

// 動態載入爬蟲
const scrapers = {
  watsons: () => new (require('../scrapers/WatsonsScraper'))(),
  cosmed:  () => new (require('../scrapers/CosmedScraper'))(),
  momo:    () => new (require('../scrapers/MomoScraper'))(),
};

async function runScrapeJob(platform = 'all') {
  const db = getDB();
  const jobId = uuidv4();
  db.prepare('INSERT INTO scrape_jobs (id, platform) VALUES (?, ?)').run(jobId, platform);

  let scraped = 0, errors = 0;
  const errorDetails = [];

  const platforms = platform === 'all' ? Object.keys(scrapers) : [platform];

  for (const pf of platforms) {
    const urls = db.prepare(`
      SELECT pu.url, pu.product_id, p.name, p.brand, p.id
      FROM product_urls pu
      JOIN products p ON p.id = pu.product_id
      WHERE pu.platform = ? AND p.is_active = 1
    `).all(pf);

    if (!urls.length) continue;

    const scraper = scrapers[pf]();
    try {
      await scraper.launch();

      for (const row of urls) {
        try {
          const result = await scraper.scrapeProduct(row.url);
          if (!result.price) { errors++; continue; }

          // 查詢上次價格
          const lastPrice = db.prepare(`
            SELECT price FROM price_records
            WHERE product_id = ? AND platform = ?
            ORDER BY scraped_at DESC LIMIT 1
          `).get(row.product_id, pf);

          // 寫入新價格
          db.prepare(`
            INSERT INTO price_records (id, product_id, platform, price, original_price, discount_label, in_stock)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(uuidv4(), row.product_id, pf, result.price, result.originalPrice, result.discountLabel, result.inStock ? 1 : 0);

          // 檢查價格變動
          if (lastPrice) {
            await AlertService.checkPriceChange(
              { id: row.product_id, name: row.name, brand: row.brand },
              pf, result.price, lastPrice.price
            );
          }

          // 檢查贈品變動
          const lastGift = db.prepare(`
            SELECT gift_description FROM gift_records
            WHERE product_id = ? AND platform = ? AND is_active = 1
            ORDER BY scraped_at DESC LIMIT 1
          `).get(row.product_id, pf);

          if (result.gift !== (lastGift?.gift_description || null)) {
            // 舊贈品設為無效
            db.prepare(`
              UPDATE gift_records SET is_active = 0
              WHERE product_id = ? AND platform = ? AND is_active = 1
            `).run(row.product_id, pf);

            // 新增新贈品記錄
            if (result.gift) {
              db.prepare(`
                INSERT INTO gift_records (id, product_id, platform, gift_description)
                VALUES (?, ?, ?, ?)
              `).run(uuidv4(), row.product_id, pf, result.gift);
            }

            await AlertService.checkGiftChange(
              { id: row.product_id, name: row.name, brand: row.brand },
              pf, result.gift, lastGift?.gift_description || null
            );
          }

          scraped++;
          logger.info(`[爬蟲] ${pf} · ${row.name} · NT$${result.price}`);
        } catch (err) {
          errors++;
          errorDetails.push({ product: row.name, error: err.message });
          logger.error(`[爬蟲] ${pf} · ${row.name} 失敗: ${err.message}`);
        }
      }
    } finally {
      await scraper.close();
    }
  }

  // 更新任務狀態
  db.prepare(`
    UPDATE scrape_jobs
    SET status = ?, products_scraped = ?, errors_count = ?, error_detail = ?, finished_at = datetime('now','localtime')
    WHERE id = ?
  `).run(errors > 0 ? 'failed' : 'success', scraped, errors, JSON.stringify(errorDetails), jobId);

  logger.info(`[爬蟲] 完成: 成功 ${scraped} 筆，失敗 ${errors} 筆`);
  return { jobId, scraped, errors };
}

function startScheduler() {
  // 每 4 小時執行全平台爬取
  cron.schedule('0 */4 * * *', () => {
    logger.info('[排程] 啟動定時爬取');
    runScrapeJob('all').catch(err => logger.error('[排程] 爬取失敗:', err));
  });

  // 每日 09:00 推播早報
  cron.schedule('0 9 * * *', async () => {
    logger.info('[排程] 發送每日早報');
    const db = getDB();
    // 取得所有商品最新各平台價格（簡化版）
    const products = db.prepare('SELECT * FROM products WHERE is_active = 1').all();
    await LineService.sendDailyReport(products).catch(err =>
      logger.warn('[排程] 早報推播失敗:', err)
    );
  });

  // 每週日清理 90 天前已讀警示
  cron.schedule('0 0 * * 0', () => {
    const db = getDB();
    const result = db.prepare(`
      DELETE FROM alerts WHERE is_read = 1 AND created_at < datetime('now', '-90 days')
    `).run();
    logger.info(`[排程] 清理舊警示 ${result.changes} 筆`);
  });
}

module.exports = { startScheduler, runScrapeJob };
