import { useState, useEffect, useCallback } from 'react'
import { api, apiFetch, checkBackend } from './api'
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
import ProductsPage   from './components/ProductsPage'
import AddProductModal from './components/AddProductModal'

const DEFAULT_LOG = []

export default function App() {
  const { toasts, toast } = useToast()

  const [isOnline,    setIsOnline]    = useState(false)
  const [activeNav,   setActiveNav]   = useState('dashboard')
  const [products,    setProducts]    = useState([])
  const [alerts,      setAlerts]      = useState([])
  const [kpi,         setKpi]         = useState({})
  const [log,         setLog]         = useState(DEFAULT_LOG)
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

  async function handleStar(id) {
    if (!isOnline) { toast('⚠ 後端離線', 'error'); return }
    try {
      const res = await api.starProduct(id)
      setProducts(prev => prev.map(p => p.id === id ? { ...p, is_starred: res.is_starred } : p))
    } catch (err) {
      toast(`操作失敗：${err.message}`, 'error')
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

        />

        <Header />

        <main className="main">
          {activeNav === 'scraper' ? (
            <ScraperPage isOnline={isOnline} toast={toast} />
          ) : activeNav === 'products' ? (
            <ProductsPage isOnline={isOnline} toast={toast} />
          ) : activeNav === 'alerts' ? (
            <AlertRecordsPage isOnline={isOnline} toast={toast} />
          ) : activeNav === 'line' ? (
            <LineSettings isOnline={isOnline} toast={toast} />
          ) : (
            <>
              <KPICards kpi={{ ...kpi, unreadAlerts: newGapCount }} />
              <LogStrip log={log} />
              <PriceTable products={products} onDelete={handleDelete} onStar={handleStar} onAdd={() => setShowModal(true)} />
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
