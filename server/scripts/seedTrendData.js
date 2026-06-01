const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');
const db = getDB();

// 抓所有有價格記錄的商品（取各平台最新價）
const rows = db.prepare(`
  SELECT pr.product_id, pr.platform, pr.price
  FROM price_records pr
  WHERE pr.scraped_at = (
    SELECT MAX(scraped_at) FROM price_records
    WHERE product_id = pr.product_id AND platform = pr.platform
  )
  AND pr.price > 0
`).all();

console.log(`找到 ${rows.length} 筆現有價格記錄`);

const insert = db.prepare(
  'INSERT INTO price_records (id, product_id, platform, price, scraped_at) VALUES (?, ?, ?, ?, ?)'
);

// 5/1 原價-100，5/10 原價+100
const dates = [
  { date: '2026-05-01 10:00:00', delta: -100 },
  { date: '2026-05-10 10:00:00', delta: +100 },
];

let count = 0;
db.transaction(() => {
  for (const row of rows) {
    for (const { date, delta } of dates) {
      const fakePrice = Math.max(10, row.price + delta);
      insert.run(uuidv4(), row.product_id, row.platform, fakePrice, date);
      count++;
    }
  }
})();

console.log(`✅ 插入 ${count} 筆假資料（5/1 原價-100、5/10 原價+100）`);
