const BaseScraper = require('./BaseScraper');
const axios = require('axios');
const logger = require('../utils/logger');

class CosmedScraper extends BaseScraper {
  constructor() {
    super('康是美');
  }

  async scrapeProduct(url) {
    return this.withRetry(async () => {
      logger.info(`[康是美] 抓取: ${url}`);

      // 先嘗試 axios（較快、較穩定）
      try {
        return await this._scrapeWithAxios(url);
      } catch {
        logger.warn('[康是美] axios 失敗，改用 Puppeteer');
        return await this._scrapeWithPuppeteer(url);
      }
    });
  }

  async _scrapeWithAxios(url) {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'zh-TW,zh;q=0.9',
      },
      timeout: 15000,
    });

    // 簡易 HTML 解析（不依賴 cheerio，保持輕量）
    const priceMatch  = data.match(/class="[^"]*price[^"]*"[^>]*>[\s\S]*?NT\$?([\d,]+)/i);
    const giftMatch   = data.match(/class="[^"]*gift[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/i);

    return {
      price:         priceMatch  ? this.parsePrice(priceMatch[1]) : null,
      originalPrice: null,
      discountLabel: null,
      inStock:       !data.includes('售完') && !data.includes('缺貨'),
      gift:          giftMatch   ? giftMatch[1].replace(/<[^>]+>/g, '').trim() : null,
    };
  }

  async _scrapeWithPuppeteer(url) {
    await this.launch();
    const page = await this.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await this.randomDelay();

      return await page.evaluate(() => {
        const priceEl = document.querySelector('.price-box .price, [class*="salePrice"], [class*="currentPrice"]');
        const giftEls = document.querySelectorAll('.gift-info-block li, [class*="giftInfo"] li');
        const soldOut = !!document.querySelector('button[disabled][class*="cart"], .sold-out');

        return {
          priceStr:  priceEl?.textContent?.trim() || null,
          giftStr:   Array.from(giftEls).map(e => e.textContent.trim()).join('，') || null,
          inStock:   !soldOut,
        };
      }).then(r => ({
        price:         this.parsePrice(r.priceStr),
        originalPrice: null,
        discountLabel: null,
        inStock:       r.inStock,
        gift:          r.giftStr,
      }));
    } finally {
      await page.close();
      await this.close();
    }
  }
}

module.exports = CosmedScraper;
