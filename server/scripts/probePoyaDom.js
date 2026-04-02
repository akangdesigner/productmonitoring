/**
 * 探勘寶雅分類頁 DOM：找出商品卡/連結 selector
 *
 * 使用方式：
 *   node server/scripts/probePoyaDom.js
 */

async function main() {
  const puppeteer = require('puppeteer');
  const url = 'https://www.poyabuy.com.tw/v2/official/SalePageCategory/566524?sortMode=Curator';
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(3000);

    // 嘗試捲動，觸發懶載入
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await sleep(1200);
    }

    const out = await page.evaluate(() => {
      const selectors = [
        "a[href*='SalePageDetail']",
        "a[href*='SalePage']",
        "a[href*='goods']",
        "a[href*='product']",
        "[class*='product' i]",
        "[class*='item' i]",
        "[data-testid]",
        "img[alt]",
      ];

      const counts = Object.fromEntries(selectors.map(s => [s, document.querySelectorAll(s).length]));

      const sample = (sel) =>
        Array.from(document.querySelectorAll(sel))
          .slice(0, 10)
          .map(el => ({
            tag: el.tagName,
            href: el.getAttribute?.('href') || null,
            alt: el.getAttribute?.('alt') || null,
            text: (el.innerText || '').trim().slice(0, 80) || null,
            className: el.className ? String(el.className).slice(0, 80) : null,
          }));

      return {
        counts,
        samples: {
          salePageDetail: sample("a[href*='SalePageDetail']"),
          salePage: sample("a[href*='SalePage']"),
          dataTestid: sample('[data-testid]'),
        },
        bodySnippet: (document.body?.innerText || '').slice(0, 500),
      };
    });

    console.log(JSON.stringify(out, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

