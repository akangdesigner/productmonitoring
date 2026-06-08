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
import LoginPage          from './components/LoginPage'
import ShopeeTrackingPage from './components/ShopeeTrackingPage'

const DEFAULT_LOG = []

function getStoredUser() {
  const token = localStorage.getItem('auth_token')
  if (!token) return null
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(b64))
    if (payload.exp * 1000 < Date.now()) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      return null
    }
    return JSON.parse(localStorage.getItem('auth_user') || 'null')
  } catch {
    return null
  }
}

export default function App() {
  const { toasts, toast } = useToast()
  const [user, setUser] = useState(getStoredUser)

  const [isOnline,    setIsOnline]    = useState(false)
  const [activeNav,   setActiveNav]   = useState('guide')
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

  function handleLogout() {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    if (window.google) window.google.accounts.id.disableAutoSelect()
    setUser(null)
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

  if (!user) {
    return <LoginPage onLogin={setUser} />
  }

  return (
    <>
      {user && (
        <div style={{
          position: 'fixed', top: 28, right: 48, zIndex: 200,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {user.picture && (
            <img src={user.picture} alt="" style={{
              width: 30, height: 30, borderRadius: '50%',
              border: '1.5px solid rgba(255,255,255,0.15)',
            }} />
          )}
          <button onClick={handleLogout} style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, color: 'var(--text-muted)',
            fontSize: 12, padding: '5px 12px', cursor: 'pointer',
            fontFamily: "'DM Mono', monospace", letterSpacing: '0.05em',
          }}>
            登出
          </button>
        </div>
      )}
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
          ) : activeNav === 'shopee' ? (
            <ShopeeTrackingPage isOnline={isOnline} toast={toast} />
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
          ) : products.length === 0 && isOnline ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              minHeight: 420, gap: 20, padding: '48px 24px', textAlign: 'center',
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: 18,
                background: 'linear-gradient(135deg, rgba(155,109,202,0.18), rgba(212,149,106,0.12))',
                border: '1px solid rgba(155,109,202,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
              }}>📋</div>
              <div>
                <div style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: 26, fontWeight: 400, color: 'var(--text-primary)', marginBottom: 10,
                }}>
                  尚無監控資料
                </div>
                <div style={{
                  fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 360,
                  fontFamily: "'Noto Sans TC', sans-serif",
                }}>
                  還沒有設定要追蹤的競品網址。<br />
                  前往「初始設定」貼上分類頁網址，再執行一次爬蟲，資料就會出現在這裡。
                </div>
              </div>
              <button
                onClick={() => setActiveNav('register')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 28px', borderRadius: 14, cursor: 'pointer',
                  background: 'linear-gradient(135deg, rgba(155,109,202,0.22), rgba(212,149,106,0.14))',
                  border: '1px solid rgba(155,109,202,0.4)',
                  color: 'var(--amethyst-light)', fontSize: 15, fontWeight: 600,
                  fontFamily: "'Noto Sans TC', sans-serif",
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(155,109,202,0.35), rgba(212,149,106,0.22))'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(155,109,202,0.25)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(155,109,202,0.22), rgba(212,149,106,0.14))'; e.currentTarget.style.boxShadow = '' }}
              >
                前往初始設定
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
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
