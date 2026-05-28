const express = require('express');
const router  = express.Router();
const axios   = require('axios');

const ACTOR_ID = '4nhvc7lTKzkDrk7bD';
const BASE_URL = 'https://api.apify.com/v2';

function getToken() {
  return process.env.APIFY_TOKEN;
}

// POST /api/apify/shopee
// body: { keyword, maxProducts?, country?, sort?, fetchDetail? }
router.post('/shopee', async (req, res) => {
  const { keyword, maxProducts = 20, country = 'tw', sort = 'relevancy', fetchDetail = false } = req.body;

  if (!keyword || !keyword.trim()) {
    return res.status(400).json({ error: '請提供搜尋關鍵字' });
  }

  const token = getToken();
  if (!token) {
    return res.status(500).json({ error: '後端尚未設定 APIFY_TOKEN' });
  }

  try {
    // 同步執行並直接取得 dataset 結果（最多等 5 分鐘）
    const response = await axios.post(
      `${BASE_URL}/acts/${ACTOR_ID}/run-sync-get-dataset-items`,
      {
        country,
        keyword: keyword.trim(),
        maxProducts: Number(maxProducts),
        mode: 'keyword',
        sort,
        fetchDetail: Boolean(fetchDetail),
        delay: 1,
      },
      {
        params: { token, clean: true, format: 'json' },
        timeout: 300_000, // 5 分鐘
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const items = Array.isArray(response.data) ? response.data : [];

    // debug：印出第一筆原始資料，確認 price / rating 格式
    if (items.length > 0) {
      const { name, price, original_price, rating, rating_star, sold_count, shop_name, shopName, seller_name } = items[0];
      console.log('[Apify debug]', JSON.stringify({ name, price, original_price, rating, rating_star, sold_count, shop_name, shopName, seller_name }));
    }

    const results = items.map(item => ({
      shop_id:        item.shop_id,
      shop_name:      item.shop_name || item.shopName || item.seller_name || item.seller || null,
      item_id:        item.item_id,
      name:           item.name,
      price:          item.price != null ? Math.round(item.price) : null,
      original_price: item.original_price != null ? Math.round(item.original_price) : null,
      discount_pct:   item.discount_pct,
      rating:         item.rating,
      sold_count:     item.sold_count,
      is_mall:        item.is_mall,
      location:       item.location,
      image_url:      item.image_url,
      url:            item.url,
    }));

    res.json({ ok: true, keyword: keyword.trim(), count: results.length, items: results });
  } catch (err) {
    const status  = err.response?.status;
    const message = err.response?.data?.error?.message || err.message;
    res.status(status || 500).json({ error: `Apify 執行失敗：${message}` });
  }
});

module.exports = router;
