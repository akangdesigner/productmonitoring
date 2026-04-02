const { getDB } = require('../db/index.js');

/**
 * 修復歷史資料中「特價+原價」被黏成單一數字的情況
 * 例：366430 其實是「特價 366、原價 430」
 *
 * 使用方式：
 *   node server/scripts/fixMergedPrices.js --dry
 *   node server/scripts/fixMergedPrices.js
 */

const argv = new Set(process.argv.slice(2));
const DRY_RUN = argv.has('--dry') || argv.has('-n');

function toIntString(n) {
  if (n === null || n === undefined) return null;
  const s = String(n);
  if (s.includes('.')) return s.split('.')[0];
  return s;
}

function chooseSplit(mergedNumber) {
  const s = toIntString(mergedNumber);
  if (!s || !/^\d+$/.test(s)) return null;
  if (s.length < 5) return null; // 至少要能切成兩個 2~? 位數

  let best = null;
  for (let i = 2; i <= s.length - 2; i++) {
    const a = Number(s.slice(0, i));
    const b = Number(s.slice(i));
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    if (a <= 0 || b <= 0) continue;

    const sale = a;
    const orig = b;

    // 合理性過濾：
    // - 特價通常小於原價
    // - 價格區間避免太誇張（可依需求再調）
    if (!(sale < orig)) continue;
    if (sale < 10 || orig < 10) continue;
    if (sale > 50000 || orig > 50000) continue;

    // 避免像 3|66430 這種不合理拆法：原價若過大且特價太小就略過
    const ratio = orig / sale;
    if (ratio > 5) continue;

    // 打分：偏好「兩者位數接近」且原價在 100~5000 間（美妝較常見）
    const lenDiff = Math.abs(String(sale).length - String(orig).length);
    let score = 0;
    score += (2 - Math.min(lenDiff, 2)) * 10;
    if (orig >= 100 && orig <= 5000) score += 10;
    if (sale >= 50 && sale <= 5000) score += 5;
    if ((orig - sale) >= 10) score += 2;

    if (!best || score > best.score) best = { sale, orig, score };
  }

  return best ? { sale: best.sale, orig: best.orig } : null;
}

function main() {
  const db = getDB();

  // 只修正「價錢過大」的資料（黏在一起的數字通常會 >= 10000）
  // 注意：有些錯誤資料 original_price 可能本來就有值（例如 430），因此不能用 original_price 來篩選。
  const candidates = db.prepare(`
    SELECT id, product_id, platform, price, original_price, scraped_at
    FROM price_records
    WHERE price >= 10000
    ORDER BY scraped_at DESC
  `).all();

  const update = db.prepare(`
    UPDATE price_records
    SET price = ?, original_price = ?, discount_label = ?
    WHERE id = ?
  `);

  let fixed = 0;
  let skipped = 0;
  const samples = [];

  const tx = db.transaction(() => {
    for (const row of candidates) {
      const split = chooseSplit(row.price);
      if (!split) { skipped++; continue; }

      const discountLabel = split.sale < split.orig ? '售價已折' : null;

      if (!DRY_RUN) {
        update.run(split.sale, split.orig, discountLabel, row.id);
      }

      fixed++;
      if (samples.length < 20) {
        samples.push({
          id: row.id,
          platform: row.platform,
          before: row.price,
          after: `NT$${split.sale}（原價${split.orig}）`,
          scraped_at: row.scraped_at,
        });
      }
    }
  });

  tx();

  console.log(`\n[fixMergedPrices] 模式：${DRY_RUN ? 'DRY RUN（不寫入）' : 'WRITE（寫入資料庫）'}`);
  console.log(`[fixMergedPrices] 候選筆數：${candidates.length}`);
  console.log(`[fixMergedPrices] 已修正：${fixed}`);
  console.log(`[fixMergedPrices] 略過：${skipped}`);

  if (samples.length) {
    console.log('\n[fixMergedPrices] 範例（最多 20 筆）：');
    for (const s of samples) {
      console.log(`- ${s.platform} ${s.before} -> ${s.after} (${s.scraped_at})`);
    }
  }

  if (DRY_RUN) {
    console.log('\n提示：確認範例合理後，移除 --dry 再跑一次即可寫入。');
  }
}

main();

