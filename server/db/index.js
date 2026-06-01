const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'beauty_monitor.sqlite');

let db;

function getDB() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

async function initDB() {
  const db = getDB();

  db.exec(`
    -- 商品主表
    CREATE TABLE IF NOT EXISTS products (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL DEFAULT '',
      name        TEXT NOT NULL,
      brand       TEXT,
      category    TEXT DEFAULT 'skincare',
      emoji       TEXT DEFAULT '✨',
      is_active   INTEGER DEFAULT 1,
      created_at  TEXT DEFAULT (datetime('now','localtime')),
      updated_at  TEXT DEFAULT (datetime('now','localtime'))
    );

    -- 各平台商品連結
    CREATE TABLE IF NOT EXISTS product_urls (
      id          TEXT PRIMARY KEY,
      product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      platform    TEXT NOT NULL CHECK(platform IN ('watsons','cosmed','poya','pchome')),
      url         TEXT NOT NULL,
      platform_sku TEXT,
      created_at  TEXT DEFAULT (datetime('now','localtime'))
    );

    -- 價格抓取記錄
    CREATE TABLE IF NOT EXISTS price_records (
      id             TEXT PRIMARY KEY,
      product_id     TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      platform       TEXT NOT NULL,
      price          REAL NOT NULL,
      original_price REAL,
      discount_label TEXT,
      in_stock       INTEGER DEFAULT 1,
      scraped_at     TEXT DEFAULT (datetime('now','localtime'))
    );

    -- 贈品記錄
    CREATE TABLE IF NOT EXISTS gift_records (
      id               TEXT PRIMARY KEY,
      product_id       TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      platform         TEXT NOT NULL,
      gift_description TEXT NOT NULL,
      gift_value       REAL,
      valid_from       TEXT,
      valid_until      TEXT,
      scraped_at       TEXT DEFAULT (datetime('now','localtime')),
      is_active        INTEGER DEFAULT 1
    );

    -- 警示記錄
    CREATE TABLE IF NOT EXISTS alerts (
      id          TEXT PRIMARY KEY,
      product_id  TEXT REFERENCES products(id) ON DELETE SET NULL,
      type        TEXT NOT NULL CHECK(type IN ('price_drop','gift_added','gift_removed','back_in_stock','price_surge')),
      platform    TEXT NOT NULL,
      title       TEXT NOT NULL,
      message     TEXT NOT NULL,
      old_value   TEXT,
      new_value   TEXT,
      is_read     INTEGER DEFAULT 0,
      line_sent   INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now','localtime'))
    );

    -- 爬蟲執行歷史
    CREATE TABLE IF NOT EXISTS scrape_jobs (
      id               TEXT PRIMARY KEY,
      platform         TEXT DEFAULT 'all',
      status           TEXT DEFAULT 'running' CHECK(status IN ('running','success','failed')),
      products_scraped INTEGER DEFAULT 0,
      errors_count     INTEGER DEFAULT 0,
      error_detail     TEXT,
      started_at       TEXT DEFAULT (datetime('now','localtime')),
      finished_at      TEXT
    );

    -- LINE 通知設定（每位使用者獨立一筆，以 google_sub 識別）
    CREATE TABLE IF NOT EXISTS line_settings (
      google_sub            TEXT PRIMARY KEY,
      channel_access_token  TEXT DEFAULT '',
      channel_secret        TEXT DEFAULT '',
      user_id               TEXT DEFAULT '',
      notify_price_drop     INTEGER DEFAULT 1,
      notify_gift_change    INTEGER DEFAULT 1,
      price_drop_threshold  REAL DEFAULT 5.0,
      daily_report_enabled  INTEGER DEFAULT 1,
      daily_report_time     TEXT DEFAULT '09:00',
      updated_at            TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  // ── 遷移：加入 user_id 欄位（Zeabur 既有 DB 用）──
  try { db.exec("ALTER TABLE products ADD COLUMN user_id TEXT NOT NULL DEFAULT ''") } catch {}
  try { db.exec("ALTER TABLE client_products ADD COLUMN user_id TEXT NOT NULL DEFAULT ''") } catch {}
  try { db.exec("ALTER TABLE shopee_keywords ADD COLUMN user_id TEXT NOT NULL DEFAULT ''") } catch {}

  // ── 遷移：移除 momo、加入 poya（product_urls 的 CHECK 需重建表） ──
  try {
    const row = db.prepare(`
      SELECT sql FROM sqlite_master
      WHERE type='table' AND name='product_urls'
    `).get();

    const ddl = row?.sql || '';
    const needsMigration = ddl.includes("'momo'") || !ddl.includes("'poya'");

    if (needsMigration) {
      db.transaction(() => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS product_urls_new (
            id           TEXT PRIMARY KEY,
            product_id   TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            platform     TEXT NOT NULL CHECK(platform IN ('watsons','cosmed','poya','pchome')),
            url          TEXT NOT NULL,
            platform_sku TEXT,
            created_at   TEXT DEFAULT (datetime('now','localtime'))
          );
        `);

        // momo 都是假的：直接不搬移 momo 資料
        db.exec(`
          INSERT INTO product_urls_new (id, product_id, platform, url, platform_sku, created_at)
          SELECT id, product_id, platform, url, platform_sku, created_at
          FROM product_urls
          WHERE platform != 'momo';
        `);

        db.exec('DROP TABLE product_urls;');
        db.exec('ALTER TABLE product_urls_new RENAME TO product_urls;');
      })();
    }
  } catch {
    // 遷移失敗時不阻斷啟動，後續可再手動處理
  }

  // ── 遷移：加入 base_name / variant 欄位 ──
  try { db.exec("ALTER TABLE products ADD COLUMN base_name TEXT") } catch {}
  try { db.exec("ALTER TABLE products ADD COLUMN variant TEXT") } catch {}

  // ── 遷移：加入 is_starred 欄位 ──
  try { db.exec("ALTER TABLE products ADD COLUMN is_starred INTEGER DEFAULT 0") } catch {}

  // ── 遷移：加入 image_url、own_price 欄位 ──
  try { db.exec("ALTER TABLE products ADD COLUMN image_url TEXT") } catch {}
  try { db.exec("ALTER TABLE products ADD COLUMN own_price REAL") } catch {}

  // ── 我的商品目錄（與競品監控完全獨立）──
  db.exec(`
    CREATE TABLE IF NOT EXISTS client_products (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL DEFAULT '',
      name       TEXT NOT NULL,
      brand      TEXT,
      category   TEXT DEFAULT 'skincare',
      image_url  TEXT,
      price      REAL,
      note       TEXT,
      is_active  INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  // ── 蝦皮關鍵字追蹤 ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS shopee_keywords (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL DEFAULT '',
      keyword       TEXT NOT NULL,
      max_products  INTEGER DEFAULT 30,
      enabled       INTEGER DEFAULT 1,
      schedule_type TEXT DEFAULT 'daily',
      last_run_at   TEXT,
      item_count    INTEGER DEFAULT 0,
      created_at    TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS shopee_results (
      id          TEXT PRIMARY KEY,
      keyword_id  TEXT NOT NULL REFERENCES shopee_keywords(id) ON DELETE CASCADE,
      run_at      TEXT DEFAULT (datetime('now','localtime')),
      item_count  INTEGER DEFAULT 0,
      items       TEXT DEFAULT '[]'
    );
  `);

  // 清理上次伺服器非正常關閉留下的 running 任務
  db.prepare("UPDATE scrape_jobs SET status='failed', error_detail='伺服器重啟，任務中斷', finished_at=datetime('now','localtime') WHERE status='running'").run();

  return db;
}

module.exports = { getDB, initDB };
