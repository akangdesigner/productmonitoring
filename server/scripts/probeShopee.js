/**
 * 蝦皮搜尋頁探測腳本
 * 用法：node scripts/probeShopee.js "電蚊拍"
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const keyword = process.argv[2] || '電蚊拍';
const url = `https://shopee.tw/search?keyword=${encodeURIComponent(keyword)}`;

(async () => {
  console.log(`\n🔍 搜尋關鍵字：${keyword}`);
  console.log(`📄 網址：${url}\n`);

  const COOKIES_PATH = require('path').join(__dirname, '..', 'shopee_cookies.json');
  const cookieData = require('fs').existsSync(COOKIES_PATH)
    ? JSON.parse(require('fs').readFileSync(COOKIES_PATH, 'utf8'))
    : null;

  if (!cookieData) {
    console.log('❌ 尚未授權蝦皮，請先在前端設定頁完成「授權蝦皮」');
    process.exit(1);
  }
  console.log(`🍪 載入 ${cookieData.cookies.length} 個已授權 cookie（儲存於 ${cookieData.savedAt}）\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1280, height: 900 },
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  );

  try {
    await page.setCookie(...cookieData.cookies);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // 等待商品卡片出現
    console.log('⏳ 等待商品卡片...');
    const cardSelector = 'li.shopee-search-item-result__item, [data-sqe="item"]';
    await page.waitForSelector(cardSelector, { timeout: 20000 }).catch(() => null);
    await new Promise(r => setTimeout(r, 2000));

    // 截圖供確認
    await page.screenshot({ path: 'shopee_debug.png', fullPage: false });
    console.log('📸 截圖已存至 shopee_debug.png');

    const products = await page.evaluate(() => {
      // 找所有 li 元素，過濾出有商品資訊的
      const allLi = [...document.querySelectorAll('li')];

      // 嘗試已知選擇器
      let cards = document.querySelectorAll('li.shopee-search-item-result__item');
      if (!cards.length) cards = document.querySelectorAll('[data-sqe="item"]');
      // 若還是找不到，用有圖片的 li 當候選
      if (!cards.length) {
        cards = allLi.filter(li => li.querySelector('img') && li.textContent.length > 10);
      }

      if (!cards.length) {
        return {
          error: '找不到商品卡片',
          liCount: allLi.length,
          bodySnippet: document.body.innerHTML.substring(0, 3000),
        };
      }

      const results = [];
      [...cards].forEach((card, i) => {
        if (i >= 20) return;

        // 名稱：找文字最長（但不超過 150 字）的葉子節點
        const allLeaves = [...card.querySelectorAll('*')].filter(
          el => el.children.length === 0 && el.textContent.trim().length > 4 && el.textContent.trim().length < 150
        );
        const nameEl = allLeaves.reduce((best, el) =>
          el.textContent.trim().length > (best?.textContent.trim().length || 0) ? el : best, null
        );

        // 價格：找包含 $ 符號或純數字的短葉子節點
        const priceEl = allLeaves.find(el => /[$＄]\s*[\d,]+|^\d[\d,.]+$/.test(el.textContent.trim()));

        const name = nameEl?.textContent?.trim() || '（名稱未取得）';
        const priceRaw = priceEl?.textContent?.trim() || '（價格未取得）';
        const priceNum = parseFloat(priceRaw.replace(/[^0-9.]/g, '')) || null;

        results.push({ name, price: priceNum, priceRaw });
      });

      return results;
    });

    if (products.error) {
      console.log('❌ 無法解析商品：', products.error);
      console.log('\n--- DOM 片段（供除錯）---');
      console.log(products.bodySnippet);
    } else {
      console.log(`✅ 找到 ${products.length} 筆商品：\n`);
      products.forEach((p, i) => {
        const price = p.price ? `NT$ ${p.price.toLocaleString()}` : p.priceRaw;
        console.log(`${String(i + 1).padStart(2, '0')}. ${p.name}`);
        console.log(`    💰 ${price}\n`);
      });
    }
  } catch (err) {
    console.error('❌ 發生錯誤：', err.message);

    // 截圖供除錯
    await page.screenshot({ path: 'shopee_debug.png' });
    console.log('📸 已截圖至 shopee_debug.png');
  } finally {
    await browser.close();
    console.log('\n瀏覽器已關閉。');
  }
})();
