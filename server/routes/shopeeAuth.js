const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execSync } = require('child_process');
const Database = require('better-sqlite3');

const COOKIES_PATH = path.join(__dirname, '..', 'shopee_cookies.json');
const CHROME_DIR = path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data');

// 以共享模式複製鎖定中的檔案（Chrome 開著也可以）
function copyLockedFile(src, dst) {
  const script =
    `$src='${src.replace(/\\/g, '\\\\')}';` +
    `$dst='${dst.replace(/\\/g, '\\\\')}';` +
    `$fs=[System.IO.File]::Open($src,[System.IO.FileMode]::Open,[System.IO.FileAccess]::Read,[System.IO.FileShare]::ReadWrite);` +
    `$out=[System.IO.File]::Create($dst);` +
    `$fs.CopyTo($out);$fs.Close();$out.Close()`;
  execSync(`powershell -Command "${script}"`, { stdio: 'pipe' });
}

// 找所有有蝦皮 Cookie 的 Profile
function findShopeeProfile() {
  const profileNames = fs.readdirSync(CHROME_DIR).filter(n => {
    const p1 = path.join(CHROME_DIR, n, 'Network', 'Cookies');
    const p2 = path.join(CHROME_DIR, n, 'Cookies');
    return fs.existsSync(p1) || fs.existsSync(p2);
  });

  for (const name of profileNames) {
    const dbPath =
      fs.existsSync(path.join(CHROME_DIR, name, 'Network', 'Cookies'))
        ? path.join(CHROME_DIR, name, 'Network', 'Cookies')
        : path.join(CHROME_DIR, name, 'Cookies');

    const tempDb = path.join(os.tmpdir(), `shopee_scan_${Date.now()}.db`);
    try {
      copyLockedFile(dbPath, tempDb);
      const walSrc = dbPath + '-wal';
      if (fs.existsSync(walSrc)) copyLockedFile(walSrc, tempDb + '-wal');

      const db = new Database(tempDb, { readonly: true });
      const count = db.prepare("SELECT COUNT(*) as n FROM cookies WHERE host_key LIKE '%shopee%'").get();
      db.close();
      if (count.n > 0) return { profileName: name, dbPath, tempDb };
    } catch { /* 跳過讀不到的 */ }
    [tempDb, tempDb + '-wal'].forEach(f => { try { fs.unlinkSync(f); } catch {} });
  }
  return null;
}

// 從 Local State 取得並解密 Chrome master key
function getChromeMasterKey() {
  const localState = JSON.parse(
    fs.readFileSync(path.join(CHROME_DIR, 'Local State'), 'utf8')
  );
  // Base64 解碼後去掉前 5 bytes（"DPAPI" 標頭）
  const encryptedKey = Buffer.from(localState.os_crypt.encrypted_key, 'base64').slice(5);

  const tempIn  = path.join(os.tmpdir(), `ck_in_${Date.now()}.bin`);
  const tempOut = path.join(os.tmpdir(), `ck_out_${Date.now()}.bin`);
  fs.writeFileSync(tempIn, encryptedKey);

  // 用 PowerShell 的 DPAPI 解密
  execSync(
    `powershell -Command "` +
    `Add-Type -AssemblyName System.Security;` +
    `$b=[System.IO.File]::ReadAllBytes('${tempIn}');` +
    `$d=[System.Security.Cryptography.ProtectedData]::Unprotect($b,$null,'CurrentUser');` +
    `[System.IO.File]::WriteAllBytes('${tempOut}',$d)"`,
    { stdio: 'pipe' }
  );

  const masterKey = fs.readFileSync(tempOut);
  [tempIn, tempOut].forEach(f => { try { fs.unlinkSync(f); } catch {} });
  return masterKey;
}

// 解密單一 cookie 值（Chrome 80+ AES-256-GCM）
function decryptValue(encryptedValue, masterKey) {
  if (!encryptedValue || encryptedValue.length === 0) return '';
  const buf = Buffer.isBuffer(encryptedValue) ? encryptedValue : Buffer.from(encryptedValue);
  const prefix = buf.slice(0, 3).toString();
  if (prefix === 'v10' || prefix === 'v11') {
    try {
      const nonce      = buf.slice(3, 15);
      const tag        = buf.slice(-16);
      const ciphertext = buf.slice(15, -16);
      const decipher   = crypto.createDecipheriv('aes-256-gcm', masterKey, nonce);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    } catch { return ''; }
  }
  return buf.toString('utf8');
}

// GET /api/shopee-auth/status
router.get('/status', (req, res) => {
  if (!fs.existsSync(COOKIES_PATH)) return res.json({ connected: false });
  try {
    const data = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
    const savedAt   = data.savedAt ? new Date(data.savedAt) : null;
    const daysSince = savedAt ? Math.floor((Date.now() - savedAt) / 86400000) : null;
    res.json({ connected: true, savedAt: data.savedAt, daysSince });
  } catch {
    res.json({ connected: false });
  }
});

// GET /api/shopee-auth/debug — 診斷用
router.get('/debug', (req, res) => {
  const paths = [
    path.join(CHROME_DIR, 'Default', 'Network', 'Cookies'),
    path.join(CHROME_DIR, 'Default', 'Cookies'),
  ];
  const found = paths.map(p => ({ path: p, exists: fs.existsSync(p) }));
  const activeDb = paths.find(p => fs.existsSync(p));
  if (!activeDb) return res.json({ found, rows: 0 });

  const tempDb = path.join(os.tmpdir(), `shopee_dbg_${Date.now()}.db`);
  try {
    fs.copyFileSync(activeDb, tempDb);
    const walFile = activeDb + '-wal';
    if (fs.existsSync(walFile)) fs.copyFileSync(walFile, tempDb + '-wal');
    const db = new Database(tempDb, { readonly: true });
    const rows = db.prepare(`SELECT name, host_key, length(encrypted_value) as enc_len, length(value) as val_len FROM cookies WHERE host_key LIKE '%shopee%'`).all();
    db.close();

    let masterKeyLen = 0;
    try { masterKeyLen = getChromeMasterKey().length; } catch(e) { masterKeyLen = -1; }

    res.json({ found, activeDb, shopeeRows: rows.length, sample: rows.slice(0, 5), masterKeyLen });
  } catch (e) {
    res.json({ found, activeDb, error: e.message });
  } finally {
    [tempDb, tempDb + '-wal', tempDb + '-shm'].forEach(f => { try { fs.unlinkSync(f); } catch {} });
  }
});

// POST /api/shopee-auth/import — 自動掃描所有 Profile，Chrome 開著也可讀
router.post('/import', (req, res) => {
  const found = findShopeeProfile();
  if (!found) {
    return res.status(400).json({ ok: false, error: '在所有 Chrome 帳號中都找不到蝦皮 Cookie，請先用 Chrome 開啟 shopee.tw 瀏覽一下再試' });
  }

  const { profileName, tempDb } = found;
  try {
    const masterKey = getChromeMasterKey();
    const db = new Database(tempDb, { readonly: true });
    const rows = db.prepare(
      `SELECT name, value, host_key, path, expires_utc, is_secure, is_httponly, encrypted_value
       FROM cookies WHERE host_key LIKE '%shopee.tw%'`
    ).all();
    db.close();

    const cookies = rows.map(row => ({
      name:     row.name,
      value:    row.value || decryptValue(row.encrypted_value, masterKey),
      domain:   row.host_key,
      path:     row.path,
      expires:  row.expires_utc ? (row.expires_utc / 1000000 - 11644473600) : undefined,
      httpOnly: !!row.is_httponly,
      secure:   !!row.is_secure,
    })).filter(c => c.value);

    if (cookies.length === 0) {
      return res.status(400).json({ ok: false, error: `找到 ${profileName} 的蝦皮資料庫，但 Cookie 解密後為空，請重新整理 shopee.tw 再試` });
    }

    fs.writeFileSync(COOKIES_PATH, JSON.stringify({ cookies, savedAt: new Date().toISOString() }, null, 2));
    res.json({ ok: true, count: cookies.length, profile: profileName, message: `已從 Chrome ${profileName} 讀取 ${cookies.length} 個 Cookie，蝦皮爬蟲已就緒` });
  } catch (err) {
    res.status(500).json({ ok: false, error: `讀取失敗：${err.message}` });
  } finally {
    [tempDb, tempDb + '-wal', tempDb + '-shm'].forEach(f => { try { fs.unlinkSync(f); } catch {} });
  }
});

module.exports = router;
