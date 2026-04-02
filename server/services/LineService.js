const { Client } = require('@line/bot-sdk');
const { getDB } = require('../db');
const logger = require('../utils/logger');

function getLineConfig() {
  // 優先用環境變數，DB 作為備援
  const token  = process.env.LINE_CHANNEL_ACCESS_TOKEN
    || getDB().prepare('SELECT channel_access_token FROM line_settings WHERE id = 1').get()?.channel_access_token || '';
  const secret = process.env.LINE_CHANNEL_SECRET
    || getDB().prepare('SELECT channel_secret FROM line_settings WHERE id = 1').get()?.channel_secret || '';
  const userId = process.env.LINE_USER_ID
    || getDB().prepare('SELECT user_id FROM line_settings WHERE id = 1').get()?.user_id || '';
  return { token, secret, userId };
}

function getClient() {
  const { token, secret } = getLineConfig();
  if (!token) return null;
  return new Client({ channelAccessToken: token, channelSecret: secret });
}

function getTargetUserId() {
  return getLineConfig().userId || null;
}

// ── Flex Message 模板 ─────────────────────────────────

function buildPriceDropFlex({ productName, brand, platform, oldPrice, newPrice }) {
  const pct = (((newPrice - oldPrice) / oldPrice) * 100).toFixed(1);
  const saved = oldPrice - newPrice;
  const platformColor = { watsons:'#00a0e3', cosmed:'#f47920', poya:'#16a34a', pchome:'#cc0000' };
  const platformLabel = { watsons:'屈臣氏', cosmed:'康是美', poya:'寶雅', pchome:'PChome 24h' };
  const pfColor = platformColor[platform] || '#9b6dca';
  const pfLabel = platformLabel[platform] || platform;

  return {
    type: 'flex',
    altText: `🚨 降價警報！${brand} ${productName} 在 ${pfLabel} 降價 ${Math.abs(pct)}%`,
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box', layout: 'vertical',
        backgroundColor: '#ff4d6d',
        paddingAll: '14px',
        contents: [
          { type: 'text', text: '🚨  降價警報', color: '#ffffff', weight: 'bold', size: 'md' }
        ]
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '16px',
        contents: [
          { type: 'text', text: productName, weight: 'bold', size: 'md', color: '#f0e8ff', wrap: true },
          { type: 'text', text: brand, size: 'sm', color: '#9d8fba', margin: 'xs' },
          { type: 'text', text: pfLabel, size: 'sm', color: pfColor, margin: 'xs', weight: 'bold' },
          { type: 'separator', margin: 'md', color: '#2a2245' },
          {
            type: 'box', layout: 'horizontal', margin: 'md',
            contents: [
              { type: 'text', text: '原價', size: 'sm', color: '#5c5075', flex: 1 },
              { type: 'text', text: `NT$${oldPrice.toLocaleString()}`, size: 'sm', align: 'end', decoration: 'line-through', color: '#5c5075', flex: 2, wrap: true },
            ]
          },
          {
            type: 'box', layout: 'horizontal', margin: 'xs',
            contents: [
              { type: 'text', text: '現價', size: 'lg', weight: 'bold', color: '#f0e8ff', flex: 1 },
              { type: 'text', text: `NT$${newPrice.toLocaleString()}`, size: 'lg', weight: 'bold', align: 'end', color: '#ff4d6d', flex: 2, wrap: true },
            ]
          },
          {
            type: 'box', layout: 'vertical', margin: 'md',
            backgroundColor: '#ff4d6d20',
            cornerRadius: '8px', paddingAll: '8px',
            contents: [
              { type: 'text', text: `↓ 降價 ${Math.abs(pct)}%`, align: 'center', color: '#ff4d6d', weight: 'bold', size: 'sm', wrap: true },
              { type: 'text', text: `省 NT$${saved.toLocaleString()}`, align: 'center', color: '#ff4d6d', size: 'xs', wrap: true }
            ]
          }
        ]
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px',
        contents: [
          { type: 'text', text: '建議跟進調整定價策略', size: 'xs', color: '#5c5075', align: 'center', wrap: true }
        ]
      },
      styles: {
        body: { backgroundColor: '#0d0b1a' },
        footer: { backgroundColor: '#0d0b1a', separator: true, separatorColor: '#2a2245' }
      }
    }
  };
}

function buildGiftFlex({ productName, brand, platform, giftDescription, isAdded }) {
  const platformLabel = { watsons:'屈臣氏', cosmed:'康是美', poya:'寶雅', pchome:'PChome' };
  const pfLabel = platformLabel[platform] || platform;
  const headerColor = isAdded ? '#9b6dca' : '#fbbf24';
  const headerText  = isAdded ? '🎁  新增贈品活動' : '⚠️  贈品活動結束';

  return {
    type: 'flex',
    altText: `${headerText}｜${pfLabel}・${productName}`,
    contents: {
      type: 'bubble', size: 'kilo',
      header: {
        type: 'box', layout: 'vertical',
        backgroundColor: headerColor, paddingAll: '14px',
        contents: [{ type: 'text', text: headerText, color: '#ffffff', weight: 'bold', size: 'md' }]
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '16px',
        contents: [
          { type: 'text', text: productName, weight: 'bold', size: 'md', color: '#f0e8ff', wrap: true },
          { type: 'text', text: brand, size: 'sm', color: '#9d8fba', margin: 'xs' },
          { type: 'text', text: pfLabel, size: 'sm', color: '#9b6dca', margin: 'xs', weight: 'bold' },
          { type: 'separator', margin: 'md', color: '#2a2245' },
          {
            type: 'box', layout: 'vertical', margin: 'md',
            backgroundColor: isAdded ? '#9b6dca20' : '#fbbf2420',
            cornerRadius: '8px', paddingAll: '10px',
            contents: [
              { type: 'text', text: isAdded ? giftDescription : `原贈品：${giftDescription}`, color: isAdded ? '#c084fc' : '#fbbf24', size: 'sm', wrap: true }
            ]
          }
        ]
      },
      styles: { body: { backgroundColor: '#0d0b1a' } }
    }
  };
}

function buildDailyReportFlex(products) {
  const now = new Date().toLocaleString('zh-TW', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });

  const bubbles = products.slice(0, 10).map(p => {
    const prices = [p.watsons_price, p.cosmed_price, p.poya_price].filter(v => v > 0);
    const minPrice = prices.length ? Math.min(...prices) : null;
    const platformMap = { watsons_price:'屈臣氏', cosmed_price:'康是美', poya_price:'寶雅' };
    const lowestPf = minPrice ? Object.keys(platformMap).find(k => p[k] === minPrice) : null;

    return {
      type: 'bubble', size: 'micro',
      body: {
        type: 'box', layout: 'vertical', spacing: 'xs', paddingAll: '12px',
        contents: [
          { type: 'text', text: p.brand || '品牌', size: 'xxs', color: '#9d8fba' },
          { type: 'text', text: p.name, size: 'xs', weight: 'bold', wrap: true, color: '#f0e8ff' },
          { type: 'separator', margin: 'sm', color: '#2a2245' },
          {
            type: 'box', layout: 'horizontal', margin: 'sm',
            contents: [
              { type: 'text', text: '最低', size: 'xs', color: '#5c5075', flex: 1 },
              { type: 'text', text: minPrice ? `NT$${minPrice.toLocaleString()}` : '—', size: 'xs', weight: 'bold', align: 'end', color: '#4ade80', flex: 2, wrap: true }
            ]
          },
          {
            type: 'text',
            text: lowestPf ? platformMap[lowestPf] : '',
            size: 'xxs', color: '#9d8fba', align: 'end', wrap: true
          }
        ]
      },
      styles: { body: { backgroundColor: '#0d0b1a' } }
    };
  });

  return {
    type: 'flex',
    altText: `📊 美妝競品每日早報 ${now}`,
    contents: {
      type: 'carousel',
      contents: [
        // 標題卡
        {
          type: 'bubble', size: 'micro',
          body: {
            type: 'box', layout: 'vertical', justifyContent: 'center',
            paddingAll: '12px', spacing: 'xs',
            contents: [
              { type: 'text', text: '📊', size: 'xl', align: 'center' },
              { type: 'text', text: '每日競品早報', weight: 'bold', align: 'center', color: '#f0e8ff', size: 'sm', wrap: true },
              { type: 'text', text: now, size: 'xxs', color: '#5c5075', align: 'center', margin: 'xs', wrap: true },
            ]
          },
          styles: { body: { backgroundColor: '#0d0b1a' } }
        },
        ...bubbles
      ]
    }
  };
}

// ── 公開方法 ──────────────────────────────────────────

const LineService = {
  async sendAlert(message, flexPayload = null) {
    const client = getClient();
    const userId = getTargetUserId();
    if (!client || !userId) {
      logger.warn('[LINE] 未設定 Token 或 User ID，略過推播');
      return;
    }
    const msg = flexPayload || { type: 'text', text: message };
    await client.pushMessage(userId, msg);
    logger.info('[LINE] 推播成功');
  },

  async sendPriceDropAlert(params) {
    const flex = buildPriceDropFlex(params);
    await this.sendAlert(flex.altText, flex);
  },

  async sendGiftAlert(params) {
    const flex = buildGiftFlex(params);
    await this.sendAlert(flex.altText, flex);
  },

  async sendGapReport(gaps) {
    const client = getClient();
    const userId = getTargetUserId();
    if (!client || !userId) return;

    const PF_LABEL = { watsons: '屈臣氏', cosmed: '康是美', poya: '寶雅' };
    const PF_COLOR = { watsons: '#00a0e3', cosmed: '#f47920', poya: '#16a34a' };
    const now = new Date().toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

    const bubbles = gaps.map(g => {
      const rows = ['watsons', 'cosmed', 'poya']
        .filter(pf => g[pf] > 0)
        .map(pf => ({
          type: 'box', layout: 'horizontal', margin: 'xs',
          contents: [
            { type: 'text', text: PF_LABEL[pf], size: 'xs', color: PF_COLOR[pf], flex: 1 },
            { type: 'text', text: `NT$${g[pf].toLocaleString()}`, size: 'xs', align: 'end', flex: 2, wrap: true,
              color: g[pf] === g.min ? '#4ade80' : '#f0e8ff', weight: g[pf] === g.min ? 'bold' : 'regular' },
          ]
        }));

      return {
        type: 'bubble', size: 'micro',
        body: {
          type: 'box', layout: 'vertical', spacing: 'xs', paddingAll: '12px',
          contents: [
            { type: 'text', text: g.brand || '', size: 'xxs', color: '#9d8fba' },
            { type: 'text', text: g.name, size: 'xs', weight: 'bold', wrap: true, color: '#f0e8ff' },
            { type: 'separator', margin: 'sm', color: '#2a2245' },
            ...rows,
            {
              type: 'box', layout: 'vertical', margin: 'sm',
              backgroundColor: '#ff4d6d20', cornerRadius: '6px', paddingAll: '6px',
              contents: [
                { type: 'text', text: `價差 NT$${g.gap.toLocaleString()}`, align: 'center', color: '#ff4d6d', size: 'xs', weight: 'bold' }
              ]
            }
          ]
        },
        styles: { body: { backgroundColor: '#0d0b1a' } }
      };
    });

    const flex = {
      type: 'flex',
      altText: `📊 跨平台價差報告 ${now}（共 ${gaps.length} 筆）`,
      contents: {
        type: 'carousel',
        contents: [
          {
            type: 'bubble', size: 'micro',
            body: {
              type: 'box', layout: 'vertical', justifyContent: 'center', paddingAll: '12px', spacing: 'xs',
              contents: [
                { type: 'text', text: '📊', size: 'xl', align: 'center' },
                { type: 'text', text: '跨平台價差報告', weight: 'bold', align: 'center', color: '#f0e8ff', size: 'sm' },
                { type: 'text', text: now, size: 'xxs', color: '#5c5075', align: 'center', margin: 'xs' },
                { type: 'text', text: `共 ${gaps.length} 筆`, size: 'xxs', color: '#9b6dca', align: 'center' },
              ]
            },
            styles: { body: { backgroundColor: '#0d0b1a' } }
          },
          ...bubbles
        ]
      }
    };

    await client.pushMessage(userId, flex);
    logger.info('[LINE] 價差報告推播完成');
  },

  async sendDailyReport(products) {
    const client = getClient();
    const userId = getTargetUserId();
    if (!client || !userId) return;

    const db = getDB();
    const s = db.prepare('SELECT daily_report_enabled FROM line_settings WHERE id = 1').get();
    if (!s?.daily_report_enabled) return;

    // 查詢每個商品各平台最新價格
    const enriched = products.map(p => {
      const getPlatformPrice = (pf) => {
        const row = db.prepare(`
          SELECT price FROM price_records
          WHERE product_id = ? AND platform = ?
          ORDER BY scraped_at DESC LIMIT 1
        `).get(p.id, pf);
        return row?.price || null;
      };
      return {
        ...p,
        watsons_price: getPlatformPrice('watsons'),
        cosmed_price:  getPlatformPrice('cosmed'),
        poya_price:    getPlatformPrice('poya'),
      };
    });

    const flex = buildDailyReportFlex(enriched);
    await client.pushMessage(userId, flex);
    logger.info('[LINE] 每日早報推播完成');
  },

  async testConnection(token, userId) {
    const { secret } = getLineConfig();
    const client = new Client({ channelAccessToken: token, channelSecret: secret });
    const flex = {
      type: 'flex',
      altText: '✅ 美妝競品監控台連線成功！',
      contents: {
        type: 'bubble', size: 'kilo',
        header: {
          type: 'box', layout: 'vertical',
          backgroundColor: '#9b6dca', paddingAll: '14px',
          contents: [{ type: 'text', text: '✅  連線測試成功', color: '#ffffff', weight: 'bold', size: 'md' }]
        },
        body: {
          type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '16px',
          contents: [
            { type: 'text', text: '美妝競品監控台已成功連線！', weight: 'bold', color: '#f0e8ff', wrap: true },
            { type: 'separator', margin: 'md', color: '#2a2245' },
            { type: 'text', text: '您將收到以下通知：', size: 'sm', color: '#9d8fba', margin: 'md' },
            { type: 'text', text: '• 競品降價即時警報', size: 'sm', color: '#c084fc' },
            { type: 'text', text: '• 贈品活動異動通知', size: 'sm', color: '#c084fc' },
            { type: 'text', text: '• 每日早上 09:00 比價早報', size: 'sm', color: '#c084fc' },
          ]
        },
        styles: { body: { backgroundColor: '#0d0b1a' } }
      }
    };
    await client.pushMessage(userId, flex);
  }
};

module.exports = LineService;
