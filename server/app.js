const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const app = express();

// ── Middlewares ──
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// ── 前端靜態檔案 ──
app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));

const authMiddleware = require('./middleware/authMiddleware');

// ── API 路由 ──
app.use('/api/auth',      require('./routes/auth'));           // 公開（無需登入）
app.use('/api',           authMiddleware);                     // 以下所有路由需登入
app.use('/api/products',  require('./routes/products'));
app.use('/api/prices',    require('./routes/prices'));
app.use('/api/gifts',     require('./routes/gifts'));
app.use('/api/alerts',    require('./routes/alerts'));
app.use('/api/scraper',   require('./routes/scraper'));
app.use('/api/line',      require('./routes/line'));
app.use('/api/dashboard',    require('./routes/dashboard'));
app.use('/api/my-products', require('./routes/clientProducts'));
app.use('/api/search',      require('./routes/search'));
app.use('/api/shopee-auth', require('./routes/shopeeAuth'));
app.use('/api/apify',           require('./routes/apify'));
app.use('/api/shopee-keywords', require('./routes/shopeeKeywords'));

// ── SPA Fallback（React Router 用）──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
});

// ── 全域錯誤處理 ──
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || '伺服器內部錯誤' });
});

module.exports = app;
