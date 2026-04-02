import { useState, useEffect, useCallback } from 'react'
import { api, checkBackend } from './api'
import { MOCK_PRODUCTS, MOCK_ALERTS } from './mockData'
import { useToast, ToastContainer } from './components/Toast'
import Sidebar        from './components/Sidebar'
import Header         from './components/Header'
import KPICards       from './components/KPICards'
import LogStrip       from './components/LogStrip'
import PriceTable     from './components/PriceTable'
import TrendChart     from './components/TrendChart'
import AlertFeed      from './components/AlertFeed'
import AlertRecordsPage from './components/AlertRecordsPage'
import LineSettings   from './components/LineSettings'
import ScraperPage    from './components/ScraperPage'
import AddProductModal from './components/AddProductModal'

const DEFAULT_LOG = [
  { ts:'03:00', ok:true,  msg:'屈臣氏 完成' },
  { ts:'03:04', ok:true,  msg:'康是美 完成' },
  { ts:'03:09', ok:true,  msg:'寶雅 完成' },
  { ts:'03:12', ok:true,  msg:'全部完成 · 3 筆異動' },
]

export default function App() {
  const { toasts, toast } = useToast()

  const [isOnline,    setIsOnline]    = useState(false)
  const [activeNav,   setActiveNav]   = useState('dashboard')
  const [products,    setProducts]    = useState(MOCK_PRODUCTS)
  const [alerts,      setAlerts]      = useState(MOCK_ALERTS)
  const [kpi,         setKpi]         = useState({})
  const [log,         setLog]         = useState(DEFAULT_LOG)
  const [scraping,    setScraping]    = useState(false)
  const [scraperIdle, setScraperIdle] = useState(true)
  const [showModal,   setShowModal]   = useState(false)
  const [gapTotal,    setGapTotal]    = useState(0)

  const lastSeenGap = parseInt(localStorage.getItem('gapLastSeen') || '0', 10)
  const newGapCount = Math.max(0, gapTotal - lastSeenGap)

  const refresh = useCallback(async () => {
    const online = await checkBackend()
    setIsOnline(online)
    if (!online) return

    try {
      const [kpiData, summary, alertData, gapRes] = await Promise.all([
        api.getKPI(),
        api.getSummary(),
        api.getAlerts(),
        api.getAlertGaps(1, 1),
      ])
      if (kpiData)   setKpi(kpiData)
      if (summary?.length)  setProducts(summary)
      if (alertData?.length) setAlerts(alertData)
      if (gapRes?.total != null) setGapTotal(gapRes.total)
    } catch {}
  }, [])

  // 初始化 + 每 5 分鐘自動刷新
  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [refresh])

  async function handleScrape() {
    setScraping(true)
    setScraperIdle(false)
    setLog([{ ts: '', ok: true, msg: '正在執行全平台爬取…' }])

    if (isOnline) {
      try {
        const result = await api.runScraper()
        const now = new Date()
        const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
        setLog([
          { ts: hhmm, ok: true,           msg: `爬取完成` },
          { ts: '',   ok: true,           msg: `成功 ${result.scraped} 筆` },
          { ts: '',   ok: result.errors===0, msg: `失敗 ${result.errors} 筆` },
        ])
        toast(`爬取完成：${result.scraped} 筆成功`, result.errors > 0 ? 'info' : 'success')
        await refresh()
      } catch (err) {
        toast(`爬蟲失敗：${err.message}`, 'error')
        setLog([{ ts: '', ok: false, msg: `失敗：${err.message}` }])
      }
    } else {
      await new Promise(r => setTimeout(r, 2000))
      setLog([{ ts: '', ok: true, msg: '（示範模式）後端未啟動' }])
    }
    setScraping(false)
    setScraperIdle(true)
  }

  async function handleMarkAllRead() {
    if (isOnline) {
      try { await api.markAllRead() } catch {}
    }
    setAlerts(prev => prev.map(a => ({ ...a, is_read: 1 })))
    toast('所有警示已標記為已讀', 'success')
  }

  async function handleAddProduct(payload) {
    if (!isOnline) { toast('⚠ 後端離線，無法儲存商品', 'error'); return }
    try {
      await api.addProduct(payload)
      toast(`✅ 已新增「${payload.name}」到監控清單`, 'success')
      setShowModal(false)
      await refresh()
    } catch (err) {
      toast(`新增失敗：${err.message}`, 'error')
    }
  }

  return (
    <>
      {!isOnline && (
        <div className="offline-banner">
          ⚠ 無法連線後端伺服器 — 目前顯示示範資料，請執行 npm run dev 啟動後端
        </div>
      )}

      <div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" />

      <div className="layout" style={!isOnline ? { paddingTop: 36 } : {}}>
        <Sidebar
          activeNav={activeNav}
          onNav={(key) => {
            if (key === 'alerts') {
              localStorage.setItem('gapLastSeen', String(gapTotal))
            }
            setActiveNav(key)
          }}
          unreadCount={newGapCount}
          scraperIdle={scraperIdle}
        />

        <Header
          onScrape={handleScrape}
          onAddProduct={() => setShowModal(true)}
          scraping={scraping}
        />

        <main className="main">
          {activeNav === 'scraper' ? (
            <ScraperPage isOnline={isOnline} toast={toast} />
          ) : activeNav === 'alerts' ? (
            <AlertRecordsPage isOnline={isOnline} toast={toast} />
          ) : activeNav === 'line' ? (
            <LineSettings isOnline={isOnline} toast={toast} />
          ) : (
            <>
              <KPICards kpi={{ ...kpi, unreadAlerts: newGapCount }} />
              <LogStrip log={log} />
              <PriceTable products={products} />
              <div className="mid-grid">
                <TrendChart products={products} isOnline={isOnline} />
                <AlertFeed alerts={alerts} onMarkAllRead={handleMarkAllRead} />
              </div>
            </>
          )}
        </main>
      </div>

      <AddProductModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleAddProduct}
      />

      <ToastContainer toasts={toasts} />
    </>
  )
}
