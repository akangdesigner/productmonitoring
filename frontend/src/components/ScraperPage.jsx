import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'

const PLATFORM_LABEL = { watsons: '屈臣氏', cosmed: '康是美', poya: '寶雅', pchome: 'PChome' }
const PLATFORM_CLASS = { watsons: 'pb-watsons', cosmed: 'pb-cosmed', poya: 'pb-poya', pchome: 'pb-watsons' }
const DAYS_LABEL = { daily: '每天', weekdays: '週一至五', 'mon-wed-fri': '週一、三、五', weekly: '每週一' }

// 計算下次執行的具體日期時間（Asia/Taipei）
function nextRunTime(time, days) {
  const validDays = {
    daily:         [0, 1, 2, 3, 4, 5, 6],
    weekdays:      [1, 2, 3, 4, 5],
    'mon-wed-fri': [1, 3, 5],
    weekly:        [1],
  }[days] ?? [0, 1, 2, 3, 4, 5, 6]

  const [hh, mm] = time.split(':').map(Number)
  // 用 toLocaleString 把「現在」轉成台北本地時間的數字
  const taipeiNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }))

  for (let i = 0; i <= 7; i++) {
    const d = new Date(taipeiNow)
    d.setDate(d.getDate() + i)
    d.setHours(hh, mm, 0, 0)
    if (validDays.includes(d.getDay()) && d > taipeiNow) {
      const mo = String(d.getMonth() + 1).padStart(2, '0')
      const da = String(d.getDate()).padStart(2, '0')
      const ho = String(d.getHours()).padStart(2, '0')
      const mi = String(d.getMinutes()).padStart(2, '0')
      return `${mo}/${da} ${ho}:${mi}`
    }
  }
  return time
}

function detectPlatform(url) {
  if (url.includes('watsons.com.tw')) return 'watsons'
  if (url.includes('cosmed.com.tw'))  return 'cosmed'
  if (url.includes('pchome.com.tw'))  return 'pchome'
  if (url.includes('poyabuy.com.tw')) return 'poya'
  return null
}

function shortUrl(url, maxLen = 52) {
  try {
    const u = new URL(url)
    const s = u.hostname + u.pathname + (u.search ? '?…' : '')
    return s.length > maxLen ? s.slice(0, maxLen) + '…' : s
  } catch { return url.slice(0, maxLen) }
}

function statusColor(s) { return s === 'success' ? '#4ade80' : s === 'failed' ? '#f87171' : '#facc15' }
function statusLabel(s) { return s === 'success' ? '成功' : s === 'failed' ? '失敗' : '執行中' }

// ── Toggle 開關元件 ──
function Toggle({ value, onChange }) {
  return (
    <div onClick={onChange} style={{
      width: 36, height: 20, borderRadius: 10, cursor: 'pointer', flexShrink: 0,
      background: value ? 'var(--amethyst, #7c3aed)' : 'rgba(255,255,255,0.15)',
      position: 'relative', transition: 'background 0.2s',
    }}>
      <div style={{
        position: 'absolute', top: 2, left: value ? 18 : 2,
        width: 16, height: 16, borderRadius: 8,
        background: '#fff', transition: 'left 0.2s',
      }} />
    </div>
  )
}

export default function ScraperPage({ isOnline, toast }) {

  // ── 監控網址清單 ──
  const [urlList,    setUrlList]    = useState([])
  const [newUrl,      setNewUrl]      = useState('')
  const [newLabel,    setNewLabel]    = useState('')
  const [newMaxPages, setNewMaxPages] = useState(1)
  const [addLoading,  setAddLoading]  = useState(false)
  const [editId,       setEditId]       = useState(null)
  const [editLabel,    setEditLabel]    = useState('')
  const [editUrl,      setEditUrl]      = useState('')
  const [editMaxPages, setEditMaxPages] = useState(1)
  const [editSaving,   setEditSaving]   = useState(false)
  const [runningId,  setRunningId]  = useState(null)   // 正在執行的 URL id
  const [runLogs,    setRunLogs]    = useState({})      // { [id]: [...log] }

  // ── 排程 ──
  const [schedule,    setSchedule]    = useState({ enabled: false, time: '03:00', days: 'daily' })
  const [schedSaving, setSchedSaving] = useState(false)
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchResults, setBatchResults] = useState(null)
  const [batchProgress, setBatchProgress] = useState(null)

  // ── 執行歷史 ──
  const [history,     setHistory]     = useState([])
  const [histLoading, setHistLoading] = useState(false)

  // ── 蝦皮授權 ──
  const [shopeeStatus,  setShopeeStatus]  = useState(null)
  const [shopeeLoading, setShopeeLoading] = useState(false)

  // ── Apify 蝦皮關鍵字搜尋 ──
  const [apifyKeyword,    setApifyKeyword]    = useState('')
  const [apifyMax,        setApifyMax]        = useState(20)
  const [apifySort,       setApifySort]       = useState('relevancy')
  const [apifyLoading,    setApifyLoading]    = useState(false)
  const [apifyResults,    setApifyResults]    = useState(null)
  const [apifyError,      setApifyError]      = useState('')

  // ── 蝦皮關鍵字追蹤清單 ──
  const [kwList,           setKwList]           = useState([])
  const [kwAddLoading,     setKwAddLoading]     = useState(false)
  const [kwResults,        setKwResults]        = useState(null)
  const [kwResultsId,      setKwResultsId]      = useState(null)
  const [kwResultsLoading, setKwResultsLoading] = useState(false)
  const [kwRunning,        setKwRunning]        = useState({})   // { [id]: true }
  const [kwSchedule,       setKwSchedule]       = useState({ enabled: true, time: '02:00' })
  const [kwSchedSaving,    setKwSchedSaving]    = useState(false)
  const [kwNewInput,       setKwNewInput]       = useState('')
  const [kwSort,           setKwSort]           = useState('created_desc')

  const newPlatform = detectPlatform(newUrl)

  const loadAll = useCallback(async () => {
    if (!isOnline) return
    try {
      const [urls, sched, hist, status, shopee, kwData, kwSched] = await Promise.all([
          api.getScraperUrls(),
          api.getSchedule(),
          api.getScraperHistory(10),
          api.getScraperStatus(),
          api.getShopeeAuthStatus(),
          api.getShopeeKeywords(),
          api.getShopeeKeywordSchedule(),
        ])
      if (shopee)  setShopeeStatus(shopee)
      if (urls)    setUrlList(urls)
      if (sched)   setSchedule({ enabled: sched.enabled, time: sched.time, days: sched.days })
      if (hist)    setHistory(hist)
      if (status && status.status === 'running') setBatchRunning(true)
      if (kwData)  setKwList(kwData)
      if (kwSched) setKwSchedule(kwSched)
    } catch (err) {
      toast(`載入資料失敗：${err.message}`, 'error')
    }
  }, [isOnline, toast])

  useEffect(() => { loadAll() }, [loadAll])

  // ── 新增網址 ──
  async function handleAdd() {
    if (!newUrl.trim())   { toast('請輸入網址', 'error'); return }
    if (!newPlatform)     { toast('無法辨識平台', 'error'); return }
    if (!isOnline)        { toast('後端離線', 'error'); return }
    setAddLoading(true)
    try {
      const entry = await api.addScraperUrl(newUrl.trim(), newLabel.trim() || undefined, newMaxPages)
      setUrlList(prev => [...prev, entry])
      setNewUrl('')
      setNewLabel('')
      setNewMaxPages(1)
      toast(`已新增「${entry.label}」`, 'success')
    } catch (err) {
      toast(`新增失敗：${err.message}`, 'error')
    }
    setAddLoading(false)
  }

  // ── 切換啟用 ──
  async function handleToggle(id, current) {
    if (!isOnline) return
    try {
      const updated = await api.toggleScraperUrl(id, !current)
      setUrlList(prev => prev.map(u => u.id === id ? { ...u, enabled: updated.enabled } : u))
    } catch (err) {
      toast(`操作失敗：${err.message}`, 'error')
    }
  }

  // ── 刪除 ──
  async function handleDelete(id, label) {
    if (!isOnline) return
    if (!window.confirm(`確定要刪除「${label}」？`)) return
    try {
      await api.deleteScraperUrl(id)
      setUrlList(prev => prev.filter(u => u.id !== id))
      toast('已刪除', 'success')
    } catch (err) {
      toast(`刪除失敗：${err.message}`, 'error')
    }
  }

  function startEdit(entry) {
    setEditId(entry.id)
    setEditLabel(entry.label || '')
    setEditUrl(entry.url || '')
    setEditMaxPages(entry.maxPages ?? 1)
  }

  function cancelEdit() {
    setEditId(null)
    setEditLabel('')
    setEditUrl('')
    setEditMaxPages(1)
    setEditSaving(false)
  }

  async function saveEdit(entry) {
    if (!isOnline) { toast('後端離線', 'error'); return }
    const nextLabel = editLabel.trim()
    const nextUrl   = editUrl.trim()
    if (!nextLabel) { toast('自訂名稱不可為空', 'error'); return }
    if (!nextUrl)   { toast('網址不可為空', 'error'); return }
    if (nextLabel === entry.label && nextUrl === entry.url && editMaxPages === (entry.maxPages ?? 1)) { cancelEdit(); return }

    setEditSaving(true)
    try {
      const body = { label: nextLabel, maxPages: editMaxPages }
      if (nextUrl !== entry.url) body.url = nextUrl
      const res = await fetch(`/api/scraper/urls/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const updated = await res.json()
      setUrlList(prev => prev.map(u => u.id === entry.id ? { ...u, label: updated.label, url: updated.url, platform: updated.platform, maxPages: updated.maxPages } : u))
      toast('已更新', 'success')
      cancelEdit()
    } catch (err) {
      toast(`更新失敗：${err.message}`, 'error')
      setEditSaving(false)
    }
  }

  // ── 監控背景任務狀態 ──
  useEffect(() => {
    let timer;
    if (batchRunning) {
      timer = setInterval(async () => {
        try {
          const prog = await api.getScraperProgress();
          setBatchProgress(prog);
          if (!prog.running) {
            setBatchRunning(false);
            if (prog.phase === 'done') {
              loadAll();
              toast('批次抓取已完成', 'success');
            }
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }, 3000);
    }
    return () => clearInterval(timer);
  }, [batchRunning, loadAll, toast]);

  // ── 批次手動抓取（執行所有已啟用網址）──
  async function handleBatchScrape() {
    if (!isOnline) { toast('後端離線', 'error'); return }
    const enabled = urlList.filter(u => u.enabled)
    if (!enabled.length) { toast('尚無已啟用的監控網址', 'error'); return }
    setBatchRunning(true)
    setBatchResults(null)
    setBatchProgress(null)
    try {
      const data = await api.runScraperEnabled()
      toast(data.message || '批次抓取已啟動，請稍候…', 'success')
      // 啟動後由 useEffect 負責輪詢
    } catch (err) {
      toast(`批次抓取啟動失敗：${err.message}`, 'error')
      setBatchRunning(false)
    }
  }

  // ── 立即執行單一 URL ──
  async function handleRunUrl(entry) {
    if (!isOnline) { toast('後端離線', 'error'); return }
    setRunningId(entry.id)
    setRunLogs(prev => ({
      ...prev,
      [entry.id]: [{ ok: true, msg: `正在爬取 ${PLATFORM_LABEL[entry.platform]}…` }],
    }))
    try {
      const result = await api.scrapeUrl(entry.url)
      const logs = [
        { ok: true, msg: `完成！共 ${result.total} 筆 · 新增 ${result.added} · 更新 ${result.updated}` },
        ...(result.priceChanges?.length
          ? result.priceChanges.map(c => ({ ok: true, msg: `💰 ${c}` }))
          : [{ ok: true, msg: '本次無價格異動' }]),
      ]
      setRunLogs(prev => ({ ...prev, [entry.id]: logs }))
      toast(`「${entry.label}」爬取完成`, 'success')
      loadAll()
    } catch (err) {
      setRunLogs(prev => ({ ...prev, [entry.id]: [{ ok: false, msg: `失敗：${err.message}` }] }))
      toast(`爬取失敗：${err.message}`, 'error')
    }
    setRunningId(null)
  }

  // ── 儲存排程 ──
  async function handleSaveSchedule() {
    if (!isOnline) { toast('後端離線', 'error'); return }
    setSchedSaving(true)
    try {
      await api.setSchedule(schedule)
      toast('排程設定已儲存', 'success')
    } catch (err) {
      toast(`儲存失敗：${err.message}`, 'error')
    }
    setSchedSaving(false)
  }

  // ── 蝦皮授權 handler ──
  async function handleShopeeImport() {
    if (!isOnline) { toast('後端離線', 'error'); return }
    setShopeeLoading(true)
    try {
      const res = await api.importShopeeAuth()
      toast(res.message, 'success')
      const status = await api.getShopeeAuthStatus()
      setShopeeStatus(status)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setShopeeLoading(false)
    }
  }

  // ── 追蹤清單直接新增關鍵字（不爬，之後排程或手動執行才抓） ──
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

  // ── Apify 搜尋 handler ──
  async function handleApifySearch() {
    if (!apifyKeyword.trim()) { toast('請輸入搜尋關鍵字', 'error'); return }
    if (!isOnline) { toast('後端離線', 'error'); return }
    setApifyLoading(true)
    setApifyResults(null)
    setApifyError('')
    try {
      const data = await api.apifyShopeeSearch(apifyKeyword.trim(), apifyMax, apifySort)
      setApifyResults(data)
    } catch (err) {
      setApifyError(err.message)
    } finally {
      setApifyLoading(false)
    }
  }

  const enabledUrls = urlList.filter(u => u.enabled)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ══════════════════════════════════════════════
          一、監控網址管理
      ══════════════════════════════════════════════ */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div className="section-title" style={{ marginBottom: 18 }}>監控網址管理</div>

        {/* 新增輸入列 */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ flex: 2, minWidth: 240 }}>
            <input
              className="input-styled"
              style={{ width: '100%' }}
              placeholder="貼上商品頁或分類頁網址…"
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            {newUrl && (
              <div style={{ marginTop: 5, fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
                {newPlatform
                  ? <><span style={{ color: 'var(--text-muted)' }}>偵測到：</span><span className={`platform-badge ${PLATFORM_CLASS[newPlatform]}`}>{PLATFORM_LABEL[newPlatform]}</span></>
                  : <span style={{ color: '#f87171' }}>⚠ 無法辨識平台（支援屈臣氏、康是美、寶雅）</span>
                }
              </div>
            )}
          </div>
          <input
            className="input-styled"
            style={{ flex: 1, minWidth: 140 }}
            placeholder="自訂名稱（選填）"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <select
            value={newMaxPages}
            onChange={e => setNewMaxPages(Number(e.target.value))}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '6px 10px',
              color: 'var(--text-primary)', fontSize: 13,
              fontFamily: 'DM Mono, monospace',
              cursor: 'pointer', outline: 'none',
              minWidth: 90,
            }}
          >
            <option value={1} style={{ background: '#1a1630' }}>1 頁</option>
            <option value={3} style={{ background: '#1a1630' }}>3 頁</option>
            <option value={5} style={{ background: '#1a1630' }}>5 頁</option>
            <option value={10} style={{ background: '#1a1630' }}>10 頁</option>
            <option value={0} style={{ background: '#1a1630' }}>全部</option>
          </select>
          <button
            className="btn btn-primary"
            onClick={handleAdd}
            disabled={addLoading || !newUrl || !newPlatform}
            style={{ whiteSpace: 'nowrap' }}
          >
            {addLoading ? '新增中…' : '+ 新增'}
          </button>
        </div>

        {/* 網址清單 */}
        {urlList.length === 0 ? (
          <div style={{
            border: '1px dashed var(--border)', borderRadius: 8,
            padding: '28px 0', textAlign: 'center',
            color: 'var(--text-muted)', fontSize: 13,
          }}>
            尚未新增任何監控網址，從上方輸入開始吧！
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {urlList.map(entry => (
              <div key={entry.id} style={{
                background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 14px', position: 'relative',
                opacity: entry.enabled ? 1 : 0.5,
              }}>
                {/* 主列 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <Toggle value={entry.enabled} onChange={() => handleToggle(entry.id, entry.enabled)} />
                  <span className={`platform-badge ${PLATFORM_CLASS[entry.platform]}`}>
                    {PLATFORM_LABEL[entry.platform]}
                  </span>
                  <div style={{ flex: 1 }}>
                    {editId === entry.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <input
                          className="input-styled"
                          style={{ width: '100%' }}
                          placeholder="自訂名稱"
                          value={editLabel}
                          onChange={e => setEditLabel(e.target.value)}
                          disabled={editSaving}
                          autoFocus
                        />
                        <input
                          className="input-styled"
                          style={{ width: '100%', fontSize: 12 }}
                          placeholder="監控網址"
                          value={editUrl}
                          onChange={e => setEditUrl(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && saveEdit(entry)}
                          disabled={editSaving}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>爬取頁數</span>
                          <select
                            value={editMaxPages}
                            onChange={e => setEditMaxPages(Number(e.target.value))}
                            disabled={editSaving}
                            style={{
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: 8, padding: '4px 8px',
                              color: 'var(--text-primary)', fontSize: 12,
                              fontFamily: 'DM Mono, monospace',
                              cursor: 'pointer', outline: 'none',
                            }}
                          >
                            <option value={1} style={{ background: '#1a1630' }}>1 頁</option>
                            <option value={3} style={{ background: '#1a1630' }}>3 頁</option>
                            <option value={5} style={{ background: '#1a1630' }}>5 頁</option>
                            <option value={10} style={{ background: '#1a1630' }}>10 頁</option>
                            <option value={0} style={{ background: '#1a1630' }}>全部</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            className="btn btn-primary"
                            style={{ fontSize: 11, padding: '4px 10px' }}
                            onClick={() => saveEdit(entry)}
                            disabled={editSaving}
                          >
                            {editSaving ? '儲存中…' : '儲存'}
                          </button>
                          <button
                            className="btn btn-ghost"
                            style={{ fontSize: 11, padding: '4px 10px' }}
                            onClick={cancelEdit}
                            disabled={editSaving}
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{entry.label}</div>
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: 11, padding: '4px 10px' }}
                          onClick={() => startEdit(entry)}
                        >
                          ✎ 編輯
                        </button>
                      </div>
                    )}
                    {editId !== entry.id && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ wordBreak: 'break-all' }}>{shortUrl(entry.url)}</span>
                        <span style={{
                          background: 'rgba(155,109,202,0.15)', color: 'var(--amethyst-light)',
                          borderRadius: 4, padding: '1px 6px', fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0,
                        }}>
                          {entry.maxPages === 0 ? '全部頁' : `${entry.maxPages ?? 1} 頁`}
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 11, padding: '4px 10px' }}
                    onClick={() => handleRunUrl(entry)}
                    disabled={runningId === entry.id}
                  >
                    {runningId === entry.id ? '⏳ 執行中…' : '▶ 立即爬取'}
                  </button>
                  {runningId === entry.id && (
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
                      <div className="scrape-progress-indeterminate" style={{ height: '100%' }} />
                    </div>
                  )}
                  <button
                    onClick={() => handleDelete(entry.id, entry.label)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#f87171', fontSize: 15, padding: '2px 6px',
                    }}
                    title="刪除"
                  >✕</button>
                </div>

                {/* 執行 Log（若有） */}
                {runLogs[entry.id]?.length > 0 && (
                  <div style={{
                    marginTop: 8, background: 'rgba(0,0,0,0.3)', borderRadius: 6,
                    padding: '6px 10px', fontFamily: 'monospace', fontSize: 11, lineHeight: 1.7,
                  }}>
                    {runLogs[entry.id].map((l, i) => (
                      <div key={i} style={{ color: l.ok ? '#cbd5e1' : '#f87171' }}>{l.msg}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════
          二、自動排程設定
      ══════════════════════════════════════════════ */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="section-title">自動排程設定</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={handleBatchScrape}
              disabled={batchRunning || !isOnline}
              style={{ fontSize: 12, padding: '6px 14px' }}
            >
              {batchRunning ? '⏳ 執行中…' : '▶ 批次手動抓取'}
            </button>
            {batchRunning && (
              <div className="scrape-progress-wrap">
                <div className="scrape-progress-label">
                  {batchProgress?.message || '準備中...'}
                  {batchProgress?.total > 0 && batchProgress.phase !== 'scraping' &&
                    ` (${Math.round((batchProgress.current / batchProgress.total) * 100)}%)`}
                </div>
                <div className="scrape-progress-track">
                  {batchProgress?.total > 0
                    ? <div className="scrape-progress-fill" style={{ width: `${Math.max(4, Math.round((batchProgress.current / batchProgress.total) * 100))}%` }} />
                    : <div className="scrape-progress-indeterminate" />}
                </div>
              </div>
            )}
            <Toggle
              value={schedule.enabled}
              onChange={() => setSchedule(s => ({ ...s, enabled: !s.enabled }))}
            />
            <span style={{ fontSize: 13, color: schedule.enabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {schedule.enabled ? '排程已啟用' : '排程已停用'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>執行時間</div>
            <input
              type="time"
              className="input-styled"
              value={schedule.time}
              onChange={e => setSchedule(s => ({ ...s, time: e.target.value }))}
              style={{ width: 120 }}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>執行頻率</div>
            <select
              className="select-styled"
              value={schedule.days}
              onChange={e => setSchedule(s => ({ ...s, days: e.target.value }))}
            >
              {Object.entries(DAYS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleSaveSchedule}
            disabled={schedSaving}
          >
            {schedSaving ? '儲存中…' : '儲存設定'}
          </button>
        </div>

        {/* 預計爬取的網址清單 */}
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
          {schedule.enabled ? '排程執行時將爬取以下已啟用的網址：' : '啟用排程後，將自動爬取以下網址：'}
        </div>
        {enabledUrls.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            （尚無已啟用的監控網址，請先在上方新增）
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {enabledUrls.map(u => (
              <div key={u.id} style={{
                background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '5px 10px', fontSize: 12,
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className={`platform-badge ${PLATFORM_CLASS[u.platform]}`} style={{ fontSize: 10 }}>
                    {PLATFORM_LABEL[u.platform]}
                  </span>
                  <span style={{ fontSize: 12 }}>{u.label}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                  {shortUrl(u.url, 64)}
                </div>
              </div>
            ))}
          </div>
        )}

        {schedule.enabled && enabledUrls.length > 0 && (
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
            下次執行：{nextRunTime(schedule.time, schedule.days)}（Asia/Taipei）
          </div>
        )}

        {batchResults && (
          <div style={{ marginTop: 16, background: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>批次抓取結果</div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, marginBottom: 10 }}>
              <span style={{ color: '#4ade80' }}>✓ 成功 {batchResults.success}</span>
              <span style={{ color: batchResults.failed > 0 ? '#f87171' : 'var(--text-muted)' }}>✗ 失敗 {batchResults.failed}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {batchResults.results?.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ color: r.status === 'success' ? '#4ade80' : '#f87171', width: 16 }}>
                    {r.status === 'success' ? '✓' : '✗'}
                  </span>
                  <span className={`platform-badge ${PLATFORM_CLASS[r.platform]}`} style={{ fontSize: 10 }}>
                    {PLATFORM_LABEL[r.platform]}
                  </span>
                  <span>{r.label}</span>
                  {r.status === 'success' && (
                    <span style={{ color: 'var(--text-muted)' }}>共 {r.total} 筆 · 新增 {r.added} · 更新 {r.updated}</span>
                  )}
                  {r.status === 'failed' && (
                    <span style={{ color: '#f87171' }}>{r.error}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════
          三、蝦皮帳號授權
      ══════════════════════════════════════════════ */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div className="section-title" style={{ margin: 0 }}>蝦皮帳號授權</div>
          {shopeeStatus?.connected ? (
            <span style={{ fontSize: 11, background: 'rgba(74,222,128,0.15)', color: '#4ade80', borderRadius: 6, padding: '2px 8px' }}>
              已連線
            </span>
          ) : (
            <span style={{ fontSize: 11, background: 'rgba(248,113,113,0.15)', color: '#f87171', borderRadius: 6, padding: '2px 8px' }}>
              未授權
            </span>
          )}
        </div>

        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.8 }}>
          請先用 Chrome 開啟過 <strong style={{ color: 'var(--text-primary)' }}>shopee.tw</strong> 一次，再點下方按鈕即可完成設定。
        </div>

        {shopeeStatus?.connected && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
            上次讀取：{shopeeStatus.savedAt?.slice(0, 10)}
            {shopeeStatus.daysSince !== null && `（${shopeeStatus.daysSince} 天前）`}
          </div>
        )}

        <button
          className="btn btn-primary"
          onClick={handleShopeeImport}
          disabled={shopeeLoading}
        >
          {shopeeLoading ? '讀取中…' : shopeeStatus?.connected ? '重新讀取 Cookie' : '讀取 Chrome Cookie'}
        </button>
      </div>

      {/* ══════════════════════════════════════════════
          四、蝦皮關鍵字搜尋（Apify）
      ══════════════════════════════════════════════ */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div className="section-title" style={{ margin: 0 }}>蝦皮關鍵字搜尋</div>
          <span style={{
            fontSize: 10, background: 'rgba(249,115,22,0.15)', color: '#fb923c',
            borderRadius: 6, padding: '2px 8px', fontWeight: 500, letterSpacing: 0.5,
          }}>Apify</span>
        </div>

        {/* 搜尋輸入列 */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'flex-end' }}>
          <input
            className="input-styled"
            style={{ flex: 2, minWidth: 200 }}
            placeholder="輸入蝦皮搜尋關鍵字，例如：雪Q餅"
            value={apifyKeyword}
            onChange={e => setApifyKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !apifyLoading && handleApifySearch()}
            disabled={apifyLoading}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>筆數</div>
            <select
              value={apifyMax}
              onChange={e => setApifyMax(Number(e.target.value))}
              disabled={apifyLoading}
              style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, padding: '6px 10px', color: 'var(--text-primary)',
                fontSize: 13, fontFamily: 'DM Mono, monospace', cursor: 'pointer', outline: 'none',
              }}
            >
              {[10, 20, 40, 60].map(n => (
                <option key={n} value={n} style={{ background: '#1a1630' }}>{n} 筆</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>排序</div>
            <select
              value={apifySort}
              onChange={e => setApifySort(e.target.value)}
              disabled={apifyLoading}
              style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, padding: '6px 10px', color: 'var(--text-primary)',
                fontSize: 13, fontFamily: 'DM Mono, monospace', cursor: 'pointer', outline: 'none',
              }}
            >
              <option value="relevancy"  style={{ background: '#1a1630' }}>相關度</option>
              <option value="sales"      style={{ background: '#1a1630' }}>銷量</option>
              <option value="price_asc"  style={{ background: '#1a1630' }}>價格低到高</option>
              <option value="price_desc" style={{ background: '#1a1630' }}>價格高到低</option>
            </select>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleApifySearch}
            disabled={apifyLoading || !apifyKeyword.trim()}
            style={{ alignSelf: 'flex-end' }}
          >
            {apifyLoading ? '搜尋中…' : '搜尋'}
          </button>
        </div>

        {/* 載入中 */}
        {apifyLoading && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            <div style={{ marginBottom: 12 }}>透過 Apify 爬取蝦皮，最多需 1 分鐘…</div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div className="scrape-progress-track" style={{ width: 240 }}>
                <div className="scrape-progress-indeterminate" />
              </div>
            </div>
          </div>
        )}

        {/* 錯誤 */}
        {apifyError && !apifyLoading && (
          <div style={{
            background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
            borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13,
          }}>
            {apifyError}
          </div>
        )}

        {/* 搜尋結果 */}
        {apifyResults && !apifyLoading && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                「{apifyResults.keyword}」共找到 <strong style={{ color: 'var(--text-primary)' }}>{apifyResults.count}</strong> 筆結果
              </div>
              <button
                className="btn btn-ghost"
                disabled={kwAddLoading || kwList.some(k => k.keyword === apifyResults.keyword)}
                onClick={async () => {
                  setKwAddLoading(true)
                  try {
                    await api.addShopeeKeyword(apifyResults.keyword, apifyMax, apifyResults.items)
                    const updated = await api.getShopeeKeywords()
                    setKwList(updated)
                    toast(`已將「${apifyResults.keyword}」加入追蹤清單`, 'success')
                  } catch (err) {
                    toast(err.message, 'error')
                  } finally {
                    setKwAddLoading(false)
                  }
                }}
                style={{ fontSize: 12, padding: '4px 12px' }}
              >
                {kwList.some(k => k.keyword === apifyResults.keyword) ? '✓ 已追蹤' : kwAddLoading ? '加入中…' : '+ 加入追蹤'}
              </button>
            </div>
            {apifyResults.count === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                沒有找到相關商品
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {apifyResults.items.map((item, i) => (
                  <a
                    key={i}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <div style={{
                      background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border)',
                      borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
                      transition: 'border-color 0.2s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(155,109,202,0.5)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    >
                      {/* 商品圖片 */}
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
                          onError={e => { e.target.style.display = 'none' }}
                        />
                      ) : (
                        <div style={{
                          width: '100%', aspectRatio: '1', background: 'rgba(255,255,255,0.04)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 28, color: 'var(--text-muted)',
                        }}>🛍</div>
                      )}

                      {/* 商品資訊 */}
                      <div style={{ padding: '10px 12px' }}>
                        {/* 名稱 */}
                        <div style={{
                          fontSize: 12, lineHeight: 1.5, marginBottom: 8,
                          overflow: 'hidden', display: '-webkit-box',
                          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                          color: 'var(--text-primary)',
                        }}>
                          {item.name}
                        </div>

                        {/* 價格列 */}
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                          {item.price != null ? (
                            <span style={{ fontSize: 15, fontWeight: 700, color: '#fb923c' }}>
                              NT$ {item.price.toLocaleString()}
                            </span>
                          ) : (
                            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>—</span>
                          )}
                          {item.original_price != null && item.original_price !== item.price && (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                              {item.original_price.toLocaleString()}
                            </span>
                          )}
                        </div>

                        {/* 標籤列 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {item.is_mall && (
                            <span style={{
                              fontSize: 10, background: 'rgba(249,115,22,0.15)', color: '#fb923c',
                              borderRadius: 4, padding: '1px 5px', fontWeight: 500,
                            }}>Mall</span>
                          )}
                          {item.rating != null && (
                            <span style={{ fontSize: 11, color: '#facc15' }}>
                              ★ {Number(item.rating).toFixed(1)}
                            </span>
                          )}
                          {item.sold_count != null && (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              售 {item.sold_count}
                            </span>
                          )}
                        </div>
                        {item.shop_name && (
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                            🏪 {item.shop_name}
                          </div>
                        )}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════
          五、蝦皮追蹤關鍵字清單
      ══════════════════════════════════════════════ */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div className="section-title" style={{ margin: 0 }}>蝦皮追蹤清單</div>

          {/* 排程開關 */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!!kwSchedule.enabled}
              onChange={e => setKwSchedule(prev => ({ ...prev, enabled: e.target.checked }))}
              style={{ accentColor: '#fb923c', width: 14, height: 14 }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>自動排程</span>
          </label>

          {/* 時間輸入 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>每天</span>
            <input
              type="time"
              value={kwSchedule.time}
              onChange={e => setKwSchedule(prev => ({ ...prev, time: e.target.value }))}
              disabled={!kwSchedule.enabled}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 6, padding: '3px 8px', color: 'var(--text-primary)',
                fontSize: 13, fontFamily: 'DM Mono, monospace', outline: 'none',
                opacity: kwSchedule.enabled ? 1 : 0.4,
              }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>執行</span>
          </div>

          {/* 儲存按鈕 */}
          <button
            className="btn btn-ghost"
            style={{ fontSize: 12, padding: '3px 12px' }}
            disabled={kwSchedSaving}
            onClick={async () => {
              setKwSchedSaving(true)
              try {
                await api.setShopeeKeywordSchedule(kwSchedule)
                toast(`排程已更新：${kwSchedule.enabled ? `每天 ${kwSchedule.time}` : '已停用'}`, 'success')
              } catch (err) {
                toast(err.message, 'error')
              } finally {
                setKwSchedSaving(false)
              }
            }}
          >
            {kwSchedSaving ? '儲存中…' : '儲存排程'}
          </button>
        </div>

        {/* 排序 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>排序：</span>
          <select
            value={kwSort}
            onChange={e => setKwSort(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '4px 10px', color: 'var(--text-primary)',
              fontSize: 12, fontFamily: 'Noto Sans TC, sans-serif', outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="created_desc" style={{ background: '#1a1630' }}>建立時間（新→舊）</option>
            <option value="created_asc"  style={{ background: '#1a1630' }}>建立時間（舊→新）</option>
            <option value="name_asc"     style={{ background: '#1a1630' }}>關鍵字（A→Z）</option>
            <option value="last_run"     style={{ background: '#1a1630' }}>上次執行（最近）</option>
            <option value="count_desc"   style={{ background: '#1a1630' }}>商品數量（多→少）</option>
          </select>
        </div>

        {/* 直接新增關鍵字 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            className="input-styled"
            style={{ flex: 1 }}
            placeholder="直接輸入關鍵字加入追蹤，例如：戰鬥陀螺"
            value={kwNewInput ?? ''}
            onChange={e => setKwNewInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !kwAddLoading && kwNewInput?.trim() && handleKwDirectAdd()}
            disabled={kwAddLoading}
          />
          <button
            className="btn btn-primary"
            style={{ fontSize: 13, whiteSpace: 'nowrap' }}
            disabled={kwAddLoading || !kwNewInput?.trim()}
            onClick={handleKwDirectAdd}
          >
            {kwAddLoading ? '新增中…' : '+ 新增'}
          </button>
        </div>

        {kwList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            尚無追蹤關鍵字
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...kwList].sort((a, b) => {
              if (kwSort === 'created_asc')  return new Date(a.created_at) - new Date(b.created_at)
              if (kwSort === 'name_asc')     return a.keyword.localeCompare(b.keyword, 'zh-Hant')
              if (kwSort === 'last_run')     return new Date(b.last_run_at || 0) - new Date(a.last_run_at || 0)
              if (kwSort === 'count_desc')   return (b.item_count || 0) - (a.item_count || 0)
              return new Date(b.created_at) - new Date(a.created_at) // created_desc default
            }).map(kw => (
              <div key={kw.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '10px 14px',
              }}>
                {/* 啟用開關 */}
                <input
                  type="checkbox"
                  checked={!!kw.enabled}
                  onChange={async (e) => {
                    await api.toggleShopeeKeyword(kw.id, e.target.checked)
                    setKwList(prev => prev.map(k => k.id === kw.id ? { ...k, enabled: e.target.checked ? 1 : 0 } : k))
                  }}
                  style={{ accentColor: '#fb923c', width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }}
                />

                {/* 關鍵字名稱 */}
                <span style={{ flex: 1, fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>
                  {kw.keyword}
                </span>

                {/* 上次執行資訊 */}
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', lineHeight: 1.6, flexShrink: 0 }}>
                  {kw.last_run_at ? (
                    <>
                      <div>上次：{kw.last_run_at}</div>
                      <div>{kw.item_count} 筆商品</div>
                    </>
                  ) : (
                    <div>尚未執行</div>
                  )}
                </div>

                {/* 抓取筆數設定 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>筆數</span>
                  <input
                    type="number"
                    min={1} max={100}
                    defaultValue={kw.max_products || 30}
                    onBlur={async e => {
                      const val = Math.max(1, Math.min(100, Number(e.target.value) || 30))
                      e.target.value = val
                      if (val === kw.max_products) return
                      try {
                        await api.updateShopeeKeyword(kw.id, { max_products: val })
                        setKwList(prev => prev.map(k => k.id === kw.id ? { ...k, max_products: val } : k))
                      } catch (err) { toast(err.message, 'error') }
                    }}
                    style={{
                      width: 48, background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 6, padding: '3px 6px', color: 'var(--text-primary)',
                      fontSize: 12, fontFamily: 'DM Mono, monospace', outline: 'none', textAlign: 'center',
                    }}
                  />
                </div>

                {/* 查看結果 */}
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 11, padding: '3px 10px', flexShrink: 0 }}
                  disabled={!kw.last_run_at || (kwResultsId === kw.id && kwResultsLoading)}
                  onClick={async () => {
                    if (kwResultsId === kw.id) { setKwResults(null); setKwResultsId(null); return }
                    setKwResultsId(kw.id)
                    setKwResultsLoading(true)
                    try {
                      const data = await api.getShopeeKeywordResults(kw.id)
                      setKwResults(data)
                    } catch { setKwResults(null) }
                    finally { setKwResultsLoading(false) }
                  }}
                >
                  {kwResultsId === kw.id ? '▲ 收起' : '▼ 看結果'}
                </button>

                {/* 立即執行 */}
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 11, padding: '3px 10px', flexShrink: 0 }}
                  disabled={!!kwRunning[kw.id]}
                  onClick={async () => {
                    setKwRunning(prev => ({ ...prev, [kw.id]: true }))
                    toast(`正在抓取「${kw.keyword}」，請稍候…`, 'success')
                    try {
                      const res = await api.runShopeeKeyword(kw.id)
                      toast(`「${kw.keyword}」完成，共 ${res.count} 筆`, 'success')
                      const updated = await api.getShopeeKeywords()
                      setKwList(updated)
                    } catch (err) {
                      toast(`「${kw.keyword}」執行失敗：${err.message}`, 'error')
                    } finally {
                      setKwRunning(prev => ({ ...prev, [kw.id]: false }))
                    }
                  }}
                >
                  {kwRunning[kw.id] ? '執行中…' : '↻ 執行'}
                </button>

                {/* 刪除 */}
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 11, padding: '3px 8px', color: '#f87171', flexShrink: 0 }}
                  onClick={async () => {
                    if (!window.confirm(`確定移除「${kw.keyword}」的追蹤嗎？`)) return
                    await api.deleteShopeeKeyword(kw.id)
                    setKwList(prev => prev.filter(k => k.id !== kw.id))
                    if (kwResultsId === kw.id) { setKwResults(null); setKwResultsId(null) }
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 展開的結果 */}
        {kwResults && kwResultsId && !kwResultsLoading && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
              抓取時間：{kwResults.run_at}　共 {kwResults.item_count} 筆
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
              {(kwResults.items || []).slice(0, 30).map((item, i) => (
                <a key={i} href={item.url} target="_blank" rel="noopener noreferrer"
                  style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{
                    background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)',
                    borderRadius: 8, overflow: 'hidden',
                    transition: 'border-color 0.2s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(249,115,22,0.5)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name}
                        style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
                        onError={e => { e.target.style.display = 'none' }} />
                    ) : (
                      <div style={{
                        width: '100%', aspectRatio: '1', background: 'rgba(255,255,255,0.04)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: 'var(--text-muted)',
                      }}>🛍</div>
                    )}
                    <div style={{ padding: '8px 10px' }}>
                      <div style={{
                        fontSize: 11, lineHeight: 1.5, marginBottom: 6,
                        overflow: 'hidden', display: '-webkit-box',
                        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        color: 'var(--text-primary)',
                      }}>{item.name}</div>
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
                      {item.rating != null && (
                        <div style={{ fontSize: 10, color: '#facc15', marginTop: 3 }}>
                          ★ {Number(item.rating).toFixed(1)}
                          {item.sold_count != null && <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>售 {item.sold_count}</span>}
                        </div>
                      )}
                      {item.shop_name && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                          🏪 {item.shop_name}
                        </div>
                      )}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════
          六、執行歷史
      ══════════════════════════════════════════════ */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="section-title">執行歷史</div>
          <button
            className="btn btn-ghost"
            onClick={() => { setHistLoading(true); api.getScrapeHistory().then(h => { setHistory(h||[]); setHistLoading(false) }).catch(()=>setHistLoading(false)) }}
            disabled={histLoading}
            style={{ fontSize: 12 }}
          >
            {histLoading ? '載入中…' : '↻ 重新整理'}
          </button>
        </div>

        {history.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
            尚無執行紀錄
          </div>
        ) : (
          <div className="table-wrap">
            <table className="price-table">
              <thead>
                <tr>
                  <th>開始時間</th>
                  <th>平台</th>
                  <th>爬取網址</th>
                  <th>狀態</th>
                  <th style={{ textAlign: 'center' }}>抓取數</th>
                  <th style={{ textAlign: 'center' }}>失敗數</th>
                  <th>完成時間</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => {
                  // 嘗試從 urlList 找到對應標籤
                  const urlEntry = urlList.find(u => u.url === h.target_url)
                  return (
                    <tr key={h.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{h.started_at}</td>
                      <td>
                        <span className={`platform-badge ${PLATFORM_CLASS[h.platform] || 'pb-watsons'}`}>
                          {PLATFORM_LABEL[h.platform] || h.platform}
                        </span>
                      </td>
                      <td style={{ maxWidth: 280 }}>
                        {h.target_url ? (
                          <div>
                            {urlEntry && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
                                {urlEntry.label}
                              </div>
                            )}
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                              {shortUrl(h.target_url, 48)}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>（全平台掃描）</span>
                        )}
                      </td>
                      <td>
                        <span style={{ color: statusColor(h.status), fontSize: 12 }}>
                          ● {statusLabel(h.status)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>{h.products_scraped ?? '—'}</td>
                      <td style={{ textAlign: 'center', color: h.errors_count > 0 ? '#f87171' : 'inherit' }}>
                        {h.errors_count ?? '—'}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>
                        {h.finished_at ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
