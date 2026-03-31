const { Client } = require('@line/bot-sdk');
const { getDB } = require('../db');
const logger = require('../utils/logger');

function getClient() {
  const db = getDB();
  const s = db.prepare('SELECT channel_access_token, channel_secret FROM line_settings WHERE id = 1').get();
  if (!s?.channel_access_token) return null;
  return new Client({ channelAccessToken: s.channel_access_token, channelSecret: s.channel_secret });
}

function getTargetUserId() {
  const db = getDB();
  const s = db.prepare('SELECT user_id FROM line_settings WHERE id = 1').get();
  return s?.user_id || null;
}

const LineService = {
  async sendAlert(message) {
    const client = getClient();
    const userId = getTargetUserId();
    if (!client || !userId) {
      logger.warn('[LINE] 未設定 Token 或 User ID，略過推播');
      return;
    }
    await client.pushMessage(userId, { type: 'text', text: message });
    logger.info('[LINE] 推播成功');
  },

  async sendDailyReport(products) {
    const client = getClient();
    const userId = getTargetUserId();
    if (!client || !userId) return;

    const db = getDB();
    const s = db.prepare('SELECT daily_report_enabled FROM line_settings WHERE id = 1').get();
    if (!s?.daily_report_enabled) return;

    const lines = ['📊 每日美妝競品早報\n'];
    products.forEach(p => {
      const minPrice = Math.min(p.watsons_price, p.cosmed_price, p.momo_price);
      lines.push(`• ${p.name}：最低 NT$${minPrice.toLocaleString()}`);
    });
    lines.push(`\n更新時間：${new Date().toLocaleString('zh-TW')}`);

    await client.pushMessage(userId, { type: 'text', text: lines.join('\n') });
    logger.info('[LINE] 每日早報推播完成');
  },

  async testConnection(token, userId) {
    const client = new Client({ channelAccessToken: token, channelSecret: '' });
    await client.pushMessage(userId, {
      type: 'text',
      text: '✅ 美妝競品監控台連線測試成功！您將在此收到降價警報與每日早報。'
    });
  }
};

module.exports = LineService;
