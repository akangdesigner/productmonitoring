const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const logger = require('../utils/logger');

puppeteer.use(StealthPlugin());

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
];

class BaseScraper {
  constructor(platformName) {
    this.platformName = platformName;
    this.browser = null;
  }

  async launch() {
    this.browser = await puppeteer.launch({
      headless: process.env.SCRAPE_HEADLESS !== 'false',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    });
    logger.info(`[${this.platformName}] 瀏覽器已啟動`);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async newPage() {
    const page = await this.browser.newPage();
    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    await page.setUserAgent(ua);
    await page.setViewport({ width: 1366, height: 768 });
    page.setDefaultTimeout(process.env.SCRAPE_TIMEOUT ? parseInt(process.env.SCRAPE_TIMEOUT) : 30000);
    return page;
  }

  // 隨機等待，模擬人類行為
  async randomDelay(min = 800, max = 2500) {
    const ms = Math.floor(Math.random() * (max - min) + min);
    await new Promise(r => setTimeout(r, ms));
  }

  // 帶重試的抓取
  async withRetry(fn, maxRetries = 3) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        logger.warn(`[${this.platformName}] 第 ${i + 1} 次失敗: ${err.message}`);
        await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000)); // 1s, 2s, 4s
      }
    }
    throw lastError;
  }

  // 子類需實作：抓取單一商品
  // 回傳: { price, originalPrice, discountLabel, inStock, gift }
  async scrapeProduct(url) {
    throw new Error(`${this.platformName}.scrapeProduct() 尚未實作`);
  }

  // 清洗價格字串：「NT$1,280」→ 1280
  parsePrice(str) {
    if (!str) return null;
    const num = parseFloat(str.replace(/[^0-9.]/g, ''));
    return isNaN(num) ? null : num;
  }
}

module.exports = BaseScraper;
