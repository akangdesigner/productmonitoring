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
const SCHEDULE_FILE = path.join(__dirname, '../scraper-schedule.json');

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
    const current = loadSchedule(); // 每次觸發重新讀設定，確保取得最新 URL 清單
    const enabledUrls = current.urls.filter(u => u.enabled);
    logger.info(`[排程] 啟動分類頁爬取，共 ${enabledUrls.length} 個 URL`);

    for (const item of enabledUrls) {
      const db = getDB();
      const jobId = uuidv4();
      db.prepare('INSERT INTO scrape_jobs (id, platform, target_url) VALUES (?, ?, ?)').run(jobId, item.platform, item.url);

      try {
        const scraped = await scrapeCategoryPage(item.url, item.platform);
        const result  = await matchAndUpdate(scraped, item.platform);
        db.prepare(`UPDATE scrape_jobs SET status='success', products_scraped=?, finished_at=datetime('now','localtime') WHERE id=?`)
          .run(result.total, jobId);
        logger.info(`[排程] ${item.platform} 完成：新增 ${result.added}，更新 ${result.updated}，共 ${result.total} 筆`);
      } catch (err) {
        db.prepare(`UPDATE scrape_jobs SET status='failed', error_detail=?, finished_at=datetime('now','localtime') WHERE id=?`)
          .run(err.message, jobId);
        logger.error(`[排程] 爬取失敗 ${item.url}: ${err.message}`);
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

// ── 從商品名稱切出 base_name 與 variant ──
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

// ── Puppeteer 爬取分類頁 ──
async function scrapeCategoryPage(url, platform) {
  const puppeteer = require('puppeteer-extra');
  const StealthPlugin = require('puppeteer-extra-plugin-stealth');
  puppeteer.use(StealthPlugin());

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'],
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

          // 有些卡片會把「特價 + 原價」一起渲染成同一段文字，例如：NT$366,430
          // 規則：若 priceText 同時有兩個數字，視為「特價在前、原價在後」
          let price = numsPrice[0] ?? null;
          let origPrice = numsOrig[0] ?? null;
          if (!origPrice && numsPrice.length >= 2) origPrice = numsPrice[1];

          return { name, price, origPrice };
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
          return {
            name,
            price: extractFirstNum(priceText),
            origPrice: extractFirstNum(origText),
          };
        }).filter(p => p.name);
      });
    }

    if (platform === 'poya') {
      // POYA（91app）分類頁：DOM 結構可能常改，採「卡片文字抽數字」的耐變動策略
      try {
        await page.waitForSelector('a[href*="/SalePage/Index/"]', { timeout: 15000 });
      } catch {}

      return await page.evaluate(() => {
        const extractPrices = (text) => {
          if (!text) return [];
          // 只抓真正的「價格」：NT$xxx
          const matches = Array.from(text.matchAll(/NT\$\s*([\d,]+)/g)).map(m => m[1]);
          return matches
            .map(s => Number(String(s).replace(/,/g, '')))
            .filter(n => Number.isFinite(n) && n >= 10);
        };

        const pickNameFromText = (text) => {
          if (!text) return '';
          const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
          for (const l of lines) {
            if (l === '貨到通知') continue;
            if (/^NT\$\s*\d/.test(l)) continue;
            if (/^共\s*\d+\s*項商品/.test(l)) continue;
            // 避免把分類/排序等 UI 字串誤認成商品名
            if (l.length >= 3 && l.length <= 120) return l;
          }
          return '';
        };

        const cards = Array.from(document.querySelectorAll('a[href*="/SalePage/Index/"]'));

        return cards.map(card => {
          const text = card.innerText || '';
          const name = pickNameFromText(text);
          const prices = extractPrices(text);
          if (!name || prices.length === 0) return null;

          const min = Math.min(...prices);
          const max = Math.max(...prices);
          const price = Number.isFinite(min) ? min : null;
          const origPrice = (Number.isFinite(max) && max > min) ? max : null;

          return { name, price, origPrice };
        }).filter(Boolean);
      });
    }

    return [];
  } finally {
    await browser.close();
  }
}

// ── 比對 & 更新資料庫，回傳價格異動清單 ──
async function matchAndUpdate(scrapedProducts, platform) {
  const db = getDB();
  const existing = db.prepare('SELECT id, name, base_name, variant, brand FROM products').all();

  const insertPrice = db.prepare(`
    INSERT INTO price_records (id, product_id, platform, price, original_price, discount_label, in_stock)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);

  let added = 0, updated = 0;
  const priceChanges = [];
  const alertQueue = []; // 收集需要觸發警示的變動，transaction 外再處理

  db.transaction(() => {
    for (const item of scrapedProducts) {
      if (!item.price) continue;

      const itemBase    = extractBaseName(item.name);
      const itemVariant = extractVariant(item.name);

      // 兩階段比對：先比 base_name，再比 variant
      let best = null, bestScore = 0;
      for (const ep of existing) {
        const epBase = ep.base_name || extractBaseName(ep.name);
        const score  = similarity(itemBase, epBase);
        if (score > bestScore) { bestScore = score; best = ep; }
      }

      const bestVariant = best ? best.variant : null;
      const variantMatch = itemVariant === bestVariant ||
                           (itemVariant ?? '').toLowerCase() === (bestVariant ?? '').toLowerCase();

      if (bestScore >= 0.75 && best && variantMatch) {
        // 同商品同色號 → 更新價格
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
          updated++;
        }
      } else {
        // 新商品（或同系列不同色號）→ 新建
        const productId = uuidv4();
        db.prepare(`INSERT INTO products (id, name, base_name, variant, brand, category, emoji, is_active) VALUES (?,?,?,?,?,'唇膏','💄',1)`)
          .run(productId, item.name, itemBase, itemVariant, item.name.split(' ')[0]);
        insertPrice.run(uuidv4(), productId, platform, item.price, item.origPrice ?? null, null);
        existing.push({ id: productId, name: item.name, base_name: itemBase, variant: itemVariant });
        added++;
      }
    }
  })();

  // transaction 完成後再觸發警示（async 不能在 transaction 內）
  for (const { product, platform: pf, newPrice, oldPrice } of alertQueue) {
    await AlertService.checkPriceChange(product, pf, newPrice, oldPrice)
      .catch(err => logger.warn(`[排程] 警示觸發失敗: ${err.message}`));
  }

  return { total: scrapedProducts.length, added, updated, priceChanges };
}

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
    const result  = matchAndUpdate(scraped, platform);
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
