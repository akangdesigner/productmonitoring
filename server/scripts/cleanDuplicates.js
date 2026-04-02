/**
 * 商品去重清洗腳本（Groq AI 語意辨識版）
 *
 * 策略：
 *  1. 從 DB 取出所有有效商品名稱
 *  2. 分批送給 Groq，請它判斷哪些是同系列商品（不同色號/規格但本質相同）
 *  3. 用 Union-Find 做遞移合併
 *  4. 預設 Dry-run，加 --apply 才真正寫入
 *
 * 執行方式：
 *   GROQ_API_KEY=xxxx node server/scripts/cleanDuplicates.js
 *   GROQ_API_KEY=xxxx node server/scripts/cleanDuplicates.js --apply
 */

const path = require('path');
process.env.DB_PATH = path.join(__dirname, '../db/beauty_monitor.sqlite');
const { getDB, initDB } = require('../db');
const Groq = require('groq-sdk');

const APPLY     = process.argv.includes('--apply');
const API_KEY   = process.env.GROQ_API_KEY;
const MODEL     = 'llama-3.3-70b-versatile';
const BATCH_SIZE = 60; // 每批最多幾筆商品

if (!API_KEY) {
  console.error('❌ 請設定環境變數 GROQ_API_KEY');
  console.error('   範例：GROQ_API_KEY=gsk_xxx node server/scripts/cleanDuplicates.js');
  process.exit(1);
}

const groq = new Groq({ apiKey: API_KEY });

// ── 產品類型偵測 ──
const PRODUCT_TYPES = ['唇泥', '唇釉', '唇彩', '唇露', '唇蜜', '唇凍', '唇蠟', '唇頰霜', '唇油', '唇筆', '唇線筆', '護唇膏', '潤唇膏', '唇膏', '口紅'];
function extractProductType(name) {
  for (const t of PRODUCT_TYPES) {
    if (name.includes(t)) return t;
  }
  return null;
}

// ── 品牌正規化（別名對照） ──
const BRAND_ALIASES = [
  { canonical: 'kate',       patterns: ['kate', 'KATE', '凱婷'] },
  { canonical: 'maybelline', patterns: ['maybelline', 'MAYBELLINE', '媚比琳', 'MAYBELLINE媚比琳', '媚比琳MAYBELLINE'] },
  { canonical: 'heme',       patterns: ['heme', 'HEME', '喜蜜', 'HEME 喜蜜'] },
  { canonical: 'nivea',      patterns: ['NIVEA', 'NIVEA妮維雅', '妮維雅'] },
  { canonical: 'vaseline',   patterns: ['Vaseline', 'vaseline', '凡士林', 'Vaseline凡士林'] },
  { canonical: 'mentholatum',patterns: ['Mentholatum', '曼秀雷敦', 'Mentholatum曼秀雷敦'] },
  { canonical: 'dhc',        patterns: ['DHC', 'DHC DHC'] },
  { canonical: 'clio',       patterns: ['CLIO', 'CLIO珂莉奧', '珂莉奧'] },
  { canonical: 'etude',      patterns: ['ETUDE', 'etude', '伊蒂之屋'] },
  { canonical: '3ce',        patterns: ['3CE', '3ce'] },
  { canonical: '1028',       patterns: ['1028'] },
  { canonical: 'oddism',     patterns: ['ODDism', 'ODDISM'] },
  { canonical: 'opera',      patterns: ['OPERA'] },
  { canonical: 'visee',      patterns: ['VISEE', 'visee'] },
  { canonical: 'sebamed',    patterns: ['Sebamed', 'Sebamed施巴', '施巴'] },
  { canonical: 'laka',       patterns: ['Laka', 'LAKA'] },
  { canonical: 'media',      patterns: ['media', 'media媚點', '媚點'] },
  { canonical: 'intoyou',    patterns: ['INTO YOU', 'INTOYOU', '心慕與你'] },
  { canonical: 'fresho2',    patterns: ['FRESHO2', 'FreshO2', 'fresho2'] },
  { canonical: 'ettusais',   patterns: ['ettusais', 'ettusais艾杜紗', '艾杜紗'] },
  { canonical: 'cezanne',    patterns: ['CEZANNE', 'cezanne'] },
  { canonical: '雪芙蘭',     patterns: ['雪芙蘭'] },
  { canonical: '艾森絲',     patterns: ['艾森絲'] },
  { canonical: '卡翠絲',     patterns: ['卡翠絲'] },
];
function normalizeBrand(nameOrBrand) {
  const text = (nameOrBrand || '').toLowerCase();
  for (const { canonical, patterns } of BRAND_ALIASES) {
    if (patterns.some(p => text.includes(p.toLowerCase()))) return canonical;
  }
  return text.split(/[\s_\-（(]/)[0]; // fallback：取第一個詞
}

// ── AI 結果過濾：產品類型 + 品牌都必須相同 ──
function filterGroupByRules(groupIndices, products) {
  if (groupIndices.length < 2) return groupIndices;
  const keep = groupIndices[0];
  const keepType  = extractProductType(products[keep].name);
  const keepBrand = normalizeBrand(products[keep].name);

  const valid = groupIndices.filter(i => {
    const type  = extractProductType(products[i].name);
    const brand = normalizeBrand(products[i].name);
    const sameType  = keepType === null || type === null || type === keepType;
    const sameBrand = keepBrand === brand;
    return sameType && sameBrand;
  });

  return valid.length >= 2 ? valid : [];
}

// ── Union-Find ──
class UnionFind {
  constructor(n) { this.parent = Array.from({ length: n }, (_, i) => i); }
  find(x) {
    if (this.parent[x] !== x) this.parent[x] = this.find(this.parent[x]);
    return this.parent[x];
  }
  union(x, y) {
    const px = this.find(x), py = this.find(y);
    if (px !== py) this.parent[px] = py;
  }
  groups(n) {
    const map = new Map();
    for (let i = 0; i < n; i++) {
      const root = this.find(i);
      if (!map.has(root)) map.set(root, []);
      map.get(root).push(i);
    }
    return [...map.values()].filter(g => g.length > 1);
  }
}

// ── 呼叫 Groq 判斷哪些商品是同系列 ──
async function detectDuplicatesWithAI(batch) {
  const numbered = batch.map((p, i) => `${i}: ${p.name}`).join('\n');

  const prompt = `你是美妝商品資料庫管理員。以下是從不同平台（屈臣氏、康是美、寶雅）爬取的商品名稱清單，編號 0 開始。

請找出「同一個產品系列」的商品（不同色號、不同容量規格、不同平台的同款商品都算）。
判斷標準：
- 品牌相同（包含中英文別名，如 KATE=凱婷、Vaseline=凡士林）
- 產品系列名稱相同（忽略色號、編號、容量、「多款任選」、「限定色」等後綴）
- 產品類型相同（唇膏≠唇釉、護唇膏≠口紅）

請只回傳 JSON 陣列，每個子陣列是同一系列的商品編號，不要包含任何說明文字：
範例格式：[[0,3,7],[1,5],[2,4,6]]
若無重複則回傳：[]

商品清單：
${numbered}`;

  try {
    const res = await groq.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 1024,
    });

    const text = res.choices[0]?.message?.content?.trim() || '[]';
    // 擷取第一個 JSON 陣列
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    return JSON.parse(match[0]);
  } catch (err) {
    console.error('  ⚠ AI 呼叫失敗：', err.message);
    return [];
  }
}

async function main() {
  await initDB();
  const db = getDB();

  const products = db.prepare(
    'SELECT id, name, brand, created_at FROM products WHERE is_active=1 ORDER BY name'
  ).all();
  const n = products.length;
  console.log(`\n共 ${n} 筆商品，開始 AI 語意辨識...\n`);

  const uf = new UnionFind(n);

  // 分批處理
  const batches = [];
  for (let i = 0; i < n; i += BATCH_SIZE) {
    batches.push({ start: i, items: products.slice(i, i + BATCH_SIZE) });
  }

  for (const [bi, { start, items }] of batches.entries()) {
    process.stdout.write(`  批次 ${bi + 1}/${batches.length}（商品 ${start + 1}~${start + items.length}）... `);
    const groups = await detectDuplicatesWithAI(items);
    let pairCount = 0;
    for (const rawGroup of groups) {
      if (!Array.isArray(rawGroup) || rawGroup.length < 2) continue;
      // 轉成全域 index
      const globalGroup = rawGroup.map(j => start + j).filter(gi => gi < n);
      // 規則過濾：同產品類型 + 同品牌
      const filtered = filterGroupByRules(globalGroup, products);
      if (filtered.length < 2) continue;
      for (let k = 1; k < filtered.length; k++) {
        uf.union(filtered[0], filtered[k]); pairCount++;
      }
    }
    console.log(`找到 ${groups.filter(g => g.length > 1).length} 組 → 過濾後保留 ${pairCount} 對`);
    // 避免 rate limit
    if (bi < batches.length - 1) await new Promise(r => setTimeout(r, 500));
  }

  // 跨批次補比對（取各批次代表商品再跑一次）
  if (batches.length > 1) {
    console.log('\n  跨批次補比對...');
    // 每批取第一筆作代表
    const repIndices = batches.map(b => b.start);
    const repProducts = repIndices.map(i => products[i]);
    const crossGroups = await detectDuplicatesWithAI(repProducts);
    for (const rawGroup of crossGroups) {
      if (!Array.isArray(rawGroup) || rawGroup.length < 2) continue;
      const globalGroup = rawGroup.map(j => repIndices[j]).filter(gi => gi !== undefined && gi < n);
      const filtered = filterGroupByRules(globalGroup, products);
      if (filtered.length < 2) continue;
      for (let k = 1; k < filtered.length; k++) {
        uf.union(filtered[0], filtered[k]);
      }
    }
  }

  const mergeGroups = uf.groups(n);

  if (mergeGroups.length === 0) {
    console.log('\n✅ 未發現重複商品，資料乾淨！\n');
    return;
  }

  console.log(`\n⚠️  發現 ${mergeGroups.length} 組重複商品：\n`);
  for (const [gi, group] of mergeGroups.entries()) {
    group.sort((a, b) => products[a].created_at.localeCompare(products[b].created_at));
    const keep = products[group[0]];
    const discard = group.slice(1).map(i => products[i]);
    console.log(`  ── 第 ${gi + 1} 組 ──`);
    console.log(`  [保留] ${keep.name}`);
    discard.forEach(d => console.log(`  [合併] ${d.name}`));
    console.log();
  }

  if (!APPLY) {
    console.log('── Dry-run 模式，未實際修改 ──');
    console.log('加上 --apply 參數執行實際合併：');
    console.log('  GROQ_API_KEY=xxx node server/scripts/cleanDuplicates.js --apply\n');
    return;
  }

  // ── 實際合併 ──
  const reassignPrices = db.prepare('UPDATE price_records SET product_id=? WHERE product_id=?');
  const reassignUrls   = db.prepare('UPDATE product_urls   SET product_id=? WHERE product_id=?');
  const reassignAlerts = db.prepare('UPDATE alerts          SET product_id=? WHERE product_id=?');
  const softDelete     = db.prepare('UPDATE products SET is_active=0 WHERE id=?');

  let mergedTotal = 0;
  db.transaction(() => {
    for (const group of mergeGroups) {
      group.sort((a, b) => products[a].created_at.localeCompare(products[b].created_at));
      const keepId = products[group[0]].id;
      for (const idx of group.slice(1)) {
        const discardId = products[idx].id;
        reassignPrices.run(keepId, discardId);
        reassignUrls.run(keepId, discardId);
        reassignAlerts.run(keepId, discardId);
        softDelete.run(discardId);
        mergedTotal++;
      }
    }
  })();

  const remaining = db.prepare('SELECT COUNT(*) as c FROM products WHERE is_active=1').get();
  console.log(`✅ 合併完成！共合併 ${mergedTotal} 筆，剩餘有效商品：${remaining.c} 筆\n`);
}

main().catch(err => {
  console.error('❌ 執行失敗：', err.message);
  process.exit(1);
});
