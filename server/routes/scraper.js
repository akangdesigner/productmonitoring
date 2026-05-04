const express  = require('express');
const router   = express.Router();
const fs       = require('fs');
const path     = require('path');
const cron     = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');
const { runScrapeJob } = require('../jobs/scheduledScrape');
const AlertService = require('../services/AlertService');
const logger = require('../utils/logger');

// ── 排程設定存檔路徑 ──
const SCHEDULE_FILE = path.join(__dirname, '../db/scraper-schedule.json');

function loadSchedule() {
  try {
    const raw = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
    if (!Array.isArray(raw.urls)) raw.urls = [];
    return raw;
  } catch {
    return { enabled: false, time: '03:00', days: 'daily', urls: [] };
  }
}

function saveSchedule(s) {
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(s, null, 2));
}

// ── DB 遷移：scrape_jobs 加入 target_url 欄位 ──
try {
  getDB().exec('ALTER TABLE scrape_jobs ADD COLUMN target_url TEXT');
} catch {}   // 欄位已存在時忽略

// ── days → cron 週幾格式 ──
function daysToCron(days) {
  const map = { daily: '*', weekdays: '1-5', 'mon-wed-fri': '1,3,5', weekly: '1' };
  return map[days] || '*';
}

// ── 當前排程任務 ──
let currentCronJob = null;

function applySchedule(s) {
  if (currentCronJob) { currentCronJob.stop(); currentCronJob = null; }
  if (!s.enabled || !s.urls?.length) return;
  const [hh, mm] = s.time.split(':');
  const expr = `${mm} ${hh} * * ${daysToCron(s.days)}`;
  currentCronJob = cron.schedule(expr, async () => {
    const current = loadSchedule();
    const enabledUrls = current.urls.filter(u => u.enabled);
    logger.info(`[排程] Phase 1：爬取 ${enabledUrls.length} 個 URL`);

    // Phase 1：全部爬完再做任何解析
    const jobs = [];
    for (const item of enabledUrls) {
      const db = getDB();
      const jobId = uuidv4();
      db.prepare('INSERT INTO scrape_jobs (id, platform, target_url) VALUES (?, ?, ?)').run(jobId, item.platform, item.url);
      try {
        const products = await scrapeCategoryPage(item.url, item.platform);
        jobs.push({ platform: item.platform, products, jobId });
        logger.info(`[排程] ${item.platform} 爬取完成，${products.length} 筆`);
      } catch (err) {
        getDB().prepare(`UPDATE scrape_jobs SET status='failed', error_detail=?, finished_at=datetime('now','localtime') WHERE id=?`)
          .run(err.message, jobId);
        logger.error(`[排程] 爬取失敗 ${item.url}: ${err.message}`);
      }
    }

    // Phase 2：合併所有商品名稱，一次送 AI 解析
    const allNames = [...new Set(jobs.flatMap(j => j.products.filter(p => p.price).map(p => p.name)))];
    logger.info(`[排程] Phase 2：AI 解析 ${allNames.length} 個名稱`);
    const sharedAiMap = await parseNamesWithAI(allNames);
    logger.info(`[排程] AI 解析完成，${sharedAiMap.size} 筆成功`);

    // Phase 3：逐平台比對寫入
    logger.info(`[排程] Phase 3：比對寫入資料庫`);
    for (const { platform, products, jobId } of jobs) {
      try {
        const result = await matchAndUpdate(products, platform, sharedAiMap);
        getDB().prepare(`UPDATE scrape_jobs SET status='success', products_scraped=?, finished_at=datetime('now','localtime') WHERE id=?`)
          .run(result.total, jobId);
        logger.info(`[排程] ${platform} 完成：新增 ${result.added}，更新 ${result.updated}，共 ${result.total} 筆`);
      } catch (err) {
        getDB().prepare(`UPDATE scrape_jobs SET status='failed', error_detail=?, finished_at=datetime('now','localtime') WHERE id=?`)
          .run(err.message, jobId);
        logger.error(`[排程] 寫入失敗 ${platform}: ${err.message}`);
      }
    }
  }, { timezone: 'Asia/Taipei' });
}

// 啟動時套用已儲存的排程
applySchedule(loadSchedule());

// ── 平台偵測 ──
function detectPlatform(url) {
  if (url.includes('watsons.com.tw')) return 'watsons';
  if (url.includes('cosmed.com.tw'))  return 'cosmed';
  if (url.includes('pchome.com.tw'))  return 'pchome';
  if (url.includes('poyabuy.com.tw')) return 'poya';
  return null;
}

const PLATFORM_LABEL = { watsons: '屈臣氏', cosmed: '康是美', pchome: 'PChome', poya: '寶雅' };

// ── 名稱比對工具 ──
function stripSpec(name) {
  return (name || '').replace(/[\d.]+\s*(ml|l(?![a-z])|g(?![a-z])|mg|kg|oz|抽|片|包|入|顆|條)\s*$/i, '').trim();
}

function normalizeName(name) {
  return name.toLowerCase()
    .replace(/maybelline|媚比琳/g, 'maybelline')
    .replace(/kate|凱婷/g, 'kate')
    .replace(/heme|喜蜜/g, 'heme')
    .replace(/\s+/g, ' ').trim();
}
function getTokens(name) {
  return normalizeName(name).split(/[\s\-_\/,，。【】（）()]+/)
    .filter(t => t.length > 1 && !/^\d+(\.\d+)?(g|ml|mg)$/.test(t));
}
function charOverlap(a, b) {
  const sA = new Set((a || '').replace(/\s+/g, '').toLowerCase());
  const sB = new Set((b || '').replace(/\s+/g, '').toLowerCase());
  const inter = [...sA].filter(c => sB.has(c)).length;
  const minLen = Math.min(sA.size, sB.size);
  return minLen > 0 ? inter / minLen : 0;
}
function similarity(a, b) {
  const sA = new Set(getTokens(a)), sB = new Set(getTokens(b));
  const inter = [...sA].filter(t => sB.has(t)).length;
  const minLen = Math.min(sA.size, sB.size);
  return minLen > 0 ? inter / minLen : 0;
}

// ── AI 批次解析商品名稱（Groq）──
// 回傳 Map<name, { baseName, brand, productType, variant }>
// 解析失敗的商品記錄 warn，不使用任何 fallback 表達式
const AI_BATCH_SIZE = 20; // 每批 20 筆，避免 8b 模型回傳截斷

async function parseNamesWithAI(names, model = 'llama-3.1-8b-instant') {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || names.length === 0) return new Map();

  const Groq = require('groq-sdk');
  const groq = new Groq({ apiKey });
  const result = new Map();

  const unique = [...new Set(names)];
  const batches = [];
  for (let i = 0; i < unique.length; i += AI_BATCH_SIZE) {
    batches.push(unique.slice(i, i + AI_BATCH_SIZE));
  }

  // 提示詞：要求 brand / productType / spec，baseName 由程式自組
  const PROMPT_HEADER = `你是電商數據清理專家。針對每筆商品名稱，回傳 brand（品牌）、productType（產品類別）和 spec（規格）。

規則：
- 去除【...】促銷標籤（如【即期品】【特惠】）
- 商品名稱開頭常出現「英文品牌 中文品牌 中文品牌」或「品牌 品牌」的重複格式（如 "KATE 凱婷 凱婷"、"MAYBELLINE 媚比琳 媚比琳"、"CEZANNE CEZANNE"），brand 只取英文或主要名稱一次，忽略後面的中文譯名與重複
- productType 只填核心品類（如「唇膏」「唇釉」「唇線筆」「洗髮精」），必須 ≥2 字，無法辨識填「商品」
- productType 中若含有系列名稱修飾詞（如「光誘恆吻唇膏」「怪獸級持色唇膏」「水嘟嘟蜜光潤唇膏」），只保留最後的核心品類詞（唇膏），去除前綴系列名
- spec 只填容量或數量規格（如 "3g"、"600ml"、"1.5g"、"3條"），找不到則填 ""
- spec 不要填色號：色號格式包括 "#01"、"No.3"、"G03"、"N 352"、"PK-1"、純數字編號（如 "18"、"352"）、英數混合碼（如 "RD301"）

範例輸入與輸出：
輸入：
0: KATE 凱婷 凱婷 怪獸級持色唇膏 18 3g
1: MAYBELLINE 媚比琳 媚比琳 水嘟嘟蜜光潤唇膏 07嘟嘟野莓 2.8g #保濕0唇紋
2: CEZANNE CEZANNE 修飾大師唇線筆 021-01 0.25G
3: DHC DHC 極潤護唇膏 1.5g
4: VISEE光誘恆吻唇膏 N 352
5: OPERA渲漾水色唇膏N-06玫紅 3.6g
輸出：
[{"i":0,"brand":"KATE","productType":"唇膏","spec":"3g"},{"i":1,"brand":"MAYBELLINE","productType":"唇膏","spec":"2.8g"},{"i":2,"brand":"CEZANNE","productType":"唇線筆","spec":"0.25g"},{"i":3,"brand":"DHC","productType":"護唇膏","spec":"1.5g"},{"i":4,"brand":"VISEE","productType":"唇膏","spec":""},{"i":5,"brand":"OPERA","productType":"唇膏","spec":"3.6g"}]

只回傳 JSON 陣列，不要其他文字。商品清單：`;

  for (const batch of batches) {
    let attempt = 0;
    while (attempt < 2) {
      try {
        const listed = batch.map((n, i) => `${i}: ${n}`).join('\n');
        const res = await groq.chat.completions.create({
          model,
          messages: [{ role: 'user', content: PROMPT_HEADER + '\n' + listed }],
          temperature: 0,
          max_tokens: 1500,
        });

        const text = res.choices[0]?.message?.content?.trim() || '[]';
        // 用括號深度計數，取出第一個完整的 [...] 避免模型附加說明文字造成 parse 錯誤
        const jsonStr = (() => {
          let depth = 0, start = -1;
          for (let i = 0; i < text.length; i++) {
            if (text[i] === '[') { if (start === -1) start = i; depth++; }
            else if (text[i] === ']') { if (--depth === 0 && start !== -1) return text.slice(start, i + 1); }
          }
          return null;
        })();
        if (!jsonStr) { logger.warn('[AI解析] 回傳非 JSON'); break; }

        const parsed = JSON.parse(jsonStr);
        parsed.forEach(p => {
          if (typeof p.i !== 'number' || p.i < 0 || p.i >= batch.length) return;
          if (!p.productType || p.productType.length <= 1) return;
          const originalName = batch[p.i];
          const brand = (p.brand || '').trim();
          const productType = (p.productType || '').trim();
          const rawSpec = (p.spec || '').trim().replace(/\s+/g, '');
          // 只接受帶單位的規格，且必須實際出現在商品名稱中（防止 AI 幻覺）
          const isValidUnit = /^[\d.]+\s*(ml|l|g|mg|kg|oz|抽|片|包|入|顆|條)$/i.test(rawSpec);
          const nameNorm = originalName.replace(/\s+/g, '').toLowerCase();
          const spec = (isValidUnit && nameNorm.includes(rawSpec.toLowerCase())) ? rawSpec : '';
          result.set(originalName, {
            brand,
            productType,
            baseName: spec ? `${brand}${productType}${spec}` : `${brand}${productType}`,
            variant: '',
          });
        });
        logger.info(`[AI解析] 批次 ${batch.length} 筆完成`);
        break;
      } catch (err) {
        attempt++;
        if (attempt >= 2) logger.warn(`[AI解析] 批次失敗（已重試）：${err.message}`);
      }
    }
  }

  return result;
}

// ── Puppeteer 爬取分類頁 ──
async function scrapeCategoryPage(url, platform) {
  const puppeteer = require('puppeteer-extra');
  const StealthPlugin = require('puppeteer-extra-plugin-stealth');
  puppeteer.use(StealthPlugin());
  const headlessEnv = (process.env.PUPPETEER_HEADLESS || "").toLowerCase();
  const headless =
    headlessEnv === "new"
      ? "new"
      : headlessEnv === "false"
      ? false
      : headlessEnv === "true"
      ? true
      : process.env.NODE_ENV === "production"
      ? "new"
      : false;

  const browser = await puppeteer.launch({
    headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--start-maximized'],
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1366, height: 768 });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));

    if (platform === 'watsons') {
      return await page.evaluate(() => {
        const extractNums = (text) => {
          if (!text) return [];
          const matches = text.match(/\d[\d,]*/g) || [];
          return matches
            .map(s => Number(String(s).replace(/,/g, '')))
            .filter(n => Number.isFinite(n) && n > 0);
        };

        return Array.from(document.querySelectorAll('.productContainer')).map(el => {
          const name = el.querySelector('.productName, .name')?.innerText?.trim() || '';

          const priceText = el.querySelector('.afterPromo-price, .productPrice')?.innerText?.trim() || '';
          const origText  = el.querySelector('.afPromo-originPrice, .productOriginalPrice')?.innerText?.trim() || '';

          const numsPrice = extractNums(priceText);
          const numsOrig  = extractNums(origText);

          let price = numsPrice[0] ?? null;
          let origPrice = numsOrig[0] ?? null;
          if (!origPrice && numsPrice.length >= 2) origPrice = numsPrice[1];

          // 跳過 badge/icon 圖，取第一張商品圖（src 包含 prodcat 或 publishing）
          const imgs = Array.from(el.querySelectorAll('img'));
          const prodImg = imgs.find(i => {
            const s = i.src || i.dataset?.src || '';
            return s.includes('prodcat') || s.includes('publishing');
          });
          const imageUrl = prodImg?.src || prodImg?.dataset?.src || '';
          const productUrl = el.querySelector('a[href]')?.href || '';

          return { name, price, origPrice, imageUrl, productUrl };
        }).filter(p => p.name);
      });
    }

    if (platform === 'cosmed') {
      let prev = 0;
      for (let i = 0; i < 15; i++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await new Promise(r => setTimeout(r, 1500));
        const cur = await page.evaluate(() => document.querySelectorAll('.product-card__vertical__wrapper').length);
        if (cur === prev) break;
        prev = cur;
      }
      return await page.evaluate(() => {
        const extractFirstNum = (text) => {
          if (!text) return null;
          const m = text.match(/\d[\d,]*/);
          if (!m) return null;
          const n = Number(String(m[0]).replace(/,/g, ''));
          return Number.isFinite(n) && n > 0 ? n : null;
        };

        return Array.from(document.querySelectorAll('.product-card__vertical__wrapper')).map(el => {
          const name = el.querySelector('[data-qe-id="body-sale-page-title-text"]')?.innerText?.trim() || '';
          const priceText = el.querySelector('[data-qe-id="body-price-text"]')?.innerText?.trim() || '';
          const origText  = el.querySelector('[data-qe-id="body-suggest-price-text"]')?.innerText?.trim() || '';
          const imgs = Array.from(el.querySelectorAll('img'));
          // 91app 商品圖 URL 含 SalePage，badge 含 ProductBadge
          const prodImg = imgs.find(i => (i.src || i.dataset?.src || '').includes('SalePage'))
            || imgs.find(i => !(i.src || i.dataset?.src || '').includes('Badge'))
            || imgs[0];
          const imageUrl = prodImg?.src || prodImg?.dataset?.src || '';
          const productUrl = el.closest('a[href]')?.href || el.querySelector('a[href]')?.href || '';
          return {
            name,
            price: extractFirstNum(priceText),
            origPrice: extractFirstNum(origText),
            imageUrl,
            productUrl,
          };
        }).filter(p => p.name);
      });
    }

    if (platform === 'poya') {
      // POYA（91app）分類頁：等待商品卡出現，支援多種 href 格式
      const POYA_CARD_SEL = 'a[href*="SalePage"]';
      try {
        await page.waitForSelector(POYA_CARD_SEL, { timeout: 20000 });
        // 觸發懶載入
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await new Promise(r => setTimeout(r, 1500));
      } catch {}

      return await page.evaluate(() => {
        const extractPrices = (text) => {
          if (!text) return [];
          // 支援 NT$xxx、$xxx、純數字（後接元或空白）
          const patterns = [
            /NT\$\s*([\d,]+)/g,
            /\$\s*([\d,]+)/g,
            /(\d[\d,]*)\s*元/g,
          ];
          const nums = [];
          for (const re of patterns) {
            for (const m of text.matchAll(re)) {
              const n = Number(m[1].replace(/,/g, ''));
              if (Number.isFinite(n) && n >= 10 && n < 100000) nums.push(n);
            }
          }
          return nums;
        };

        const pickNameFromText = (text) => {
          if (!text) return '';
          const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
          for (const l of lines) {
            if (l === '貨到通知') continue;
            if (/^(NT)?\$[\d,]/.test(l)) continue;
            if (/^共\s*\d+\s*項商品/.test(l)) continue;
            if (/^POYA|^寶雅|限定$|^限定|特賣|活動/.test(l) && l.length <= 10) continue;
            if (/^\d+$/.test(l)) continue;
            if (l.length >= 3 && l.length <= 120) return l;
          }
          return '';
        };

        const cards = Array.from(document.querySelectorAll('a[href*="SalePage"]'));
        // 去除重複 href
        const seen = new Set();
        const unique = cards.filter(c => {
          const h = c.getAttribute('href');
          if (seen.has(h)) return false;
          seen.add(h);
          return true;
        });

        return unique.map(card => {
          const text = card.innerText || '';
          const name = pickNameFromText(text);
          const prices = extractPrices(text);
          if (!name || prices.length === 0) return null;

          const min = Math.min(...prices);
          const max = Math.max(...prices);
          const price = Number.isFinite(min) ? min : null;
          const origPrice = (Number.isFinite(max) && max > min) ? max : null;

          const imgs = Array.from(card.querySelectorAll('img'));
          const prodImg = imgs.find(i => (i.src || i.dataset?.src || '').includes('SalePage'))
            || imgs.find(i => !(i.src || i.dataset?.src || '').includes('Badge'))
            || imgs[0];
          const imageUrl = prodImg?.src || prodImg?.dataset?.src || '';
          const productUrl = card.href || '';
          return { name, price, origPrice, imageUrl, productUrl };
        }).filter(Boolean);
      });
    }

    return [];
  } finally {
    await browser.close();
  }
}

// ── 語義備援：用 llama-3.3-70b-versatile 比對跨平台辨識失敗的商品 ──
// 回傳 Map<item.name, existingProduct>，只包含成功比對的項目
async function semanticFallback(unmatchedItems, existingProducts) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || unmatchedItems.length === 0) return new Map();

  const Groq = require('groq-sdk');
  const groq = new Groq({ apiKey });
  const result = new Map();

  // 為每個 item 準備候選清單（brand 相同 OR 字元重疊度 > 0.2，最多 8 筆）
  const tasks = [];
  for (const { item, itemBase, parsed } of unmatchedItems) {
    const brand = (parsed?.brand || '').toLowerCase().trim();
    const candidates = existingProducts.filter(ep => {
      const epBrand = (ep.brand || '').toLowerCase().trim();
      if (brand && epBrand && epBrand === brand) return true;
      return charOverlap(itemBase, ep.base_name || ep.name) > 0.2;
    }).slice(0, 8);
    if (candidates.length > 0) tasks.push({ item, itemBase, itemVariant: parsed?.variant || '', candidates });
  }

  if (tasks.length === 0) return result;
  logger.info(`[語義備援] ${tasks.length} 筆商品送 llama-3.3-70b-versatile 比對`);

  const BATCH = 8;
  for (let i = 0; i < tasks.length; i += BATCH) {
    const batch = tasks.slice(i, i + BATCH);

    const itemsDesc = batch.map((t, idx) =>
      `待比對[${idx}]：「${t.itemBase}」variant="${t.itemVariant}"（原始：${t.item.name.slice(0, 40)}）`
    ).join('\n');

    const candsDesc = batch.map((t, idx) =>
      `待比對[${idx}] 候選：\n` +
      t.candidates.map((ep, ci) =>
        `  ${ci}: base_name="${ep.base_name || ep.name}"  brand="${ep.brand || ''}"  variant="${ep.variant || ''}"`
      ).join('\n')
    ).join('\n\n');

    const prompt =
`你是電商商品比對專家。判斷每筆「待比對」商品是否與其候選清單中某筆為同一商品。
同一商品定義：相同品牌 + 相同產品類型 + 相同規格（variant）。
重要規則：
- variant 不同（色號、顏色、香味、尺寸等）→ 視為不同商品，回傳 null
- 待比對 variant 非空、候選 variant 非空，且兩者明顯不同 → 回傳 null
- 待比對 variant 為空時，可接受候選 variant 為空的項目；但若候選都有具體 variant，則回傳 null

${itemsDesc}

${candsDesc}

回傳 JSON 陣列，每筆對應一個待比對，match 填候選 index（整數）或 null：
範例：[{"i":0,"match":2},{"i":1,"match":null}]
只回傳 JSON，不要其他文字。`;

    let attempt = 0;
    while (attempt < 2) {
      try {
        const res = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0,
          max_tokens: 300,
        });
        const text = res.choices[0]?.message?.content?.trim() || '[]';
        const jsonStr = (() => {
          let depth = 0, start = -1;
          for (let ci = 0; ci < text.length; ci++) {
            if (text[ci] === '[') { if (start === -1) start = ci; depth++; }
            else if (text[ci] === ']') { if (--depth === 0 && start !== -1) return text.slice(start, ci + 1); }
          }
          return null;
        })();
        if (!jsonStr) { logger.warn('[語義備援] 回傳非 JSON，跳過此批次'); break; }

        const entries = JSON.parse(jsonStr);
        for (const entry of entries) {
          if (typeof entry.i !== 'number' || entry.i < 0 || entry.i >= batch.length) continue;
          if (entry.match === null || entry.match === undefined) continue;
          const mi = parseInt(entry.match, 10);
          const task = batch[entry.i];
          if (isNaN(mi) || mi < 0 || mi >= task.candidates.length) continue;
          const matched = task.candidates[mi];
          result.set(task.item.name, matched);
          logger.info(`[語義備援] 命中：${task.item.name.slice(0, 30)} → ${(matched.base_name || matched.name).slice(0, 30)}`);
        }
        break;
      } catch (err) {
        attempt++;
        if (attempt >= 2) logger.warn(`[語義備援] 批次失敗：${err.message}`);
      }
    }
  }

  return result;
}

// ── 比對 & 更新資料庫，回傳價格異動清單 ──
// sharedAiMap：批次模式下由外部預先建立並傳入，避免各平台重複呼叫 AI
async function matchAndUpdate(scrapedProducts, platform, sharedAiMap = null) {
  const db = getDB();
  const existing = db.prepare('SELECT id, name, base_name, variant, brand FROM products').all();

  const validProducts = scrapedProducts.filter(p => p.price);
  const aiMap = sharedAiMap ?? await parseNamesWithAI(validProducts.map(p => p.name));

  // Layer 0：建立 URL → product_id 對照表，同平台重爬快速通道
  const urlRows = db.prepare('SELECT url, product_id FROM product_urls').all();
  const urlMap  = new Map(urlRows.map(r => [r.url, r.product_id]));

  // ── 預先計算每個商品的比對決策（所有 async 都在 transaction 前完成）──
  // matchPlan: Map<item.name, { type: 'match'|'new', product?, parsed, itemBase, itemVariant }>
  const matchPlan      = new Map();
  const unmatchedItems = [];   // 全部非 URL 命中的商品，皆送 AI 比對

  for (const item of validProducts) {
    const parsed      = aiMap.get(item.name);
    if (!parsed) logger.warn(`[AI解析] 未解析：${item.name.slice(0, 40)}`);
    const itemBase    = parsed?.baseName || item.name;
    const itemVariant = parsed?.variant  || null;

    // Layer 0: URL 完全比對（最快、零 AI 費用）
    if (item.productUrl && urlMap.has(item.productUrl)) {
      const epRecord = existing.find(ep => ep.id === urlMap.get(item.productUrl));
      if (epRecord) {
        matchPlan.set(item.name, { type: 'match', product: epRecord, parsed, itemBase, itemVariant });
        continue;
      }
    }

    // 其餘全部交給 AI 語義比對
    unmatchedItems.push({ item, parsed, itemBase, itemVariant });
  }

  // AI 語義比對（llama-3.3-70b-versatile）— 所有非 URL 命中的商品
  const semanticMap = unmatchedItems.length > 0
    ? await semanticFallback(unmatchedItems, existing)
    : new Map();

  for (const { item, parsed, itemBase, itemVariant } of unmatchedItems) {
    const matched = semanticMap.get(item.name);
    matchPlan.set(item.name, matched
      ? { type: 'match', product: matched, parsed, itemBase, itemVariant }
      : { type: 'new',   parsed, itemBase, itemVariant }
    );
  }

  // ── 執行 transaction（所有決策已定，只做 DB 寫入）──
  const insertPrice = db.prepare(`
    INSERT INTO price_records (id, product_id, platform, price, original_price, discount_label, in_stock)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);

  let added = 0, updated = 0;
  const priceChanges = [];
  const alertQueue   = [];
  const addedThisRun = new Set();

  db.transaction(() => {
    for (const item of validProducts) {
      const plan = matchPlan.get(item.name);
      if (!plan) continue;

      if (plan.type === 'match') {
        const best = plan.product;
        // 同一次爬蟲中，同一 product_id 只處理第一次匹配，避免不同規格覆蓋價格造成誤判
        if (addedThisRun.has(best.id)) continue;
        addedThisRun.add(best.id);

        // 若舊 base_name 等於 name（代表當初未解析），用本次 AI 結果補上
        if (best.base_name === best.name && plan.parsed?.baseName && plan.parsed.baseName !== best.name) {
          db.prepare('UPDATE products SET base_name=?, brand=?, variant=? WHERE id=?')
            .run(plan.parsed.baseName, plan.parsed.brand || best.brand || '', plan.itemVariant || '', best.id);
        }

        const latest = db.prepare(`SELECT price FROM price_records WHERE product_id=? AND platform=? ORDER BY scraped_at DESC LIMIT 1`).get(best.id, platform);
        if (latest && latest.price !== item.price) {
          insertPrice.run(uuidv4(), best.id, platform, item.price, item.origPrice ?? null, null);
          const diff = item.price - latest.price;
          const pct  = ((diff / latest.price) * 100).toFixed(1);
          priceChanges.push(`${item.name.slice(0,25)} $${latest.price}→$${item.price}（${diff>0?'+':''}${pct}%）`);
          alertQueue.push({ product: { id: best.id, name: best.name, brand: best.brand || '' }, platform, newPrice: item.price, oldPrice: latest.price });
          updated++;
        } else if (!latest) {
          insertPrice.run(uuidv4(), best.id, platform, item.price, item.origPrice ?? null, null);
          added++;   // 此平台第一筆價格記錄 = 新增資料，非價格異動
        }
        if (item.productUrl) {
          const existingUrl = db.prepare('SELECT id FROM product_urls WHERE product_id=? AND platform=?').get(best.id, platform);
          if (existingUrl) {
            db.prepare('UPDATE product_urls SET url=? WHERE id=?').run(item.productUrl, existingUrl.id);
          } else {
            db.prepare('INSERT INTO product_urls (id, product_id, platform, url) VALUES (?,?,?,?)').run(uuidv4(), best.id, platform, item.productUrl);
          }
        }
      } else {
        // type === 'new'
        const { parsed, itemBase, itemVariant } = plan;
        const productId = uuidv4();
        db.prepare(`INSERT INTO products (id, name, base_name, variant, brand, category, emoji, image_url, is_active) VALUES (?,?,?,?,?,'唇膏','💄',?,1)`)
          .run(productId, item.name, itemBase, itemVariant, parsed?.brand || '', item.imageUrl || null);
        insertPrice.run(uuidv4(), productId, platform, item.price, item.origPrice ?? null, null);
        if (item.productUrl) {
          db.prepare('INSERT INTO product_urls (id, product_id, platform, url) VALUES (?,?,?,?)').run(uuidv4(), productId, platform, item.productUrl);
        }
        existing.push({ id: productId, name: item.name, base_name: itemBase, variant: itemVariant });
        addedThisRun.add(productId);
        added++;
      }
    }
  })();

  // transaction 完成後再觸發警示（async 不能在 transaction 內）
  for (const { product, platform: pf, newPrice, oldPrice } of alertQueue) {
    await AlertService.checkPriceChange(product, pf, newPrice, oldPrice)
      .catch(err => logger.warn(`[排程] 警示觸發失敗: ${err.message}`));
  }

  // 自動補救：新插入商品若 base_name 仍等於 name，立刻重跑 GROQ 解析
  const db2 = getDB();
  const unresolved = [...addedThisRun].map(id =>
    db2.prepare('SELECT id, name FROM products WHERE id=? AND base_name=name').get(id)
  ).filter(Boolean);

  if (unresolved.length > 0) {
    logger.info(`[補救] 發現 ${unresolved.length} 筆未解析商品，重新送 AI 解析`);
    const fixMap = await parseNamesWithAI(unresolved.map(r => r.name));
    const fixStmt = db2.prepare('UPDATE products SET base_name=? WHERE id=?');
    for (const row of unresolved) {
      const p = fixMap.get(row.name);
      if (p?.baseName && p.baseName !== row.name) {
        fixStmt.run(p.baseName, row.id);
        logger.info(`[補救] ${row.name.slice(0, 30)} → ${p.baseName}`);
      }
    }
  }

  return { total: scrapedProducts.length, added, updated, priceChanges };
}

// ═══════════════════════════════════════════════════════
//  診斷 API
// ═══════════════════════════════════════════════════════

// GET /api/scraper/test-ai — 測試 GROQ 連線，並用 DB 前 3 筆商品實測解析
router.get('/test-ai', async (req, res) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.json({ ok: false, reason: 'GROQ_API_KEY 未設定' });

  try {
    const Groq = require('groq-sdk');
    const groq = new Groq({ apiKey });

    // 從 DB 取前 3 筆實際商品名稱來測試
    const db = getDB();
    const sampleRows = db.prepare('SELECT name FROM products LIMIT 3').all();
    const sampleNames = sampleRows.map(r => r.name);
    const listed = sampleNames.map((n, i) => `${i}: ${n}`).join('\n');

    const result = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: `只回傳 JSON 陣列，格式 [{"i":0,"brand":"","productType":"","spec":""}]，商品清單：\n${listed}` }],
      temperature: 0,
      max_tokens: 300,
    });
    const text = result.choices[0]?.message?.content || '';
    res.json({ ok: true, keyPrefix: apiKey.slice(0, 10) + '...', sampleNames, rawResponse: text });
  } catch (err) {
    res.json({ ok: false, reason: err.message });
  }
});

// POST /api/scraper/reparse — 重新解析所有 base_name=name 的商品（不重爬，同步等待結果）
router.post('/reparse', async (req, res) => {
  const db = getDB();
  const unresolved = db.prepare("SELECT id, name FROM products WHERE base_name = name OR base_name IS NULL").all();
  if (unresolved.length === 0) return res.json({ ok: true, updated: 0, message: '沒有需要補解析的商品' });

  try {
    const fixMap = await parseNamesWithAI(unresolved.map(r => r.name));
    const fixStmt = db.prepare('UPDATE products SET base_name=?, brand=?, variant=? WHERE id=?');
    const samples = [];
    let count = 0;
    for (const row of unresolved) {
      const p = fixMap.get(row.name);
      if (p?.baseName && p.baseName !== row.name) {
        fixStmt.run(p.baseName, p.brand || '', p.variant || '', row.id);
        if (samples.length < 5) samples.push({ from: row.name.slice(0, 30), to: p.baseName });
        count++;
      }
    }
    logger.info(`[reparse] 完成：${count}/${unresolved.length} 筆成功解析`);
    res.json({ ok: true, total: unresolved.length, updated: count, aiMapSize: fixMap.size, samples });
  } catch (err) {
    logger.error(`[reparse] 失敗：${err.message}`);
    res.json({ ok: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════
//  URL 管理 API
// ═══════════════════════════════════════════════════════

// GET /api/scraper/urls — 取得所有監控網址
router.get('/urls', (req, res) => {
  res.json(loadSchedule().urls || []);
});

// POST /api/scraper/urls — 新增監控網址
router.post('/urls', (req, res) => {
  const { url, label } = req.body;
  if (!url) return res.status(400).json({ error: 'URL 必填' });
  const platform = detectPlatform(url);
  if (!platform) return res.status(400).json({ error: '不支援的平台（目前支援屈臣氏、康是美、寶雅）' });

  const s = loadSchedule();
  const newEntry = {
    id:       uuidv4(),
    url,
    platform,
    label:    label || `${PLATFORM_LABEL[platform]} ${new Date().toLocaleDateString('zh-TW')}`,
    enabled:  true,
    addedAt:  new Date().toISOString(),
  };
  s.urls.push(newEntry);
  saveSchedule(s);
  applySchedule(s);
  res.status(201).json(newEntry);
});

// PATCH /api/scraper/urls/:id — 切換啟用/停用、更新名稱或網址
router.patch('/urls/:id', (req, res) => {
  const s = loadSchedule();
  const entry = s.urls.find(u => u.id === req.params.id);
  if (!entry) return res.status(404).json({ error: '找不到此 URL' });
  entry.enabled = req.body.enabled !== undefined ? !!req.body.enabled : !entry.enabled;
  if (req.body.label !== undefined) entry.label = req.body.label;
  if (req.body.url !== undefined) {
    const newPlatform = detectPlatform(req.body.url);
    if (!newPlatform) return res.status(400).json({ error: '無法辨識平台（支援屈臣氏、康是美、寶雅）' });
    entry.url = req.body.url;
    entry.platform = newPlatform;
  }
  saveSchedule(s);
  applySchedule(s);
  res.json(entry);
});

// DELETE /api/scraper/urls — 清除全部監控網址
router.delete('/urls', (req, res) => {
  const s = loadSchedule();
  s.urls = [];
  saveSchedule(s);
  applySchedule(s);
  res.json({ ok: true });
});

// DELETE /api/scraper/urls/:id — 刪除監控網址
router.delete('/urls/:id', (req, res) => {
  const s = loadSchedule();
  const before = s.urls.length;
  s.urls = s.urls.filter(u => u.id !== req.params.id);
  if (s.urls.length === before) return res.status(404).json({ error: '找不到此 URL' });
  saveSchedule(s);
  applySchedule(s);
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════
//  排程設定 API
// ═══════════════════════════════════════════════════════

// GET /api/scraper/schedule
router.get('/schedule', (req, res) => {
  const s = loadSchedule();
  res.json({ enabled: s.enabled, time: s.time, days: s.days, urls: s.urls });
});

// PUT /api/scraper/schedule
router.put('/schedule', (req, res) => {
  const s = loadSchedule();
  s.enabled = !!req.body.enabled;
  s.time    = req.body.time  || s.time  || '03:00';
  s.days    = req.body.days  || s.days  || 'daily';
  saveSchedule(s);
  applySchedule(s);
  res.json({ ok: true, enabled: s.enabled, time: s.time, days: s.days });
});

// ═══════════════════════════════════════════════════════
//  手動執行 API
// ═══════════════════════════════════════════════════════

// POST /api/scraper/url — 指定 URL 立即執行
router.post('/url', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL 必填' });
  const platform = detectPlatform(url);
  if (!platform) return res.status(400).json({ error: '不支援的平台網址' });

  const db    = getDB();
  const jobId = uuidv4();
  db.prepare(`INSERT INTO scrape_jobs (id, platform, status, target_url) VALUES (?, ?, 'running', ?)`).run(jobId, platform, url);

  try {
    const scraped = await scrapeCategoryPage(url, platform);
    const result  = await matchAndUpdate(scraped, platform);
    db.prepare(`UPDATE scrape_jobs SET status='success', products_scraped=?, finished_at=datetime('now','localtime') WHERE id=?`)
      .run(result.total, jobId);
    res.json(result);
  } catch (err) {
    db.prepare(`UPDATE scrape_jobs SET status='failed', error_detail=?, finished_at=datetime('now','localtime') WHERE id=?`)
      .run(err.message, jobId);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/scraper/run
router.post('/run', async (req, res) => {
  try { res.json(await runScrapeJob('all')); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/scraper/run/:platform
router.post('/run/:platform', async (req, res) => {
  const { platform } = req.params;
  if (!['watsons','cosmed','poya','pchome'].includes(platform))
    return res.status(400).json({ error: '未知平台' });
  try { res.json(await runScrapeJob(platform)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── 批次執行所有已啟用的監控網址（背景任務）──
// 三段式：Phase 1 全部爬完 → Phase 2 合併 AI 解析 → Phase 3 逐平台寫入
async function runBatchScrapeJob() {
  const current = loadSchedule();
  const enabledUrls = current.urls.filter(u => u.enabled);
  if (!enabledUrls.length) return { total: 0, results: [] };

  // Phase 1：全部平台爬取完畢再繼續
  logger.info(`[批次] Phase 1：爬取 ${enabledUrls.length} 個網址`);
  const jobs = [];
  for (const item of enabledUrls) {
    const jobId = uuidv4();
    getDB().prepare(`INSERT INTO scrape_jobs (id, platform, status, target_url) VALUES (?, ?, 'running', ?)`).run(jobId, item.platform, item.url);
    try {
      const products = await scrapeCategoryPage(item.url, item.platform);
      jobs.push({ jobId, platform: item.platform, label: item.label, products });
      logger.info(`[批次] ${item.platform} 爬取完成，${products.length} 筆`);
    } catch (err) {
      getDB().prepare(`UPDATE scrape_jobs SET status='failed', error_detail=?, finished_at=datetime('now','localtime') WHERE id=?`).run(err.message, jobId);
      logger.error(`[批次] 爬取失敗 ${item.url}: ${err.message}`);
    }
  }

  // Phase 2：所有平台的商品名稱合併，一次送 AI 解析
  const allNames = [...new Set(jobs.flatMap(j => j.products.filter(p => p.price).map(p => p.name)))];
  logger.info(`[批次] Phase 2：AI 解析 ${allNames.length} 個不重複名稱`);
  const sharedAiMap = await parseNamesWithAI(allNames);
  logger.info(`[批次] AI 解析完成，${sharedAiMap.size} 筆成功`);

  // Phase 3：逐平台比對分類寫入
  logger.info(`[批次] Phase 3：比對寫入資料庫`);
  const results = [];
  for (const { jobId, platform, label, products } of jobs) {
    try {
      const result = await matchAndUpdate(products, platform, sharedAiMap);
      getDB().prepare(`UPDATE scrape_jobs SET status='success', products_scraped=?, finished_at=datetime('now','localtime') WHERE id=?`).run(result.total, jobId);
      results.push({ platform, label, status: 'success', total: result.total, added: result.added, updated: result.updated });
      logger.info(`[批次] ${platform} 完成：新增 ${result.added}，更新 ${result.updated}`);
    } catch (err) {
      getDB().prepare(`UPDATE scrape_jobs SET status='failed', error_detail=?, finished_at=datetime('now','localtime') WHERE id=?`).run(err.message, jobId);
      results.push({ platform, label, status: 'failed', error: err.message });
    }
  }

  return { total: enabledUrls.length, success: results.filter(r => r.status === 'success').length, failed: results.filter(r => r.status === 'failed').length, results };
}

// POST /api/scraper/run-enabled — 啟動批次背景抓取
router.post('/run-enabled', (req, res) => {
  const current = loadSchedule();
  const enabledUrls = current.urls.filter(u => u.enabled);
  if (!enabledUrls.length) return res.status(400).json({ error: '尚無已啟用的監控網址' });

  // 立即回傳，背景執行
  runBatchScrapeJob()
    .then(data => logger.info(`[批次抓取] 完成：成功 ${data.success} / 失敗 ${data.failed}`))
    .catch(err => logger.error(`[批次抓取] 發生非預期錯誤: ${err.message}`));

  res.json({ message: '批次抓取已啟動，請稍後查看歷史紀錄或狀態', count: enabledUrls.length });
});

// GET /api/scraper/status
router.get('/status', (req, res) => {
  const db = getDB();
  const running = db.prepare(`SELECT * FROM scrape_jobs WHERE status='running' ORDER BY started_at DESC LIMIT 1`).get();
  res.json({ status: running ? 'running' : 'idle', currentJob: running || null });
});

// GET /api/scraper/history
router.get('/history', (req, res) => {
  const db = getDB();
  const { limit = 30 } = req.query;
  res.json(db.prepare('SELECT * FROM scrape_jobs ORDER BY started_at DESC LIMIT ?').all(parseInt(limit)));
});

// POST /api/scraper/category/watsons（舊路由保留）
router.post('/category/watsons', async (req, res) => {
  const { baseUrl, pages = 9, saveToDb = false } = req.body;
  const defaultUrl = 'https://www.watsons.com.tw/%E5%8C%96%E5%A6%9D%E5%93%81/%E5%94%87%E8%86%8F/c/10440301?q=:bestSeller';
  const targetUrl  = (baseUrl || defaultUrl).replace(/&currentPage=\d+$/, '');
  const WatsonsScraper = require('../scrapers/WatsonsScraper');
  const scraper = new WatsonsScraper();
  try {
    const products = await scraper.scrapeCategory(targetUrl, parseInt(pages));
    if (saveToDb && products.length > 0) {
      const db = getDB(); let saved = 0;
      for (const p of products) {
        if (!p.productUrl) continue;
        if (db.prepare('SELECT id FROM product_urls WHERE url=?').get(p.productUrl)) continue;
        const pid = uuidv4();
        db.prepare('INSERT INTO products (id,name,brand,category,emoji) VALUES (?,?,?,?,?)').run(pid,p.name,'屈臣氏','makeup','💄');
        db.prepare('INSERT INTO product_urls (id,product_id,platform,url) VALUES (?,?,?,?)').run(uuidv4(),pid,'watsons',p.productUrl);
        if (p.price) db.prepare('INSERT INTO price_records (id,product_id,platform,price,original_price) VALUES (?,?,?,?,?)').run(uuidv4(),pid,'watsons',p.price,p.originalPrice||null);
        saved++;
      }
      return res.json({ total: products.length, saved, products });
    }
    res.json({ total: products.length, products });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
module.exports.scrapeCategoryPage = scrapeCategoryPage;
module.exports.parseNamesWithAI   = parseNamesWithAI;
module.exports.normalizeName      = normalizeName;
