import { useState, useEffect } from 'react'
import { api } from '../api'

export default function LineSettings({ isOnline, toast }) {
  const [threshold,   setThreshold]   = useState(5)
  const [priceDrop,   setPriceDrop]   = useState(true)
  const [dailyReport, setDailyReport] = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [reporting,   setReporting]   = useState(false)

  useEffect(() => { if (isOnline) loadSettings() }, [isOnline])

  async function loadSettings() {
    try {
      const s = await api.getLineSettings()
      setThreshold(s.price_drop_threshold ?? 5)
      setPriceDrop(!!s.notify_price_drop)
      setDailyReport(!!s.daily_report_enabled)
    } catch {}
  }

  async function handleSave() {
    setSaving(true)
    try {
      await api.saveLineSettings({
        price_drop_threshold: parseFloat(threshold),
        notify_price_drop:    priceDrop   ? 1 : 0,
        daily_report_enabled: dailyReport ? 1 : 0,
      })
      toast('✅ LINE 通知設定已儲存', 'success')
    } catch (err) {
      toast(`儲存失敗：${err.message}`, 'error')
    }
    setSaving(false)
  }

  async function handleGapReport() {
    setReporting(true)
    try {
      const res = await api.sendGapReport()
      toast(`✅ 價差報告已發送（共 ${res.count} 筆）`, 'success', 6000)
    } catch (err) {
      toast(`發送失敗：${err.message}`, 'error')
    }
    setReporting(false)
  }

  return (
    <div className="settings-card">
      <div className="section-header" style={{ marginBottom: 0 }}>
        <div className="section-title">LINE 通知設定</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`btn btn-ghost${reporting ? ' loading' : ''}`} style={{ fontSize: 11, padding: '5px 10px' }} onClick={handleGapReport} disabled={reporting}>
            📊 發送價差報告
          </button>
        </div>
      </div>

      <div className="settings-grid">
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
          {[
            ['降價通知',          priceDrop,   setPriceDrop],
            ['每日早報（09:00）', dailyReport, setDailyReport],
          ].map(([label, val, set]) => (
            <div key={label} className="toggle-row">
              <span className="toggle-label">{label}</span>
              <button className={`toggle${val ? ' on' : ''}`} onClick={() => set(v => !v)} />
            </div>
          ))}
        </div>

        <div className="form-group">
          <label className="form-label">降價觸發門檻（%）</label>
          <input type="number" className="form-input" min="1" max="50" value={threshold}
            onChange={e => setThreshold(e.target.value)} />
          <span className="form-hint">對手降價超過此比例才發出 LINE 警報</span>
        </div>

        <div className="form-group">
          <label className="form-label">LINE Flex Message 預覽（降價警報）</label>
          <div style={{ background:'#0d0b1a', border:'1px solid #2a2245', borderRadius:8, overflow:'hidden', maxWidth:260 }}>
            {/* header */}
            <div style={{ background:'#ff4d6d', padding:'10px 14px' }}>
              <span style={{ fontSize:13, fontWeight:700, color:'#fff' }}>🚨  降價警報</span>
            </div>
            {/* body */}
            <div style={{ padding:'12px 14px', lineHeight:1.7 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#f0e8ff' }}>SK-II 神仙水 230ml</div>
              <div style={{ fontSize:11, color:'#9d8fba', marginTop:2 }}>SK-II</div>
              <div style={{ fontSize:11, color:'#00a0e3', fontWeight:700, marginTop:2 }}>屈臣氏</div>
              <hr style={{ borderColor:'#2a2245', margin:'8px 0' }} />
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#5c5075' }}>
                <span>原價</span>
                <span style={{ textDecoration:'line-through' }}>NT$3,960</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:4 }}>
                <span style={{ fontSize:13, fontWeight:700, color:'#f0e8ff' }}>現價</span>
                <span style={{ fontSize:15, fontWeight:700, color:'#ff4d6d' }}>NT$3,480</span>
              </div>
              <div style={{ background:'#ff4d6d20', borderRadius:6, padding:'6px 8px', marginTop:10, textAlign:'center' }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#ff4d6d' }}>↓ 降價 12.1%</div>
                <div style={{ fontSize:10, color:'#ff4d6d' }}>省 NT$480</div>
              </div>
            </div>
            {/* footer */}
            <div style={{ padding:'6px 14px 10px', fontSize:10, color:'#5c5075', textAlign:'center', borderTop:'1px solid #2a2245' }}>
              建議跟進調整定價策略
            </div>
          </div>
        </div>
      </div>

      <div className="settings-actions">
        <button className="btn btn-ghost" onClick={loadSettings}>重置</button>
        <button className={`btn btn-primary${saving ? ' loading' : ''}`} onClick={handleSave} disabled={saving}>
          儲存設定
        </button>
      </div>
    </div>
  )
}
