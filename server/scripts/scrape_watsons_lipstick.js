/**
 * 獨立執行：爬取屈臣氏唇膏分類頁（99~500元，第0~8頁）
 * 執行：node scripts/scrape_watsons_lipstick.js
 */
require('dotenv').config({ path: '../.env' });
const { initDB, getDB } = require('../db');
const WatsonsScraper = require('../scrapers/WatsonsScraper');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://www.watsons.com.tw/%E5%8C%96%E5%A6%9D%E5%93%81/%E5%94%87%E8%86%8F/c/10440301?q=:bestSeller:category:10440301:priceValue:%5B99%20TO%20500%5D';

async function main() {
  await initDB();
  const db = getDB();
  const scraper = new WatsonsScraper();

  console.log('開始爬取屈臣氏唇膏分類頁（第 0~8 頁）...\n');

  let products = [];
  try {
    products = await scraper.scrapeCategory(BASE_URL, 9);
  } catch (err) {
    console.error('爬取失敗:', err.message);
    process.exit(1);
  }

  console.log(`\n共抓到 ${products.length} 筆商品`);

  // 存 JSON 備份
  const outPath = path.join(__dirname, '../logs/watsons_lipstick.json');
  fs.writeFileSync(outPath, JSON.stringify(products, null, 2), 'utf-8');
  console.log(`已儲存原始資料：${outPath}`);

  // 寫入資料庫（去重）
  let saved = 0, skipped = 0;
  for (const p of products) {
    if (!p.productUrl) { skipped++; continue; }

    const exists = db.prepare('SELECT id FROM product_urls WHERE url = ?').get(p.productUrl);
    if (exists) { skipped++; continue; }

    const productId = uuidv4();
    db.prepare('INSERT INTO products (id, name, brand, category, emoji) VALUES (?, ?, ?, ?, ?)')
      .run(productId, p.name, '屈臣氏', 'makeup', '💄');
    db.prepare('INSERT INTO product_urls (id, product_id, platform, url) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), productId, 'watsons', p.productUrl);
    if (p.price) {
      db.prepare('INSERT INTO price_records (id, product_id, platform, price, original_price) VALUES (?, ?, ?, ?, ?)')
        .run(uuidv4(), productId, 'watsons', p.price, p.originalPrice || null);
    }
    saved++;
  }

  console.log(`\n✅ 寫入資料庫：${saved} 筆新增，${skipped} 筆略過（已存在或無網址）`);

  // 印出前 10 筆預覽
  console.log('\n── 前 10 筆預覽 ──');
  products.slice(0, 10).forEach((p, i) => {
    console.log(`${i+1}. ${p.name} | NT$${p.price}${p.originalPrice ? ` (原 NT$${p.originalPrice})` : ''}`);
    if (p.productUrl) console.log(`   ${p.productUrl}`);
  });

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
