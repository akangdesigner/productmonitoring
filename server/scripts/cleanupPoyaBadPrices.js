const { getDB } = require('../db');

/**
 * 清理寶雅錯誤價格（早期誤把規格數字當價格導致 price=1~9）
 *
 * 使用方式：
 *   node server/scripts/cleanupPoyaBadPrices.js --dry
 *   node server/scripts/cleanupPoyaBadPrices.js
 */

const argv = new Set(process.argv.slice(2));
const DRY_RUN = argv.has('--dry') || argv.has('-n');

function main() {
  const db = getDB();
  const count = db.prepare(`
    SELECT COUNT(1) as c
    FROM price_records
    WHERE platform = 'poya' AND price BETWEEN 0 AND 9
  `).get().c;

  console.log(`\n[cleanupPoyaBadPrices] 模式：${DRY_RUN ? 'DRY RUN（不寫入）' : 'WRITE（寫入資料庫）'}`);
  console.log(`[cleanupPoyaBadPrices] 目標筆數：${count}`);

  if (DRY_RUN) return;

  const info = db.prepare(`
    DELETE FROM price_records
    WHERE platform = 'poya' AND price BETWEEN 0 AND 9
  `).run();

  console.log(`[cleanupPoyaBadPrices] 已刪除：${info.changes} 筆`);
}

main();

