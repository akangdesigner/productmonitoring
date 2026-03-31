const BaseScraper = require('./BaseScraper');
const logger = require('../utils/logger');

class WatsonsScraper extends BaseScraper {
  constructor() {
    super('屈臣氏');
  }

  async scrapeProduct(url) {
    return this.withRetry(async () => {
      const page = await this.newPage();
      try {
        logger.info(`[屈臣氏] 抓取: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle2' });
        await this.randomDelay();

        // 等待價格元素載入
        await page.waitForSelector('[class*="price"], [class*="Price"]', { timeout: 15000 }).catch(() => null);

        const result = await page.evaluate(() => {
          // 嘗試多種選擇器（實際部署時需依照網站 DOM 調整）
          const selectors = {
            price:         ['.product-price .current-price', '.price-value', '[class*="currentPrice"]', '[class*="salePrice"]'],
            originalPrice: ['.product-price .original-price', '.price-original', '[class*="originalPrice"]'],
            gift:          ['.product-promotion-section .promotion-item', '[class*="giftInfo"]', '[class*="promotion"]'],
            addToCart:     ['button[class*="addToCart"]:not([disabled])', 'button[class*="add-to-cart"]:not([disabled])'],
          };

          const findText = (sels) => {
            for (const sel of sels) {
              const el = document.querySelector(sel);
              if (el && el.textContent.trim()) return el.textContent.trim();
            }
            return null;
          };

          const findAll = (sels) => {
            for (const sel of sels) {
              const els = document.querySelectorAll(sel);
              if (els.length) return Array.from(els).map(e => e.textContent.trim()).join('，');
            }
            return null;
          };

          const inStock = !!document.querySelector(selectors.addToCart.join(','));

          return {
            priceStr:         findText(selectors.price),
            originalPriceStr: findText(selectors.originalPrice),
            giftStr:          findAll(selectors.gift),
            inStock,
          };
        });

        return {
          price:         this.parsePrice(result.priceStr),
          originalPrice: this.parsePrice(result.originalPriceStr),
          discountLabel: null,
          inStock:       result.inStock,
          gift:          result.giftStr,
        };
      } finally {
        await page.close();
      }
    });
  }
}

module.exports = WatsonsScraper;
