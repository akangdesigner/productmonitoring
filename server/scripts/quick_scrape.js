/**
 * 快速抓取分類頁商品名稱與價格（不寫入資料庫）
 * 執行：node scripts/quick_scrape.js
 */
const WatsonsScraper = require('../scrapers/WatsonsScraper');

const URL = 'https://www.watsons.com.tw/%E5%8C%96%E5%A6%9D%E5%93%81/%E5%94%87%E8%86%8F/c/10440301';
const PAGES = 1; // 要抓幾頁

async function main() {
  const scraper = new WatsonsScraper();
  console.log(`開始抓取：${URL}\n`);

  let products = [];
  try {
    products = await scraper.scrapeCategory(URL, PAGES);
  } catch (err) {
    console.error('抓取失敗:', err.message);
    process.exit(1);
  }

  console.log(`\n共抓到 ${products.length} 筆商品\n`);
  console.log('商品名稱'.padEnd(50) + '現價'.padEnd(10) + '原價');
  console.log('─'.repeat(75));

  products.forEach((p, i) => {
    const name = p.name.length > 45 ? p.name.slice(0, 42) + '...' : p.name;
    const price = `NT$${p.price}`;
    const orig = p.originalPrice ? `NT$${p.originalPrice}` : '-';
    console.log(`${String(i+1).padStart(3)}. ${name.padEnd(46)} ${price.padEnd(10)} ${orig}`);
  });

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
