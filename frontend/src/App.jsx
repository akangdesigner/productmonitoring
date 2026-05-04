import { useState, useEffect, useCallback } from 'react'
import { api, apiFetch, checkBackend } from './api'
import { useToast, ToastContainer } from './components/Toast'
import Sidebar        from './components/Sidebar'
import Header         from './components/Header'
import KPICards       from './components/KPICards'
import LogStrip       from './components/LogStrip'
import PriceTable     from './components/PriceTable'
import TrendChart     from './components/TrendChart'
import AlertRecordsPage from './components/AlertRecordsPage'
import LineSettings   from './components/LineSettings'
import ScraperPage    from './components/ScraperPage'
import ProductsPage   from './components/ProductsPage'
import AddProductModal from './components/AddProductModal'
import RegisterPage    from './components/RegisterPage'
import GuidePage       from './components/GuidePage'
import SearchPage      from './components/SearchPage'

const DEFAULT_LOG = []

export default function App() {
  const { toasts, toast } = useToast()

  const [isOnline,    setIsOnline]    = useState(false)
  const [activeNav,   setActiveNav]   = useState('dashboard')
  const [scraperIdle, setScraperIdle] = useState(true)
  const [products,       setProducts]       = useState([])
  const [alerts,         setAlerts]         = useState([])
  const [kpi,            setKpi]            = useState({})
  const [log,            setLog]            = useState(DEFAULT_LOG)
  const [showModal,      setShowModal]      = useState(false)
  const [gapTotal,       setGapTotal]       = useState(0)
  const [ownBrands,      setOwnBrands]      = useState([])
  const [clientProducts, setClientProducts] = useState([])

  const lastSeenGap = parseInt(localStorage.getItem('gapLastSeen') || '0', 10)
  const newGapCount = Math.max(0, gapTotal - lastSeenGap)

  const refresh = useCallback(async () => {
    const online = await checkBackend()
    setIsOnline(online)
    if (!online) return

    try {
      const [kpiData, summary, alertData, gapRes, brands, clientProds] = await Promise.all([
        api.getKPI(),
        api.getSummary(),
        api.getAlerts(),
        api.getAlertGaps(1, 1),
        api.getOwnBrands(),
        api.getClientProducts(),
      ])
      if (kpiData)   setKpi(kpiData)
      setProducts(summary ?? [])
      if (!summary?.length) setActiveNav(nav => nav === 'dashboard' ? 'register' : nav)
      if (alertData?.length) setAlerts(alertData)
      if (gapRes?.total != null) setGapTotal(gapRes.total)
      if (brands)    setOwnBrands(brands)
      if (clientProds) setClientProducts(clientProds)
    } catch {}
  }, [])

  // 初始化 + 每 5 分鐘自動刷新
  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [refresh])

  // 爬蟲狀態輪詢（每 30 秒）
  useEffect(() => {
    async function pollStatus() {
      try {
        const s = await api.getScraperStatus()
        setScraperIdle(s.status === 'idle')
      } catch {}
    }
    pollStatus()
    const t = setInterval(pollStatus, 30 * 1000)
    return () => clearInterval(t)
  }, [])

  async function handleStar(id) {
    if (!isOnline) { toast('⚠ 後端離線', 'error'); return }
    try {
      const res = await api.starProduct(id)
      setProducts(prev => prev.map(p => p.id === id ? { ...p, is_starred: res.is_starred } : p))
    } catch (err) {
      toast(`操作失敗：${err.message}`, 'error')
    }
  }

  async function handleRename(id, newBaseName) {
    try {
      await api.renameProduct(id, newBaseName)
      setProducts(prev => prev.map(p => p.id === id ? { ...p, base_name: newBaseName } : p))
    } catch (err) {
      toast(`更名失敗：${err.message}`, 'error')
    }
  }

  async function handleDelete(id, name) {
    if (!isOnline) { toast('⚠ 後端離線，無法刪除', 'error'); return }
    if (!window.confirm(`確定要刪除「${name}」嗎？`)) return
    try {
      await api.deleteProduct(id)
      toast(`已刪除「${name}」`, 'success')
      await refresh()
    } catch (err) {
      toast(`刪除失敗：${err.message}`, 'error')
    }
  }

  async function handleDeleteAll() {
    if (!isOnline) { toast('⚠ 後端離線，無法刪除', 'error'); return }
    if (!window.confirm('確定要刪除所有追蹤中的商品嗎？此操作無法復原。')) return
    try {
      await api.deleteAllProducts()
      toast('已刪除所有監控商品', 'success')
      await refresh()
    } catch (err) {
      toast(`刪除失敗：${err.message}`, 'error')
    }
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
            if (key === 'dashboard') refresh()
            setActiveNav(key)
          }}
          unreadCount={newGapCount}
          scraperIdle={scraperIdle}
        />

        <Header />

        <main className="main">
          {activeNav === 'search' ? (
            <SearchPage isOnline={isOnline} toast={toast} />
          ) : activeNav === 'scraper' ? (
            <ScraperPage isOnline={isOnline} toast={toast} />
          ) : activeNav === 'products' ? (
            <ProductsPage isOnline={isOnline} toast={toast} />
          ) : activeNav === 'alerts' ? (
            <AlertRecordsPage isOnline={isOnline} toast={toast} />
          ) : activeNav === 'line' ? (
            <LineSettings isOnline={isOnline} toast={toast} />
          ) : activeNav === 'register' ? (
            <RegisterPage isOnline={isOnline} toast={toast} />
          ) : activeNav === 'guide' ? (
            <GuidePage onNav={setActiveNav} />
          ) : (
            <>
              <KPICards kpi={{ ...kpi, unreadAlerts: newGapCount }} />
              <LogStrip log={log} />
              <PriceTable products={products} onDelete={handleDelete} onStar={handleStar} onDeleteAll={handleDeleteAll} onRename={handleRename} ownBrands={ownBrands} clientProducts={clientProducts} />
              <TrendChart products={products} />
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
