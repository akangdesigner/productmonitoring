const axios = require('axios');

const shopId = 2530040;
const itemId = 27093538083;

axios.get('https://shopee.tw/api/v4/item/get', {
  params: { itemid: itemId, shopid: shopId },
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://shopee.tw/',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-TW,zh;q=0.9',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'x-api-source': 'pc',
    'x-shopee-language': 'zh-Hant',
  },
  timeout: 15000,
}).then(r => {
  const item = r.data?.data?.item;
  if (!item) {
    console.log('回應（無 item）:', JSON.stringify(r.data).substring(0, 500));
    return;
  }
  console.log('✅ 成功！');
  console.log('商品名稱:', item.name);
  console.log('目前價格: NT$', item.price / 100000);
  console.log('原價:     NT$', item.price_before_discount ? item.price_before_discount / 100000 : '無');
  console.log('庫存:', item.stock);
  console.log('賣場:', item.shop_name);
}).catch(e => {
  console.error('❌ 狀態碼:', e.response?.status);
  console.error('回應:', JSON.stringify(e.response?.data)?.substring(0, 300) || e.message);
});
