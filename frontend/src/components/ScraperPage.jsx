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
  const [newUrl,     setNewUrl]     = useState('')
  const [newLabel,   setNewLabel]   = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [editId,     setEditId]     = useState(null)     // 目前正在編輯的 URL id
  const [editLabel,  setEditLabel]  = useState('')       // 編輯中的名稱
  const [editUrl,    setEditUrl]    = useState('')       // 編輯中的網址
  const [editSaving, setEditSaving] = useState(false)
  const [runningId,  setRunningId]  = useState(null)   // 正在執行的 URL id
  const [runLogs,    setRunLogs]    = useState({})      // { [id]: [...log] }

  // ── 排程 ──
  const [schedule,    setSchedule]    = useState({ enabled: false, time: '03:00', days: 'daily' })
  const [schedSaving, setSchedSaving] = useState(false)

  // ── 執行歷史 ──
  const [history,     setHistory]     = useState([])
  const [histLoading, setHistLoading] = useState(false)

  const newPlatform = detectPlatform(newUrl)

  const loadAll = useCallback(async () => {
    if (!isOnline) return
    try {
      const [urls, sched, hist] = await Promise.all([
        api.getScraperUrls(),
        api.getSchedule(),
        api.getScrapeHistory(),
      ])
      if (urls)  setUrlList(urls)
      if (sched) setSchedule({ enabled: sched.enabled, time: sched.time, days: sched.days })
      if (hist)  setHistory(hist)
    } catch {}
  }, [isOnline])

  useEffect(() => { loadAll() }, [loadAll])

  // ── 新增網址 ──
  async function handleAdd() {
    if (!newUrl.trim())   { toast('請輸入網址', 'error'); return }
    if (!newPlatform)     { toast('無法辨識平台', 'error'); return }
    if (!isOnline)        { toast('後端離線', 'error'); return }
    setAddLoading(true)
    try {
      const entry = await api.addScraperUrl(newUrl.trim(), newLabel.trim() || undefined)
      setUrlList(prev => [...prev, entry])
      setNewUrl('')
      setNewLabel('')
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
  }

  function cancelEdit() {
    setEditId(null)
    setEditLabel('')
    setEditUrl('')
    setEditSaving(false)
  }

  async function saveEdit(entry) {
    if (!isOnline) { toast('後端離線', 'error'); return }
    const nextLabel = editLabel.trim()
    const nextUrl   = editUrl.trim()
    if (!nextLabel) { toast('自訂名稱不可為空', 'error'); return }
    if (!nextUrl)   { toast('網址不可為空', 'error'); return }
    if (nextLabel === entry.label && nextUrl === entry.url) { cancelEdit(); return }

    setEditSaving(true)
    try {
      const body = { label: nextLabel }
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
      setUrlList(prev => prev.map(u => u.id === entry.id ? { ...u, label: updated.label, url: updated.url, platform: updated.platform } : u))
      toast('已更新', 'success')
      cancelEdit()
    } catch (err) {
      toast(`更新失敗：${err.message}`, 'error')
      setEditSaving(false)
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
                borderRadius: 8, padding: '10px 14px',
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
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, wordBreak: 'break-all' }}>
                        {shortUrl(entry.url)}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
      </div>

      {/* ══════════════════════════════════════════════
          三、執行歷史
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
