// Vite proxy 會把 /api 轉發到 localhost:3000，不需要寫 API_BASE
export async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function checkBackend() {
  try {
    await fetch('/api/dashboard/kpi', { signal: AbortSignal.timeout(3000) });
    return true;
  } catch {
    return false;
  }
}

export const api = {
  getKPI:       () => apiFetch('/api/dashboard/kpi'),
  getSummary:   () => apiFetch('/api/dashboard/summary'),
  getAlerts:    (limit = 30) => apiFetch(`/api/alerts?limit=${limit}`),
  getAlertGaps: (page = 1, limit = 20) => apiFetch(`/api/alerts/gaps?page=${page}&limit=${limit}`),
  markAllRead:  () => apiFetch('/api/alerts/read-all', { method: 'PUT' }),
  getTrend:     (productId, days = 30) => apiFetch(`/api/prices/trend/${productId}?days=${days}`),
  runScraper:   (platform = 'all') => apiFetch(`/api/scraper/run${platform === 'all' ? '' : `/${platform}`}`, { method: 'POST' }),
  getLineSettings: () => apiFetch('/api/line/settings'),
  saveLineSettings: (payload) => apiFetch('/api/line/settings', { method: 'PUT', body: JSON.stringify(payload) }),
  testLine:     (token, userId) => apiFetch('/api/line/test', { method: 'POST', body: JSON.stringify({ token, userId }) }),
  sendGapReport: () => apiFetch('/api/line/report/gaps', { method: 'POST' }),
  addProduct:      (payload) => apiFetch('/api/products', { method: 'POST', body: JSON.stringify(payload) }),
  deleteProduct:   (id)      => apiFetch(`/api/products/${id}`, { method: 'DELETE' }),
  starProduct:     (id)      => apiFetch(`/api/products/${id}/star`, { method: 'PATCH' }),
  scrapeUrl:        (url)          => apiFetch('/api/scraper/url', { method: 'POST', body: JSON.stringify({ url }) }),
  getSchedule:      ()             => apiFetch('/api/scraper/schedule'),
  setSchedule:      (s)            => apiFetch('/api/scraper/schedule', { method: 'PUT', body: JSON.stringify(s) }),
  getScrapeHistory: ()             => apiFetch('/api/scraper/history'),
  getScraperUrls:   ()             => apiFetch('/api/scraper/urls'),
  addScraperUrl:    (url, label)   => apiFetch('/api/scraper/urls', { method: 'POST', body: JSON.stringify({ url, label }) }),
  toggleScraperUrl: (id, enabled)  => apiFetch(`/api/scraper/urls/${id}`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
  deleteScraperUrl: (id)           => apiFetch(`/api/scraper/urls/${id}`, { method: 'DELETE' }),
};
