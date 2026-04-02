const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');
const LineService = require('./LineService');
const logger = require('../utils/logger');

class AlertService {
  // 比對新舊價格，必要時建立警示
  async checkPriceChange(product, platform, newPrice, oldPrice) {
    if (!oldPrice || newPrice === oldPrice) return;

    const changePercent = ((newPrice - oldPrice) / oldPrice) * 100;
    const db = getDB();

    const settings = db.prepare('SELECT notify_price_drop, price_drop_threshold FROM line_settings WHERE id = 1').get();
    const threshold = settings?.price_drop_threshold ?? 5;

    const type    = newPrice < oldPrice ? 'price_drop' : 'price_surge';
    const emoji   = newPrice < oldPrice ? '📉' : '📈';
    const verb    = newPrice < oldPrice ? '降價' : '漲價';
    const title   = `${product.brand} ${product.name} ${this._platformLabel(platform)}${verb} ${Math.abs(changePercent).toFixed(1)}%`;
    const message = `${emoji} 警報！${this._platformLabel(platform)}・${product.name}\n${verb} ${Math.abs(changePercent).toFixed(1)}%（NT$${oldPrice.toLocaleString()} → NT$${newPrice.toLocaleString()}）\n建議${newPrice < oldPrice ? '跟進調整定價策略' : '評估是否保持差異'}`;

    const alertId = uuidv4();
    db.prepare(`
      INSERT INTO alerts (id, product_id, type, platform, title, message, old_value, new_value)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(alertId, product.id, type, platform, title, message, String(oldPrice), String(newPrice));

    logger.info(`[警示] 建立: ${title}`);

    // 降價時推播 LINE Flex Message（需開啟通知且跌幅達門檻）
    if (type === 'price_drop' && settings?.notify_price_drop && Math.abs(changePercent) >= threshold) {
      await LineService.sendPriceDropAlert({
        productName: product.name,
        brand:       product.brand || '',
        platform,
        oldPrice,
        newPrice,
      }).catch(err => logger.warn(`LINE 推播失敗: ${err.message}`));
      db.prepare('UPDATE alerts SET line_sent = 1 WHERE id = ?').run(alertId);
    }
  }

  // 比對贈品變動
  async checkGiftChange(product, platform, newGift, oldGift) {
    if (newGift === oldGift) return;
    const db = getDB();

    const type    = newGift && !oldGift ? 'gift_added' : (!newGift && oldGift ? 'gift_removed' : 'gift_added');
    const title   = `${product.name} ${this._platformLabel(platform)}${type === 'gift_added' ? '新增贈品' : '移除贈品'}`;
    const message = type === 'gift_added'
      ? `🎁 ${this._platformLabel(platform)}・${product.name}\n新增贈品：${newGift}`
      : `⚠️ ${this._platformLabel(platform)}・${product.name}\n贈品已移除（原：${oldGift}）`;

    db.prepare(`
      INSERT INTO alerts (id, product_id, type, platform, title, message, old_value, new_value)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), product.id, type, platform, title, message, oldGift || '', newGift || '');

    logger.info(`[警示] 建立: ${title}`);

    await LineService.sendGiftAlert({
      productName: product.name,
      brand:       product.brand || '',
      platform,
      giftDescription: newGift || oldGift,
      isAdded: type === 'gift_added',
    }).catch(err => logger.warn(`LINE 推播失敗: ${err.message}`));
  }

  _platformLabel(platform) {
    return { watsons: '屈臣氏', cosmed: '康是美', poya: '寶雅', pchome: 'PChome' }[platform] || platform;
  }
}

module.exports = new AlertService();
