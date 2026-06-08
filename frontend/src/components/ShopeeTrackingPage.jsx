import { useState, useEffect } from 'react'
import { api } from '../api'

export default function ShopeeTrackingPage({ isOnline, toast }) {
  const [kwList,           setKwList]           = useState([])
  const [kwAddLoading,     setKwAddLoading]     = useState(false)
  const [kwResults,        setKwResults]        = useState(null)
  const [kwResultsId,      setKwResultsId]      = useState(null)
  const [kwResultsLoading, setKwResultsLoading] = useState(false)
  const [kwRunning,        setKwRunning]        = useState({})
  const [kwNewInput,       setKwNewInput]       = useState('')
  const [kwSort,           setKwSort]           = useState('created_desc')
  const [kwResultsSort,    setKwResultsSort]    = useState('default')

  useEffect(() => {
    if (!isOnline) return
    api.getShopeeKeywords()
      .then(kwData => { if (kwData) setKwList(kwData) })
      .catch(() => {})
  }, [isOnline])

  async function handleKwDirectAdd() {
    const keyword = kwNewInput.trim()
    if (!keyword) return
    setKwAddLoading(true)
    try {
      await api.addShopeeKeyword(keyword, 30, [])
      const updated = await api.getShopeeKeywords()
      setKwList(updated)
      setKwNewInput('')
      toast(`已新增「${keyword}」到追蹤清單`, 'success')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setKwAddLoading(false)
    }
  }

  async function handleKwTagClick(kw) {
    if (kwResultsId === kw.id) return
    setKwResultsId(kw.id)
    setKwResults(null)
    if (!kw.last_run_at) return
    setKwResultsLoading(true)
    try {
      const data = await api.getShopeeKeywordResults(kw.id)
      setKwResults(data)
    } catch { setKwResults(null) }
    finally { setKwResultsLoading(false) }
  }

  const sortedKwList = [...kwList].sort((a, b) => {
    if (kwSort === 'created_asc')  return new Date(a.created_at) - new Date(b.created_at)
    if (kwSort === 'name_asc')     return a.keyword.localeCompare(b.keyword, 'zh-Hant')
    if (kwSort === 'last_run')     return new Date(b.last_run_at || 0) - new Date(a.last_run_at || 0)
    if (kwSort === 'count_desc')   return (b.item_count || 0) - (a.item_count || 0)
    return new Date(b.created_at) - new Date(a.created_at)
  })

  const sortedResults = [...(kwResults?.items || [])].sort((a, b) => {
    if (kwResultsSort === 'price_asc')  return (a.price ?? Infinity) - (b.price ?? Infinity)
    if (kwResultsSort === 'price_desc') return (b.price ?? -1) - (a.price ?? -1)
    if (kwResultsSort === 'rating')     return (b.rating ?? 0) - (a.rating ?? 0)
    if (kwResultsSort === 'sold')       return (b.sold_count ?? 0) - (a.sold_count ?? 0)
    if (kwResultsSort === 'mall_first') return (b.is_mall ? 1 : 0) - (a.is_mall ? 1 : 0)
    return 0
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '4px 0' }}>

      {/* ── 頁面標題 ── */}
      <div style={{
        padding: '20px 24px',
        background: 'rgba(249,115,22,0.05)',
        border: '1px solid rgba(249,115,22,0.15)',
        borderRadius: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.2em', color: '#fb923c', textTransform: 'uppercase', marginBottom: 8 }}>
            Shopee · Keyword Tracking
          </div>
          <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 400, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>
            蝦皮關鍵字追蹤
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '6px 0 0', fontFamily: 'Noto Sans TC, sans-serif' }}>
            新增關鍵字，手動執行抓取蝦皮搜尋結果，掌握競品動態
          </p>
        </div>
      </div>

      {/* ── 主體：左欄 Tag + 右欄結果 ── */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', gap: 0, minHeight: 480 }}>

          {/* ── 左欄：關鍵字 Tag 列表 ── */}
          <div style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 16 }}>

            {/* 新增輸入 */}
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                className="input-styled"
                style={{ flex: 1, fontSize: 12, padding: '6px 10px' }}
                placeholder="品牌名 + 產品名，例：資生堂精華液"
                value={kwNewInput ?? ''}
                onChange={e => setKwNewInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !kwAddLoading && kwNewInput?.trim() && handleKwDirectAdd()}
                disabled={kwAddLoading}
              />
              <button
                className="btn btn-primary"
                style={{ fontSize: 13, padding: '6px 12px', whiteSpace: 'nowrap' }}
                disabled={kwAddLoading || !kwNewInput?.trim()}
                onClick={handleKwDirectAdd}
              >
                {kwAddLoading ? '…' : '+'}
              </button>
            </div>
            <div style={{
              fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6,
              padding: '7px 10px', borderRadius: 8,
              background: 'rgba(249,115,22,0.07)',
              border: '1px solid rgba(249,115,22,0.18)',
            }}>
              建議輸入「品牌 + 品類」，如「蘭蔻精華」、「SKII 神仙水」，搜尋結果更精準
            </div>

            {/* 排序 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>排序</span>
              <select
                value={kwSort}
                onChange={e => setKwSort(e.target.value)}
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6, padding: '3px 6px', color: 'var(--text-primary)',
                  fontSize: 11, fontFamily: 'Noto Sans TC, sans-serif', outline: 'none', cursor: 'pointer',
                }}
              >
                <option value="created_desc" style={{ background: '#1a1630' }}>建立（新→舊）</option>
                <option value="created_asc"  style={{ background: '#1a1630' }}>建立（舊→新）</option>
                <option value="name_asc"     style={{ background: '#1a1630' }}>名稱 A→Z</option>
                <option value="last_run"     style={{ background: '#1a1630' }}>最近執行</option>
                <option value="count_desc"   style={{ background: '#1a1630' }}>商品數量↓</option>
              </select>
            </div>

            {/* Tag 列表 */}
            {sortedKwList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 12, fontFamily: 'Noto Sans TC, sans-serif' }}>
                尚無追蹤關鍵字<br />
                <span style={{ fontSize: 11, opacity: 0.6 }}>在上方輸入框新增</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', maxHeight: 560 }}>
                {sortedKwList.map(kw => {
                  const isActive = kwResultsId === kw.id
                  return (
                    <div
                      key={kw.id}
                      onClick={() => handleKwTagClick(kw)}
                      style={{
                        background: isActive ? 'rgba(249,115,22,0.1)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${isActive ? 'rgba(249,115,22,0.45)' : 'rgba(255,255,255,0.08)'}`,
                        borderRadius: 8, padding: '8px 10px',
                        cursor: 'pointer', transition: 'all 0.18s',
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = 'rgba(249,115,22,0.3)' }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
                    >
                      {/* 上排：名稱 + 操作按鈕 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          flex: 1, fontSize: 13, fontWeight: isActive ? 600 : 500,
                          color: isActive ? '#fb923c' : 'var(--text-primary)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {kw.keyword}
                        </span>

                        {/* 立即執行 */}
                        <button
                          title="立即執行"
                          disabled={!!kwRunning[kw.id]}
                          onClick={async e => {
                            e.stopPropagation()
                            setKwRunning(prev => ({ ...prev, [kw.id]: true }))
                            toast(`正在抓取「${kw.keyword}」，請稍候…`, 'success')
                            try {
                              const res = await api.runShopeeKeyword(kw.id)
                              toast(`「${kw.keyword}」完成，共 ${res.count} 筆`, 'success')
                              const updated = await api.getShopeeKeywords()
                              setKwList(updated)
                              // 執行完後不管是否已選中，都自動切換到該 tag 並顯示結果
                              setKwResultsId(kw.id)
                              setKwResultsLoading(true)
                              try { setKwResults(await api.getShopeeKeywordResults(kw.id)) }
                              catch { setKwResults(null) }
                              finally { setKwResultsLoading(false) }
                            } catch (err) {
                              toast(`「${kw.keyword}」執行失敗：${err.message}`, 'error')
                            } finally {
                              setKwRunning(prev => ({ ...prev, [kw.id]: false }))
                            }
                          }}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: kwRunning[kw.id] ? 'var(--text-muted)' : 'rgba(255,255,255,0.45)',
                            fontSize: 13, padding: '1px 3px', borderRadius: 4,
                            transition: 'color 0.15s', flexShrink: 0,
                          }}
                        >
                          {kwRunning[kw.id] ? '…' : '↻'}
                        </button>

                        {/* 刪除 */}
                        <button
                          title="移除追蹤"
                          onClick={async e => {
                            e.stopPropagation()
                            if (!window.confirm(`確定移除「${kw.keyword}」的追蹤嗎？`)) return
                            await api.deleteShopeeKeyword(kw.id)
                            setKwList(prev => prev.filter(k => k.id !== kw.id))
                            if (isActive) { setKwResults(null); setKwResultsId(null) }
                          }}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'rgba(248,113,113,0.5)', fontSize: 12, padding: '1px 3px',
                            borderRadius: 4, transition: 'color 0.15s', flexShrink: 0,
                          }}
                          onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                          onMouseLeave={e => e.currentTarget.style.color = 'rgba(248,113,113,0.5)'}
                        >
                          ✕
                        </button>
                      </div>

                      {/* 下排：筆數 + 上次執行 + 抓取筆數設定 */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 }}>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          {kw.last_run_at
                            ? `${kw.item_count ?? 0} 筆 · ${kw.last_run_at.slice(0, 10)}`
                            : '尚未執行'}
                        </span>
                        <select
                          value={kw.max_products || 30}
                          onClick={e => e.stopPropagation()}
                          onChange={async e => {
                            e.stopPropagation()
                            const val = Number(e.target.value)
                            try {
                              await api.updateShopeeKeyword(kw.id, { max_products: val })
                              setKwList(prev => prev.map(k => k.id === kw.id ? { ...k, max_products: val } : k))
                            } catch (err) { toast(err.message, 'error') }
                          }}
                          style={{
                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 4, padding: '1px 4px', color: 'var(--text-muted)',
                            fontSize: 10, fontFamily: 'DM Mono, monospace', outline: 'none', cursor: 'pointer',
                          }}
                        >
                          {[10, 20, 30, 40, 50].map(n => (
                            <option key={n} value={n} style={{ background: '#1a1630' }}>{n} 筆</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── 分隔線 ── */}
          <div style={{ width: 1, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

          {/* ── 右欄：結果展示 ── */}
          <div style={{ flex: 1, minWidth: 0, paddingLeft: 20 }}>

            {!kwResultsId && (
              <div style={{
                height: '100%', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-muted)', fontSize: 13,
                fontFamily: 'Noto Sans TC, sans-serif', gap: 12,
              }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" opacity="0.25">
                  <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" stroke="currentColor" strokeWidth="1.5"/>
                  <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                點選左側關鍵字查看追蹤結果
              </div>
            )}

            {kwResultsId && kwResultsLoading && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>
                載入中…
              </div>
            )}

            {kwResultsId && !kwResultsLoading && !kwResults && (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                height: '100%', gap: 10, color: 'var(--text-muted)', fontSize: 13,
                fontFamily: 'Noto Sans TC, sans-serif',
              }}>
                此關鍵字尚無結果，請先點「↻」執行抓取
              </div>
            )}

            {kwResultsId && !kwResultsLoading && kwResults && (
              <>
                {/* 工具列：資訊 + 排序 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    抓取時間：{kwResults.run_at}　共 {kwResults.item_count} 筆
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>排序</span>
                    <select
                      value={kwResultsSort}
                      onChange={e => setKwResultsSort(e.target.value)}
                      style={{
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 6, padding: '3px 8px', color: 'var(--text-primary)',
                        fontSize: 12, fontFamily: 'Noto Sans TC, sans-serif', outline: 'none', cursor: 'pointer',
                      }}
                    >
                      <option value="default"    style={{ background: '#1a1630' }}>預設</option>
                      <option value="price_asc"  style={{ background: '#1a1630' }}>價格低→高</option>
                      <option value="price_desc" style={{ background: '#1a1630' }}>價格高→低</option>
                      <option value="rating"     style={{ background: '#1a1630' }}>評分高→低</option>
                      <option value="sold"       style={{ background: '#1a1630' }}>銷售量高→低</option>
                      <option value="mall_first" style={{ background: '#1a1630' }}>Mall 優先</option>
                    </select>
                  </div>
                </div>

                {/* 商品卡片格 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                  {sortedResults.map((item, i) => (
                    <a key={i} href={item.url} target="_blank" rel="noopener noreferrer"
                      style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div
                        style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', transition: 'border-color 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(249,115,22,0.5)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                      >
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name}
                            style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
                            onError={e => { e.target.style.display = 'none' }} />
                        ) : (
                          <div style={{ width: '100%', aspectRatio: '1', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: 'var(--text-muted)' }}>🛍</div>
                        )}
                        <div style={{ padding: '8px 10px' }}>
                          <div style={{ fontSize: 11, lineHeight: 1.5, marginBottom: 6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', color: 'var(--text-primary)' }}>
                            {item.name}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                            {item.price != null && (
                              <span style={{ fontSize: 14, fontWeight: 700, color: '#fb923c' }}>
                                NT$ {item.price.toLocaleString()}
                              </span>
                            )}
                            {item.original_price != null && item.original_price !== item.price && (
                              <span style={{ fontSize: 10, color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                                {item.original_price.toLocaleString()}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginTop: 3 }}>
                            {item.is_mall && (
                              <span style={{ fontSize: 10, background: 'rgba(249,115,22,0.15)', color: '#fb923c', borderRadius: 4, padding: '1px 5px', fontWeight: 500 }}>Mall</span>
                            )}
                            {item.rating != null && (
                              <span style={{ fontSize: 10, color: '#facc15' }}>★ {Number(item.rating).toFixed(1)}</span>
                            )}
                            {item.sold_count != null && (
                              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>售 {item.sold_count}</span>
                            )}
                          </div>
                          {item.shop_name && (
                            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 3, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                              🏪 {item.shop_name}
                            </div>
                          )}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
