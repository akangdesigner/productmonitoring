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
      platform    TEXT NOT NULL CHECK(platform IN ('watsons','cosmed','momo','pchome')),
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

    -- LINE 通知設定（永遠只有 id=1 這一筆）
    CREATE TABLE IF NOT EXISTS line_settings (
      id                    INTEGER PRIMARY KEY DEFAULT 1,
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

    -- 確保 line_settings 有一筆預設資料
    INSERT OR IGNORE INTO line_settings (id) VALUES (1);
  `);

  return db;
}

module.exports = { getDB, initDB };
