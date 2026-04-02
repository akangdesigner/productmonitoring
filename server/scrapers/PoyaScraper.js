const BaseScraper = require('./BaseScraper');
const logger = require('../utils/logger');

class PoyaScraper extends BaseScraper {
  constructor() {
    super('寶雅');
  }

  async scrapeProduct(url) {
    return this.withRetry(async () => {
      await this.launch();
      const page = await this.newPage();

      try {
        logger.info(`[寶雅] 抓取: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        await this.randomDelay();

        const result = await page.evaluate(() => {
          const extractNums = (text) => {
            if (!text) return [];
            const matches = text.match(/\d[\d,]*/g) || [];
            return matches
              .map(s => Number(String(s).replace(/,/g, '')))
              .filter(n => Number.isFinite(n) && n > 0 && n < 100000);
          };

          const texts = [];

          // 優先蒐集可能的價格區塊文字，避免把頁面上所有數字都算進來
          const priceEls = document.querySelectorAll(
            '[class*="price" i], [class*="Price" i], del, s, [data-testid*="price" i]'
          );
          priceEls.forEach(el => {
            const t = el.textContent?.trim();
            if (t && t.length <= 200) texts.push(t);
            const p = el.parentElement?.textContent?.trim();
            if (p && p.length <= 400) texts.push(p);
          });

          // fallback：若抓不到，才用 body 的短片段
          if (texts.length === 0) {
            const t = document.body?.innerText || '';
            texts.push(t.slice(0, 2000));
          }

          const allNums = texts.flatMap(extractNums);
          const nums = allNums.filter(n => n >= 10 && n <= 50000);

          let price = null;
          let originalPrice = null;
          if (nums.length) {
            const min = Math.min(...nums);
            const max = Math.max(...nums);
            price = Number.isFinite(min) ? min : null;
            originalPrice = (Number.isFinite(max) && max > min) ? max : null;

            // 避免誤把其他數字當成原價（差距過誇張就捨棄原價）
            if (price && originalPrice && originalPrice / price > 5) originalPrice = null;
          }

          const bodyText = (document.body?.innerText || '').slice(0, 5000);
          const inStock = !/售完|缺貨|補貨中|已售完/.test(bodyText);

          return { price, originalPrice, inStock };
        });

        return {
          price: result.price,
          originalPrice: result.originalPrice,
          discountLabel: null,
          inStock: result.inStock,
          gift: null,
        };
      } finally {
        await page.close().catch(() => null);
        await this.close();
      }
    });
  }
}

module.exports = PoyaScraper;

