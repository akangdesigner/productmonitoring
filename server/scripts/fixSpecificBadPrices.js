const { getDB } = require('../db/index.js');

/**
 * 針對已知「特定商品」的錯誤價格做修復：
 * - 刪除最新一筆明顯異常的 price_records，讓顯示回到上一筆正常值
 *
 * 使用方式：
 *   node server/scripts/fixSpecificBadPrices.js --dry
 *   node server/scripts/fixSpecificBadPrices.js
 */

const argv = new Set(process.argv.slice(2));
const DRY_RUN = argv.has('--dry') || argv.has('-n');

const TARGETS = [
  {
    key: 'OPERA 禮盒',
    productLike: '%OPERA%渲漾水色唇膏%光澤系禮盒%408%409%',
    platform: 'watsons',
    // 若最新與上一筆差距過大（誤配價格常見）
    rule: 'comparePrev',
    ratioLow: 0.7,
    ratioHigh: 1.5,
  },
  {
    key: 'MAYBELLINE 水嘟嘟白桃（含 #保濕0唇紋 那筆）',
    productLike: '%水嘟嘟蜜光潤唇膏%05%嘟嘟白桃%#保濕0唇紋%',
    platform: 'watsons',
    // 價格超大通常是數字黏一起/混入其他數字
    rule: 'absurdPrice',
    absurdMin: 10000,
  },
];

function main() {
  const db = getDB();

  const findProducts = db.prepare('SELECT id, name FROM products WHERE name LIKE ?');
  const latestTwo = db.prepare(`
    SELECT id, price, original_price, scraped_at
    FROM price_records
    WHERE product_id = ? AND platform = ?
    ORDER BY scraped_at DESC
    LIMIT 2
  `);
  const delById = db.prepare('DELETE FROM price_records WHERE id = ?');

  let totalDeleted = 0;
  const logs = [];

  const tx = db.transaction(() => {
    for (const t of TARGETS) {
      const products = findProducts.all(t.productLike);
      if (products.length === 0) {
        logs.push(`[略過] ${t.key}：找不到符合的商品（LIKE=${t.productLike}）`);
        continue;
      }

      for (const p of products) {
        const rows = latestTwo.all(p.id, t.platform);
        if (rows.length === 0) {
          logs.push(`[略過] ${t.key}：${p.name}（${t.platform}）沒有價格紀錄`);
          continue;
        }
        if (rows.length === 1) {
          logs.push(`[略過] ${t.key}：${p.name}（${t.platform}）只有 1 筆價格，無法回退`);
          continue;
        }

        const [latest, prev] = rows;
        let shouldDelete = false;

        if (t.rule === 'absurdPrice') {
          if (Number(latest.price) >= t.absurdMin) shouldDelete = true;
        } else if (t.rule === 'comparePrev') {
          const lp = Number(latest.price);
          const pp = Number(prev.price);
          if (pp > 0) {
            const r = lp / pp;
            if (r < t.ratioLow || r > t.ratioHigh) shouldDelete = true;
          }
        }

        if (!shouldDelete) {
          logs.push(`[略過] ${t.key}：${p.name}（${t.platform}）最新價格看起來合理（latest=${latest.price}, prev=${prev.price}）`);
          continue;
        }

        logs.push(`[修復] ${t.key}：${p.name}（${t.platform}）刪除最新 id=${latest.id} price=${latest.price} orig=${latest.original_price} @${latest.scraped_at} → 回到 prev=${prev.price} orig=${prev.original_price}`);
        if (!DRY_RUN) {
          delById.run(latest.id);
        }
        totalDeleted++;
      }
    }
  });

  tx();

  console.log(`\n[fixSpecificBadPrices] 模式：${DRY_RUN ? 'DRY RUN（不寫入）' : 'WRITE（寫入資料庫）'}`);
  console.log(`[fixSpecificBadPrices] 刪除筆數：${totalDeleted}`);
  logs.forEach(l => console.log(l));

  if (DRY_RUN) {
    console.log('\n提示：確認輸出內容正確後，移除 --dry 再跑一次即可寫入。');
  }
}

main();

