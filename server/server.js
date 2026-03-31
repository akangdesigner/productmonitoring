require('dotenv').config();
const app = require('./app');
const { initDB } = require('./db');
const { startScheduler } = require('./jobs/scheduledScrape');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  // 初始化資料庫
  await initDB();
  logger.info('資料庫初始化完成');

  // 啟動爬蟲排程
  startScheduler();
  logger.info('爬蟲排程已啟動');

  // 啟動 HTTP 伺服器
  const server = app.listen(PORT, () => {
    logger.info(`伺服器啟動於 http://localhost:${PORT}`);
  });

  // 優雅關閉
  process.on('SIGTERM', () => {
    logger.info('收到 SIGTERM，正在關閉...');
    server.close(() => {
      logger.info('伺服器已關閉');
      process.exit(0);
    });
  });
}

bootstrap().catch(err => {
  console.error('啟動失敗:', err);
  process.exit(1);
});
