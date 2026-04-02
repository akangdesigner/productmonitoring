const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

  const url = 'https://www.watsons.com.tw/%E5%8C%96%E5%A6%9D%E5%93%81/%E5%94%87%E8%86%8F/c/10440301?q=:bestSeller:category:10440301:priceValue:%5B99%20TO%20500%5D&currentPage=0';
  console.log('前往:', url);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  const info = await page.evaluate(() => {
    const cards = document.querySelectorAll('.productContainer');

    // 印出前 3 張商品卡片的完整 HTML
    const cardHTMLs = Array.from(cards).slice(0, 3).map((c, i) => ({
      index: i + 1,
      html: c.innerHTML.substring(0, 2000),
    }));

    // 找所有葉節點的 class 與文字（找出價格 class）
    const leafEls = Array.from(document.querySelectorAll('.productContainer span, .productContainer div'))
      .filter(el => el.children.length === 0 && el.textContent.trim().length > 0 && el.textContent.trim().length < 30)
      .slice(0, 30)
      .map(el => ({ tag: el.tagName, cls: el.className.substring(0, 60), text: el.textContent.trim() }));

    return {
      title: document.title,
      cardCount: cards.length,
      cardHTMLs,
      leafEls,
    };
  });

  console.log('\nTitle:', info.title);
  console.log(`\n找到 ${info.cardCount} 個 .productContainer\n`);
  info.cardHTMLs.forEach(c => {
    console.log(`\n=== 商品卡片 ${c.index} HTML ===`);
    console.log(c.html);
  });
  console.log('\n=== 葉節點（找價格 class）===');
  console.log(JSON.stringify(info.leafEls, null, 2));

  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
