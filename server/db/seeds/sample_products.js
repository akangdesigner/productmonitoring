/**
 * 種子資料：初始化範例商品
 * 執行：node db/seeds/sample_products.js
 */
require('dotenv').config({ path: '../.env' });
const { v4: uuidv4 } = require('uuid');
const { initDB, getDB } = require('../index');

const SAMPLE_PRODUCTS = [
  {
    name: 'SK-II 神仙水 230ml',  brand: 'SK-II',        category: 'skincare', emoji: '✨',
    urls: [
      { platform: 'watsons', url: 'https://www.watsons.com.tw/product/skii-facial-treatment-essence-230ml' },
      { platform: 'cosmed',  url: 'https://www.cosmed.com.tw/product/skii-facial-treatment-essence-230ml' },
      { platform: 'momo',    url: 'https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code=10619858' },
    ]
  },
  {
    name: '蘭蔻 小黑瓶精華 50ml', brand: 'Lancôme',      category: 'skincare', emoji: '🖤',
    urls: [
      { platform: 'watsons', url: 'https://www.watsons.com.tw/product/lancome-advanced-genifique-50ml' },
      { platform: 'cosmed',  url: 'https://www.cosmed.com.tw/product/lancome-advanced-genifique-50ml' },
      { platform: 'momo',    url: 'https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code=10502345' },
    ]
  },
  {
    name: 'YSL 奢華唇膏 #1966',   brand: 'Yves Saint Laurent', category: 'makeup', emoji: '💄',
    urls: [
      { platform: 'watsons', url: 'https://www.watsons.com.tw/product/ysl-rouge-pur-couture-1966' },
      { platform: 'cosmed',  url: 'https://www.cosmed.com.tw/product/ysl-rouge-pur-couture-1966' },
      { platform: 'momo',    url: 'https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code=9988123' },
    ]
  },
];

async function seed() {
  await initDB();
  const db = getDB();

  for (const p of SAMPLE_PRODUCTS) {
    const id = uuidv4();
    db.prepare('INSERT OR IGNORE INTO products (id, name, brand, category, emoji) VALUES (?, ?, ?, ?, ?)').run(id, p.name, p.brand, p.category, p.emoji);
    for (const u of p.urls) {
      db.prepare('INSERT INTO product_urls (id, product_id, platform, url) VALUES (?, ?, ?, ?)').run(uuidv4(), id, u.platform, u.url);
    }
    console.log(`✅ 新增: ${p.name}`);
  }

  console.log('\n種子資料初始化完成！');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
