const { getDB } = require('../db/index.js');

/**
 * 一次性清除所有 MOMO 假資料（不可逆）
 *
 * 使用方式：
 *   node server/scripts/deleteMomoData.js --dry
 *   node server/scripts/deleteMomoData.js
 */

const argv = new Set(process.argv.slice(2));
const DRY_RUN = argv.has('--dry') || argv.has('-n');

function main() {
  const db = getDB();

  const tables = [
    { name: 'price_records', where: "platform='momo'" },
    { name: 'product_urls',  where: "platform='momo'" },
    { name: 'alerts',        where: "platform='momo'" },
    { name: 'scrape_jobs',   where: "platform='momo'" },
  ];

  const counts = tables.map(t => {
    try {
      const row = db.prepare(`SELECT COUNT(*) as c FROM ${t.name} WHERE ${t.where}`).get();
      return { ...t, count: row?.c ?? 0, ok: true };
    } catch (e) {
      return { ...t, count: 0, ok: false, error: e.message };
    }
  });

  console.log(`\n[deleteMomoData] 模式：${DRY_RUN ? 'DRY RUN（不寫入）' : 'WRITE（寫入資料庫）'}`);
  counts.forEach(r => {
    if (!r.ok) console.log(`[deleteMomoData] ${r.name}: 讀取失敗：${r.error}`);
    else console.log(`[deleteMomoData] ${r.name}: ${r.count} 筆`);
  });

  if (DRY_RUN) {
    console.log('\n提示：確認刪除筆數後，移除 --dry 再執行一次即可真的刪除。');
    return;
  }

  const tx = db.transaction(() => {
    for (const t of tables) {
      try {
        const stmt = db.prepare(`DELETE FROM ${t.name} WHERE ${t.where}`);
        const info = stmt.run();
        console.log(`[deleteMomoData] 已刪除 ${t.name}: ${info.changes} 筆`);
      } catch (e) {
        console.log(`[deleteMomoData] 刪除失敗 ${t.name}: ${e.message}`);
      }
    }
  });

  tx();
}

main();

