import { useState } from 'react'
import { api } from '../api'

/* ── 注入 keyframes ── */
const INJECT_CSS = `
@keyframes rp-fadeUp {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes rp-shimmer {
  0%   { transform: translateX(-120%) skewX(-20deg); }
  100% { transform: translateX(220%)  skewX(-20deg); }
}
@keyframes rp-gradFlow {
  0%,100% { background-position: 0% 50%; }
  50%      { background-position: 100% 50%; }
}
@keyframes rp-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes rp-pulseRing {
  0%,100% { box-shadow: 0 0 0 0 rgba(155,109,202,0.4); }
  50%     { box-shadow: 0 0 0 12px rgba(155,109,202,0); }
}

.rp-section {
  background: rgba(255,255,255,0.025);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 18px;
  padding: 28px;
  margin-bottom: 18px;
  animation: rp-fadeUp 0.5s ease both;
}
.rp-platform-card {
  position: relative; overflow: hidden;
  background: rgba(255,255,255,0.04);
  border: 1.5px solid rgba(255,255,255,0.09);
  border-radius: 16px;
  padding: 22px 14px 18px;
  text-align: center;
  cursor: pointer;
  transition: all 0.25s ease;
  user-select: none;
}
.rp-platform-card:not(.rp-disabled):hover {
  transform: translateY(-3px);
  background: rgba(255,255,255,0.07);
  border-color: rgba(155,109,202,0.35);
}
.rp-platform-card.rp-disabled { opacity: 0.32; cursor: not-allowed; }
.rp-platform-card.rp-sel-watsons {
  border-color: rgba(0,160,227,0.65) !important;
  background: rgba(0,160,227,0.09) !important;
  box-shadow: 0 0 28px rgba(0,160,227,0.18), inset 0 0 20px rgba(0,160,227,0.05);
}
.rp-platform-card.rp-sel-cosmed {
  border-color: rgba(244,121,32,0.65) !important;
  background: rgba(244,121,32,0.09) !important;
  box-shadow: 0 0 28px rgba(244,121,32,0.18), inset 0 0 20px rgba(244,121,32,0.05);
}
.rp-platform-card.rp-sel-poya {
  border-color: rgba(22,163,74,0.65) !important;
  background: rgba(22,163,74,0.09) !important;
  box-shadow: 0 0 28px rgba(22,163,74,0.18), inset 0 0 20px rgba(22,163,74,0.05);
}
.rp-input:focus {
  border-color: rgba(155,109,202,0.55) !important;
  box-shadow: 0 0 0 3px rgba(155,109,202,0.14), 0 0 14px rgba(155,109,202,0.12) !important;
}
.rp-submit {
  position: relative; overflow: hidden;
  background: linear-gradient(135deg, #9b6dca 0%, #c084fc 40%, #d4956a 100%);
  background-size: 200% 200%;
  animation: rp-gradFlow 4s ease infinite;
  color: #fff; border: none; border-radius: 12px;
  padding: 14px 38px; font-size: 15px; font-weight: 600;
  cursor: pointer; letter-spacing: 0.04em;
  transition: transform 0.2s, box-shadow 0.2s;
  font-family: 'Noto Sans TC', sans-serif;
}
.rp-submit::after {
  content: '';
  position: absolute; inset-block: 0;
  width: 45%; left: -50%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent);
  transform: skewX(-20deg);
  animation: rp-shimmer 3.5s ease-in-out infinite;
}
.rp-submit:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 36px rgba(155,109,202,0.45);
}
.rp-submit:disabled { opacity: 0.45; cursor: not-allowed; animation: none; }
.rp-remove-btn:hover { background: rgba(239,68,68,0.2) !important; }
.rp-add-url-btn:hover { opacity: 0.8; }
`

/* ── Platform SVG logos ── */
function IconWatsons({ size = 38 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 38 38" fill="none">
      <circle cx="19" cy="19" r="17" fill="url(#wt-bg)" opacity="0.18"/>
      <circle cx="19" cy="19" r="13" fill="none" stroke="url(#wt-bg)" strokeWidth="1" opacity="0.3"/>
      <path d="M11.5 14.5l2 9h1.8l2-6.8 2 6.8h1.8l2-9H21l-1.3 6.2-1.9-6.2H16.2l-1.9 6.2-1.3-6.2h-1.5z" fill="url(#wt-bg)"/>
      <defs><linearGradient id="wt-bg" x1="2" y1="2" x2="36" y2="36" gradientUnits="userSpaceOnUse"><stop stopColor="#38bdf8"/><stop offset="1" stopColor="#0077b6"/></linearGradient></defs>
    </svg>
  )
}
function IconCosmed({ size = 38 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 38 38" fill="none">
      <circle cx="19" cy="19" r="17" fill="url(#cm-bg)" opacity="0.18"/>
      <path d="M25.5 19a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z" fill="none" stroke="url(#cm-bg)" strokeWidth="1.2" opacity="0.4"/>
      <path d="M19 13v12M13 19h12" stroke="url(#cm-bg)" strokeWidth="2.2" strokeLinecap="round"/>
      <defs><linearGradient id="cm-bg" x1="2" y1="2" x2="36" y2="36" gradientUnits="userSpaceOnUse"><stop stopColor="#fb923c"/><stop offset="1" stopColor="#e63946"/></linearGradient></defs>
    </svg>
  )
}
function IconPoya({ size = 38 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 38 38" fill="none">
      <circle cx="19" cy="19" r="17" fill="url(#py-bg)" opacity="0.18"/>
      <path d="M14 12h10l2.5 6.5H11.5L14 12z" fill="none" stroke="url(#py-bg)" strokeWidth="1.4" strokeLinejoin="round" opacity="0.5"/>
      <path d="M10.5 18.5l1.8 8h15.4l1.8-8" stroke="url(#py-bg)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <circle cx="15" cy="27.5" r="1.8" fill="url(#py-bg)"/>
      <circle cx="23" cy="27.5" r="1.8" fill="url(#py-bg)"/>
      <defs><linearGradient id="py-bg" x1="2" y1="2" x2="36" y2="36" gradientUnits="userSpaceOnUse"><stop stopColor="#4ade80"/><stop offset="1" stopColor="#16a34a"/></linearGradient></defs>
    </svg>
  )
}
function IconMomo({ size = 38 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 38 38" fill="none">
      <circle cx="19" cy="19" r="17" fill="#444" opacity="0.12"/>
      <text x="19" y="21" textAnchor="middle" fontSize="9" fontWeight="500" fill="#555" fontFamily="DM Mono, monospace" letterSpacing="0.05em">momo</text>
    </svg>
  )
}

const PLATFORMS = [
  { key: 'watsons', name: '屈臣氏',   color: '#00a0e3', Icon: IconWatsons, placeholder: 'https://www.watsons.com.tw/category/...', hint: '貼上屈臣氏分類頁或搜尋頁網址' },
  { key: 'cosmed',  name: '康是美',   color: '#f47920', Icon: IconCosmed,  placeholder: 'https://www.cosmed.com.tw/category/...', hint: '貼上康是美分類頁或搜尋頁網址' },
  { key: 'poya',    name: '寶雅',     color: '#16a34a', Icon: IconPoya,    placeholder: 'https://www.poyabuy.com.tw/v2/cms/...', hint: '貼上寶雅分類頁網址' },
  { key: 'momo',    name: 'momo',     color: '#666',    Icon: IconMomo,    placeholder: '即將推出…', hint: 'momo 平台爬蟲即將推出', disabled: true },
]
const DAYS_OPTIONS = [
  { value: 'daily',    label: '每天' },
  { value: 'weekdays', label: '週一至週五' },
  { value: 'weekends', label: '週六、週日' },
]

function SectionHead({ icon, title, sub, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22, paddingBottom: 18, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{
        width: 40, height: 40, borderRadius: 11, flexShrink: 0,
        background: 'linear-gradient(135deg, rgba(155,109,202,0.2), rgba(212,149,106,0.12))',
        border: '1px solid rgba(155,109,202,0.22)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Noto Sans TC', sans-serif" }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>}
      </div>
      {right}
    </div>
  )
}

function MonoLabel({ children }) {
  return (
    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.22em', color: 'var(--amethyst)', textTransform: 'uppercase', marginBottom: 8 }}>
      {children}
    </div>
  )
}

function IcoGrid() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7" height="7" rx="2" stroke="url(#rp-g1)" strokeWidth="1.8" fill="none"/>
      <rect x="14" y="3" width="7" height="7" rx="2" stroke="url(#rp-g1)" strokeWidth="1.8" fill="none"/>
      <rect x="3" y="14" width="7" height="7" rx="2" stroke="url(#rp-g1)" strokeWidth="1.8" fill="none"/>
      <rect x="14" y="14" width="7" height="7" rx="2" stroke="url(#rp-g1)" strokeWidth="1.8" fill="none" opacity="0.5"/>
      <defs><linearGradient id="rp-g1" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse"><stop stopColor="#c084fc"/><stop offset="1" stopColor="#d4956a"/></linearGradient></defs>
    </svg>
  )
}
function IcoLink() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="url(#rp-g2)" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="url(#rp-g2)" strokeWidth="1.8" strokeLinecap="round"/>
      <defs><linearGradient id="rp-g2" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse"><stop stopColor="#38bdf8"/><stop offset="1" stopColor="#c084fc"/></linearGradient></defs>
    </svg>
  )
}
function IcoClock() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="url(#rp-g3)" strokeWidth="1.8"/>
      <path d="M12 7v5l3.5 3.5" stroke="url(#rp-g3)" strokeWidth="2" strokeLinecap="round"/>
      <defs><linearGradient id="rp-g3" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse"><stop stopColor="#fbbf24"/><stop offset="1" stopColor="#f97316"/></linearGradient></defs>
    </svg>
  )
}
function IcoTag() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" stroke="url(#rp-g4)" strokeWidth="1.8" fill="none"/>
      <circle cx="7" cy="7" r="1.5" fill="url(#rp-g4)"/>
      <defs><linearGradient id="rp-g4" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse"><stop stopColor="#4ade80"/><stop offset="1" stopColor="#38bdf8"/></linearGradient></defs>
    </svg>
  )
}
function IcoBell() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="url(#rp-g5)" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="url(#rp-g5)" strokeWidth="1.8" strokeLinecap="round"/>
      <defs><linearGradient id="rp-g5" x1="3" y1="8" x2="21" y2="21" gradientUnits="userSpaceOnUse"><stop stopColor="#4ade80"/><stop offset="1" stopColor="#38bdf8"/></linearGradient></defs>
    </svg>
  )
}

const INPUT_BASE = {
  width: '100%', background: 'rgba(255,255,255,0.055)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10, padding: '11px 14px',
  color: 'var(--text-primary)', fontSize: 13,
  outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  fontFamily: "'Noto Sans TC', sans-serif",
}

/* ──────────────────────────────── */
export default function RegisterPage({ isOnline, toast }) {
  const [selected, setSelected]         = useState([])
  const [urls, setUrls]                 = useState({})
  const [lineUid, setLineUid]           = useState('')
  const [schedEnabled, setSchedEnabled] = useState(false)
  const [schedTime, setSchedTime]       = useState('08:00')
  const [schedDays, setSchedDays]       = useState('daily')
  const [loading, setLoading]           = useState(false)
  const [done, setDone]                 = useState(false)
  const [ownBrandsInput, setOwnBrandsInput] = useState('')

  function togglePlatform(key, disabled) {
    if (disabled) return
    setSelected(prev => {
      if (prev.includes(key)) {
        const next = prev.filter(k => k !== key)
        setUrls(u => { const c = { ...u }; delete c[key]; return c })
        return next
      }
      if (prev.length >= 3) return prev
      setUrls(u => ({ ...u, [key]: [''] }))
      return [...prev, key]
    })
  }

  function setUrl(platformKey, idx, value) {
    setUrls(prev => {
      const list = [...(prev[platformKey] || [''])]
      list[idx] = value
      return { ...prev, [platformKey]: list }
    })
  }
  function addUrl(platformKey) {
    setUrls(prev => ({ ...prev, [platformKey]: [...(prev[platformKey] || ['']), ''] }))
  }
  function removeUrl(platformKey, idx) {
    setUrls(prev => {
      const list = prev[platformKey].filter((_, i) => i !== idx)
      return { ...prev, [platformKey]: list.length ? list : [''] }
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!isOnline) { toast('⚠ 後端離線，請稍後再試', 'error'); return }
    if (selected.length === 0) { toast('請至少選擇一個平台', 'error'); return }
    const confirmed = window.confirm('⚠ 初始設定將會清除所有現有的監控商品與爬蟲網址，確定要繼續嗎？')
    if (!confirmed) return

    const entries = []
    for (const key of selected) {
      const p = PLATFORMS.find(pl => pl.key === key)
      const list = (urls[key] || []).map(u => u.trim()).filter(Boolean)
      list.forEach((url, i) => entries.push({ url, label: `${p.name} 分類頁${list.length > 1 ? ` ${i + 1}` : ''}` }))
    }

    setLoading(true)
    try {
      await api.clearAllScraperUrls()
      await api.deleteAllProducts()
      await api.deleteAllClientProducts()
      for (const { url, label } of entries) await api.addScraperUrl(url, label)
      await api.setSchedule({ enabled: schedEnabled, time: schedTime, days: schedDays })
      const brands = ownBrandsInput.split(/[,，\n]/).map(b => b.trim()).filter(Boolean)
      if (brands.length > 0) await api.setOwnBrands(brands)
      if (lineUid.trim()) {
        const current = await api.getLineSettings().catch(() => ({}))
        await api.saveLineSettings({ ...current, user_id: lineUid.trim() })
      }
      setDone(true)
      toast(`✅ 設定完成！共新增 ${entries.length} 筆網址`, 'success')
    } catch (err) {
      toast(`儲存失敗：${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  /* ── Success Screen ── */
  if (done) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: INJECT_CSS }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '78vh', padding: '0 24px' }}>
          <div style={{ textAlign: 'center', maxWidth: 460, animation: 'rp-fadeUp 0.6s ease both' }}>
            <div style={{
              width: 96, height: 96, margin: '0 auto 28px',
              borderRadius: '50%',
              background: 'radial-gradient(circle at 40% 40%, rgba(155,109,202,0.25), rgba(212,149,106,0.15))',
              border: '1.5px solid rgba(155,109,202,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'rp-pulseRing 2.5s ease-in-out infinite',
            }}>
              <svg width="46" height="46" viewBox="0 0 46 46" fill="none">
                <circle cx="23" cy="23" r="18" stroke="url(#sc-g)" strokeWidth="1.5" fill="none" opacity="0.4"/>
                <path d="M14 23l7 7 11-12" stroke="url(#sc-g)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                <defs>
                  <linearGradient id="sc-g" x1="5" y1="5" x2="41" y2="41" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#c084fc"/><stop offset="1" stopColor="#d4956a"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.25em', color: 'var(--amethyst)', textTransform: 'uppercase', marginBottom: 14 }}>完成</div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 40, fontWeight: 300, color: 'var(--text-primary)', margin: '0 0 16px', letterSpacing: '-0.02em', lineHeight: 1 }}>
              設定已儲存
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.8, marginBottom: 36 }}>
              已清除舊資料並套用新設定。<br />
              前往「爬蟲排程」頁面立即執行，開始收集價格資料。
            </p>
            <button
              className="rp-submit"
              onClick={() => { setDone(false); setSelected([]); setUrls({}); setLineUid(''); setSchedEnabled(false) }}
            >重新設定</button>
          </div>
        </div>
      </>
    )
  }

  const stepBase = selected.length > 0 ? 1 : 0

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: INJECT_CSS }} />
      <div style={{ padding: '36px 24px 80px', maxWidth: 820, margin: '0 auto' }}>

        {/* ── Hero ── */}
        <div style={{
          marginBottom: 32,
          padding: '36px 32px',
          borderRadius: 20,
          background: 'linear-gradient(135deg, rgba(155,109,202,0.1) 0%, rgba(212,149,106,0.07) 50%, rgba(0,0,0,0) 100%)',
          border: '1px solid rgba(155,109,202,0.15)',
          position: 'relative', overflow: 'hidden',
          animation: 'rp-fadeUp 0.5s ease both',
        }}>
          <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(212,149,106,0.12) 0%, transparent 70%)', pointerEvents: 'none' }}/>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.28em', color: 'var(--amethyst)', textTransform: 'uppercase', marginBottom: 14 }}>
            初始化 · SETUP
          </div>
          <h1 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 46, fontWeight: 300, letterSpacing: '-0.025em', lineHeight: 1.05,
            background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--rose-light) 45%, var(--amethyst-light) 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            margin: '0 0 14px',
          }}>
            競品監控設定
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.7, margin: 0, maxWidth: 520 }}>
            選擇最多 3 個要追蹤的電商平台，填入分類頁網址，並設定排程與 LINE 推播。
          </p>
        </div>

        {/* ── Warning Banner ── */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          background: 'linear-gradient(135deg, rgba(251,191,36,0.07), rgba(239,68,68,0.05))',
          border: '1px solid rgba(251,191,36,0.22)',
          borderLeft: '3px solid #fbbf24',
          borderRadius: '0 12px 12px 0',
          padding: '14px 18px', marginBottom: 28,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="#fbbf24" strokeWidth="2" strokeLinejoin="round"/>
            <line x1="12" y1="9" x2="12" y2="13" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="12" cy="17" r="0.5" fill="#fbbf24" stroke="#fbbf24" strokeWidth="1.5"/>
          </svg>
          <p style={{ color: '#fde68a', fontSize: 13, lineHeight: 1.65, margin: 0 }}>
            送出後將<strong style={{ color: '#fbbf24' }}>清除所有現有的監控商品與爬蟲網址</strong>，請確認後再執行。
          </p>
        </div>

        <form onSubmit={handleSubmit}>

          {/* ── Step 1: Platforms ── */}
          <div className="rp-section" style={{ animationDelay: '0ms' }}>
            <SectionHead
              icon={<IcoGrid />}
              title="選擇監控平台"
              sub="最多選擇 3 個電商平台"
              right={
                <div style={{
                  background: 'rgba(155,109,202,0.12)', border: '1px solid rgba(155,109,202,0.22)',
                  borderRadius: 20, padding: '4px 14px',
                }}>
                  <span style={{ fontSize: 12, color: 'var(--amethyst-light)', fontFamily: "'DM Mono', monospace" }}>
                    {selected.length} / 3
                  </span>
                </div>
              }
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {PLATFORMS.map(p => {
                const isSelected = selected.includes(p.key)
                return (
                  <div
                    key={p.key}
                    className={`rp-platform-card${isSelected ? ` rp-sel-${p.key}` : ''}${p.disabled ? ' rp-disabled' : ''}`}
                    onClick={() => togglePlatform(p.key, p.disabled)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                      <p.Icon size={38} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)', transition: 'color 0.2s' }}>
                      {p.name}
                    </div>
                    {p.disabled && (
                      <div style={{ marginTop: 5, fontSize: 9, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace", letterSpacing: '0.12em' }}>
                        SOON
                      </div>
                    )}
                    {isSelected && (
                      <div style={{
                        position: 'absolute', top: 9, right: 9,
                        width: 20, height: 20, borderRadius: '50%',
                        background: p.color, color: '#fff', fontSize: 11, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: `0 2px 8px ${p.color}70`,
                      }}>✓</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Step 2: URLs ── */}
          {selected.length > 0 && (
            <div className="rp-section" style={{ animationDelay: '60ms' }}>
              <SectionHead icon={<IcoLink />} title="填入分類頁網址" sub="選填，可新增多筆網址" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                {selected.map(key => {
                  const p = PLATFORMS.find(pl => pl.key === key)
                  const list = urls[key] || ['']
                  return (
                    <div key={key}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <p.Icon size={18} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: p.color, letterSpacing: '0.02em' }}>{p.name}</span>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>{p.hint}</p>
                      {list.map((val, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                          <input
                            className="rp-input"
                            style={INPUT_BASE}
                            type="url"
                            placeholder={p.placeholder}
                            value={val}
                            onChange={e => setUrl(key, idx, e.target.value)}
                          />
                          {list.length > 1 && (
                            <button
                              type="button"
                              className="rp-remove-btn"
                              style={{
                                flexShrink: 0, background: 'rgba(239,68,68,0.1)',
                                border: '1px solid rgba(239,68,68,0.22)', borderRadius: 8,
                                color: '#f87171', padding: '6px 12px', cursor: 'pointer', fontSize: 13,
                                transition: 'background 0.2s',
                              }}
                              onClick={() => removeUrl(key, idx)}
                            >✕</button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        className="rp-add-url-btn"
                        style={{
                          background: 'transparent',
                          border: `1px dashed ${p.color}55`,
                          borderRadius: 8, color: `${p.color}bb`,
                          padding: '7px 14px', cursor: 'pointer', fontSize: 12,
                          marginTop: 2, transition: 'opacity 0.2s',
                          fontFamily: "'DM Mono', monospace", letterSpacing: '0.05em',
                        }}
                        onClick={() => addUrl(key)}
                      >
                        + {p.name} 新增一筆網址
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Step 3: Schedule ── */}
          <div className="rp-section" style={{ animationDelay: '120ms' }}>
            <SectionHead icon={<IcoClock />} title="自動排程爬蟲" sub="設定定時自動執行頻率" />
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                cursor: 'pointer', userSelect: 'none',
                marginBottom: schedEnabled ? 20 : 0,
                padding: '14px 16px', borderRadius: 12,
                background: schedEnabled ? 'rgba(155,109,202,0.07)' : 'rgba(255,255,255,0.025)',
                border: `1px solid ${schedEnabled ? 'rgba(155,109,202,0.28)' : 'rgba(255,255,255,0.07)'}`,
                transition: 'all 0.3s',
              }}
              onClick={() => setSchedEnabled(v => !v)}
            >
              <div style={{
                width: 48, height: 26, borderRadius: 13, flexShrink: 0, position: 'relative',
                background: schedEnabled ? 'linear-gradient(135deg, #9b6dca, #d4956a)' : 'rgba(255,255,255,0.1)',
                transition: 'background 0.3s',
                boxShadow: schedEnabled ? '0 2px 12px rgba(155,109,202,0.4)' : 'none',
              }}>
                <div style={{
                  position: 'absolute', top: 4,
                  left: schedEnabled ? 26 : 4,
                  width: 18, height: 18, borderRadius: '50%',
                  background: '#fff', transition: 'left 0.3s cubic-bezier(.4,0,.2,1)',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                }}/>
              </div>
              <div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>
                  {schedEnabled ? '已開啟自動排程' : '不需要排程'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {schedEnabled ? '每天定時自動爬取' : '手動執行即可'}
                </div>
              </div>
            </div>
            {schedEnabled && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {[
                  {
                    label: '執行時間',
                    node: <input type="time" className="rp-input" style={{ ...INPUT_BASE }} value={schedTime} onChange={e => setSchedTime(e.target.value)} />,
                  },
                  {
                    label: '執行頻率',
                    node: (
                      <select className="rp-input" style={{ ...INPUT_BASE, cursor: 'pointer' }} value={schedDays} onChange={e => setSchedDays(e.target.value)}>
                        {DAYS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ),
                  },
                ].map(({ label, node }) => (
                  <div key={label}><MonoLabel>{label}</MonoLabel>{node}</div>
                ))}
              </div>
            )}
          </div>

          {/* ── Step 4: Own brands ── */}
          <div className="rp-section" style={{ animationDelay: '180ms' }}>
            <SectionHead icon={<IcoTag />} title="自有品牌設定" sub="選填，用於儀表板比價基準" />
            <MonoLabel>品牌名稱</MonoLabel>
            <textarea
              className="rp-input"
              style={{ ...INPUT_BASE, height: 88, resize: 'vertical' }}
              placeholder="例如：LANEIGE, 蘭芝, ettusais（多個請用逗號或換行分隔）"
              value={ownBrandsInput}
              onChange={e => setOwnBrandsInput(e.target.value)}
            />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.65 }}>
              填入後，儀表板將顯示自有品牌售價，方便與競品比較。
            </p>
          </div>

          {/* ── Step 5: LINE ── */}
          <div className="rp-section" style={{ animationDelay: '240ms' }}>
            <SectionHead icon={<IcoBell />} title="LINE 推播設定" sub="選填，降價警示即時推播" />
            <MonoLabel>LINE User ID</MonoLabel>
            <input
              className="rp-input"
              style={INPUT_BASE}
              type="text"
              placeholder="U1234567890abcdef…"
              value={lineUid}
              onChange={e => setLineUid(e.target.value)}
            />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.65 }}>
              填入後，降價警示與每日早報將推送至你的 LINE。
            </p>
          </div>

          {/* ── Submit ── */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8, gap: 14, alignItems: 'center' }}>
            {selected.length === 0 && (
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>請先選擇至少一個平台</span>
            )}
            <button type="submit" className="rp-submit" disabled={loading || selected.length === 0}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ animation: 'rp-spin 0.9s linear infinite' }}>
                    <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/>
                    <path d="M12 3a9 9 0 0 1 9 9" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                  設定中…
                </span>
              ) : '完成設定 →'}
            </button>
          </div>

        </form>
      </div>
    </>
  )
}
