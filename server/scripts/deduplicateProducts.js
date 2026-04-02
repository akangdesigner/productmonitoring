/**
 * 一次性清理腳本：
 * 1. 填入所有商品的 base_name / variant
 * 2. 合併 base_name 相同且 variant 相同的真重複商品
 *
 * 執行方式：node server/scripts/deduplicateProducts.js
 */
const path = require('path');
process.env.DB_PATH = path.join(__dirname, '../db/beauty_monitor.sqlite');
const { getDB, initDB } = require('../db');

// ── 與 scraper.js 相同的切分邏輯 ──
const LIP_KEYWORDS_RE = /(唇膏|唇露|唇泥|唇釉|唇彩|口紅|唇蜜|唇凍|唇蠟)/;
function extractBaseName(name) {
  const m = name.match(LIP_KEYWORDS_RE);
  if (!m) return name.trim();
  const idx = name.indexOf(m[0]) + m[0].length;
  return name.slice(0, idx).trim();
}
function extractVariant(name) {
  const m = name.match(LIP_KEYWORDS_RE);
  if (!m) return null;
  const idx = name.indexOf(m[0]) + m[0].length;
  const v = name.slice(idx).trim();
  return v || null;
}

function normalizeName(name) {
  return name.toLowerCase()
    .replace(/maybelline|媚比琳/g, 'maybelline')
    .replace(/kate|凱婷/g, 'kate')
    .replace(/heme|喜蜜/g, 'heme')
    .replace(/\s+/g, ' ').trim();
}
function getTokens(name) {
  return normalizeName(name).split(/[\s\-_\/,]+/)
    .filter(t => t.length > 1 && !/^\d+(\.\d+)?(g|ml|mg)$/.test(t));
}
function similarity(a, b) {
  const sA = new Set(getTokens(a)), sB = new Set(getTokens(b));
  const inter = [...sA].filter(t => sB.has(t)).length;
  const minLen = Math.min(sA.size, sB.size);
  return minLen > 0 ? inter / minLen : 0;
}

async function main() {
  await initDB();
  const db = getDB();

  const products = db.prepare('SELECT id, name, created_at FROM products WHERE is_active=1').all();
  console.log(`\n共 ${products.length} 筆商品，開始處理...\n`);

  // ── Step 1：填入 base_name / variant ──
  const updateStmt = db.prepare('UPDATE products SET base_name=?, variant=? WHERE id=?');
  let fillCount = 0;
  db.transaction(() => {
    for (const p of products) {
      const base = extractBaseName(p.name);
      const variant = extractVariant(p.name);
      updateStmt.run(base, variant, p.id);
      fillCount++;
    }
  })();
  console.log(`✅ Step 1 完成：已填入 ${fillCount} 筆 base_name / variant`);

  // ── Step 2：找真重複（base_name 相似 >= 0.9 且 variant 相同）並合併 ──
  const fresh = db.prepare('SELECT id, name, base_name, variant, created_at FROM products WHERE is_active=1').all();

  const visited = new Set();
  const mergeGroups = []; // [{keep, discard[]}]

  for (let i = 0; i < fresh.length; i++) {
    if (visited.has(fresh[i].id)) continue;
    const group = [fresh[i]];
    visited.add(fresh[i].id);

    for (let j = i + 1; j < fresh.length; j++) {
      if (visited.has(fresh[j].id)) continue;
      const baseScore = similarity(fresh[i].base_name, fresh[j].base_name);
      const sameVariant = (fresh[i].variant ?? '').toLowerCase() === (fresh[j].variant ?? '').toLowerCase();
      if (baseScore >= 0.9 && sameVariant) {
        group.push(fresh[j]);
        visited.add(fresh[j].id);
      }
    }

    if (group.length > 1) {
      // 保留最早建立的那筆
      group.sort((a, b) => a.created_at.localeCompare(b.created_at));
      mergeGroups.push({ keep: group[0], discard: group.slice(1) });
    }
  }

  if (mergeGroups.length === 0) {
    console.log('✅ Step 2 完成：未發現真重複，無需合併');
  } else {
    const reassignPrices  = db.prepare('UPDATE price_records SET product_id=? WHERE product_id=?');
    const reassignUrls    = db.prepare('UPDATE product_urls SET product_id=? WHERE product_id=?');
    const reassignAlerts  = db.prepare('UPDATE alerts SET product_id=? WHERE product_id=?');
    const deleteProduct   = db.prepare('UPDATE products SET is_active=0 WHERE id=?');

    let mergedCount = 0;
    db.transaction(() => {
      for (const { keep, discard } of mergeGroups) {
        for (const d of discard) {
          reassignPrices.run(keep.id, d.id);
          reassignUrls.run(keep.id, d.id);
          reassignAlerts.run(keep.id, d.id);
          deleteProduct.run(d.id);
          console.log(`  合併：「${d.name}」→「${keep.name}」`);
          mergedCount++;
        }
      }
    })();
    console.log(`\n✅ Step 2 完成：合併了 ${mergedCount} 筆重複（軟刪除，is_active=0）`);
  }

  const remaining = db.prepare('SELECT COUNT(*) as c FROM products WHERE is_active=1').get();
  console.log(`\n🎉 清理完成！目前有效商品：${remaining.c} 筆\n`);
}

main().catch(err => {
  console.error('❌ 執行失敗：', err.message);
  process.exit(1);
});
