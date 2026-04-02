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

  // ── 分類頁批量爬取（第 0～N 頁）─────────────────────────
  async scrapeCategory(baseUrl, totalPages = 9) {
    const allProducts = [];
    await this.launch();

    try {
      for (let pageNum = 0; pageNum < totalPages; pageNum++) {
        const url = `${baseUrl}&currentPage=${pageNum}`;
        logger.info(`[屈臣氏] 分類頁 ${pageNum + 1}/${totalPages}: ${url}`);

        const products = await this.withRetry(async () => {
          const page = await this.newPage();
          try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            await this.randomDelay(1500, 3000);

            // 等待商品卡片載入（屈臣氏 Spartacus Angular）
            await page.waitForSelector('.productContainer', { timeout: 15000 }).catch(() => null);

            // 捲動頁面觸發懶載入
            await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
            await new Promise(r => setTimeout(r, 2000));

            return await page.evaluate(() => {
              const results = [];
              const cards = document.querySelectorAll('.productContainer');

              cards.forEach(card => {
                // 商品名稱
                const nameEl = card.querySelector('.productInfo [class*="name"], .productInfo a, .productInfo p');
                const name = nameEl?.textContent?.trim() || null;

                // 價格（抓所有含數字的 span/div，取第一個像價格的）
                const priceSelectors = [
                  '[class*="price"]', '[class*="Price"]',
                  'cx-price', '.price',
                ];
                let priceStr = null;
                for (const sel of priceSelectors) {
                  const el = card.querySelector(sel);
                  if (el?.textContent?.match(/\d/)) { priceStr = el.textContent.trim(); break; }
                }
                // fallback：找所有含 $ 或純數字的葉節點
                if (!priceStr) {
                  const spans = card.querySelectorAll('span, div');
                  for (const el of spans) {
                    if (el.children.length === 0 && /\$?\d{2,4}/.test(el.textContent.trim())) {
                      priceStr = el.textContent.trim();
                      break;
                    }
                  }
                }

                // 原價（劃線價）
                const origEl = card.querySelector('del, s, [class*="original"], [class*="was"]');
                const origStr = origEl?.textContent?.match(/\d/) ? origEl.textContent.trim() : null;

                // 商品頁連結
                const linkEl = card.querySelector('a[href]');
                const href = linkEl?.getAttribute('href') || null;
                const productUrl = href
                  ? (href.startsWith('http') ? href : `https://www.watsons.com.tw${href}`)
                  : null;

                // 圖片
                const imgEl = card.querySelector('img');
                const image = imgEl?.src || imgEl?.dataset?.src || null;

                if (name && priceStr) {
                  results.push({ name, priceStr, origStr, productUrl, image });
                }
              });

              return results;
            });
          } finally {
            await page.close();
          }
        });

        // 解析價格並整理資料
        const parsed = products.map(p => ({
          name:          p.name,
          price:         this.parsePrice(p.priceStr),
          originalPrice: this.parsePrice(p.origStr),
          productUrl:    p.productUrl,
          image:         p.image,
          platform:      'watsons',
          scrapedAt:     new Date().toISOString(),
        })).filter(p => p.price > 0);

        logger.info(`[屈臣氏] 第 ${pageNum + 1} 頁抓到 ${parsed.length} 筆`);
        allProducts.push(...parsed);

        // 避免被封鎖：每頁之間隨機等待
        if (pageNum < totalPages - 1) await this.randomDelay(1500, 3000);
      }
    } finally {
      await this.close();
    }

    logger.info(`[屈臣氏] 分類爬取完成，共 ${allProducts.length} 筆商品`);
    return allProducts;
  }
}

module.exports = WatsonsScraper;
