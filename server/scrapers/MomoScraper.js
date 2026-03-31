const BaseScraper = require('./BaseScraper');
const logger = require('../utils/logger');

class MomoScraper extends BaseScraper {
  constructor() {
    super('MOMO');
  }

  async scrapeProduct(url) {
    return this.withRetry(async () => {
      const page = await this.newPage();
      try {
        logger.info(`[MOMO] 抓取: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle2' });
        await this.randomDelay(1200, 3000); // MOMO 需要更長等待

        await page.waitForSelector('.prdPrice, .product-price', { timeout: 20000 }).catch(() => null);

        const result = await page.evaluate(() => {
          const selectors = {
            flashPrice:    ['.flash-sale-price b', '.flash-sale-price'],
            price:         ['.prdPrice .price b', '.prdPrice b', '.product-price .price'],
            originalPrice: ['.prdPrice del', '.product-price del'],
            gift:          ['.giftBox li', '.addGift li', '.gift-item'],
            promotions:    ['.promotion-label-list li'],
            soldOut:       ['.soldOut', '[class*="soldOut"]', 'button[disabled][class*="cart"]'],
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
              if (els.length) return Array.from(els).map(e => e.textContent.trim()).filter(Boolean).join('，');
            }
            return null;
          };

          // Flash Sale 優先
          const priceStr = findText(selectors.flashPrice) || findText(selectors.price);
          const inStock = !document.querySelector(selectors.soldOut.join(','));
          const promotions = findAll(selectors.promotions);

          return {
            priceStr,
            originalPriceStr: findText(selectors.originalPrice),
            giftStr: findAll(selectors.gift),
            discountLabel: promotions,
            inStock,
          };
        });

        return {
          price:         this.parsePrice(result.priceStr),
          originalPrice: this.parsePrice(result.originalPriceStr),
          discountLabel: result.discountLabel,
          inStock:       result.inStock,
          gift:          result.giftStr,
        };
      } finally {
        await page.close();
      }
    });
  }
}

module.exports = MomoScraper;
