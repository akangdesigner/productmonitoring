const axios = require('axios');
const { getDB } = require('../db');

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer': 'https://shopee.tw/',
  'Accept': 'application/json',
};

async function getShopInfo(shopId) {
  const url = `https://shopee.tw/api/v4/shop/get_shop_detail?shopid=${shopId}&limit=1`;
  const res = await axios.get(url, { headers, timeout: 8000 });
  const d = res.data?.data;
  if (!d) return null;
  return {
    shop_id:      shopId,
    name:         d.name,
    username:     d.username,
    is_official:  d.is_official_shop,
    rating:       d.rating_star,
  };
}

async function main() {
  const db = getDB();
  const row = db.prepare('SELECT items FROM shopee_results ORDER BY run_at DESC LIMIT 1').get();
  if (!row) return console.log('沒有資料');

  const items = JSON.parse(row.items || '[]');
  const shopIds = [...new Set(items.map(i => i.shop_id).filter(Boolean))];
  console.log(`共 ${shopIds.length} 個不重複 shop_id：`, shopIds);

  for (const sid of shopIds) {
    try {
      const info = await getShopInfo(sid);
      console.log('✅', info);
    } catch (err) {
      console.log('❌ shopId:', sid, err.response?.status, err.message);
    }
    await new Promise(r => setTimeout(r, 300));
  }
}

main();
