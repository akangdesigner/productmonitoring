import { useState, useEffect, useMemo, useCallback } from 'react'
import { Chart, LineElement, LineController, PointElement, LinearScale, CategoryScale, Tooltip, Legend } from 'chart.js'
import { Line } from 'react-chartjs-2'
import { api } from '../api'

Chart.register(LineElement, LineController, PointElement, LinearScale, CategoryScale, Tooltip, Legend)

const UNIT_RE = /[\d.]+\s*(ml|l|g|mg|kg|oz|抽|片|包|入|顆|條)\s*$/i

// 依優先順序比對（長的優先，避免「精華液」被「精華」截斷）
const TYPE_KEYWORDS = [
  '睫毛膏','護唇膏','唇蜜','唇釉','唇彩','唇線筆','唇線','唇膏',
  '粉底液','氣墊粉底','粉底霜','粉底','氣墊',
  '精華液','精華油','精華水','精華',
  '洗面乳','洗顏乳','洗面','洗顏',
  '卸妝油','卸妝乳','卸妝水','卸妝液','卸妝',
  '防曬乳','防曬霜','防曬液','防曬',
  '化妝水','調理水','噴霧水','噴霧',
  '眼線液','眼線筆','眼線',
  '護手霜','眼霜','面霜','乳霜','保濕霜',
  '身體乳','乳液',
  '腮紅','修容','打亮','眼影',
  '面膜','眼膜',
]

const COLORS = [
  '#c084fc','#60a5fa','#f472b6','#34d399','#fbbf24',
  '#f87171','#38bdf8','#4ade80','#fb923c','#a78bfa',
  '#e879f9','#94a3b8','#f9a8d4','#86efac',
]

const DAYS_OPTIONS = [
  { value: 30, label: '30天' },
  { value: 60, label: '60天' },
  { value: 90, label: '90天' },
]

function typeOf(p) {
  const n = (p.base_name || p.name || '').replace(UNIT_RE, '').replace(/粧/g, '妝').trim()
  for (const t of TYPE_KEYWORDS) {
    if (n.includes(t)) return t
  }
  // fallback：去掉品牌後取第一個詞
  let rest = n
  if (p.brand) rest = rest.replace(new RegExp('^' + p.brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*', 'i'), '').trim()
  return rest.split(/[\s　]+/).find(w => w.length >= 2) || n
}

export default function TrendChart({ products }) {
  const [mode,     setMode]     = useState('brand')   // 'brand' | 'type'
  const [selected, setSelected] = useState('')
  const [days,     setDays]     = useState(30)
  const [trends,   setTrends]   = useState({})        // { productId: {watsons:[],cosmed:[],poya:[]} }
  const [loading,  setLoading]  = useState(false)

  // 品牌 / 品項 選項清單
  const options = useMemo(() => {
    if (!products.length) return []
    const set = new Set()
    products.forEach(p => {
      const val = mode === 'brand' ? (p.brand || '') : typeOf(p)
      if (val) set.add(val)
    })
    return [...set].sort((a, b) => a.localeCompare(b, 'zh-TW'))
  }, [products, mode])

  // 切換 mode 時重設選項
  useEffect(() => { setSelected('') }, [mode])
  useEffect(() => { if (options.length && !selected) setSelected(options[0]) }, [options])

  // 依目前選項過濾商品（最多 12 條線）
  const filteredProducts = useMemo(() => {
    if (!selected) return []
    return products
      .filter(p => mode === 'brand' ? (p.brand || '') === selected : typeOf(p) === selected)
      .slice(0, 12)
  }, [products, mode, selected])

  // 商品組改變或天數改變時，批次拉 trend 資料
  useEffect(() => {
    if (!filteredProducts.length) { setTrends({}); return }
    let cancelled = false
    setLoading(true)
    setTrends({})
    Promise.all(
      filteredProducts.map(p =>
        api.getTrend(p.id, days)
          .then(d => ({ id: p.id, data: d }))
          .catch(() => ({ id: p.id, data: {} }))
      )
    ).then(results => {
      if (cancelled) return
      const map = {}
      results.forEach(r => { map[r.id] = r.data })
      setTrends(map)
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [filteredProducts, days])

  // 合併所有商品的日期 union
  const allDates = useMemo(() => {
    const set = new Set()
    Object.values(trends).forEach(d => {
      ['watsons', 'cosmed', 'poya'].forEach(pf =>
        (d[pf] || []).forEach(r => set.add(r.date))
      )
    })
    return [...set].sort()
  }, [trends])

  const hasData = allDates.length > 0

  const chartData = useMemo(() => {
    if (!hasData) return null
    let datasets

    if (mode === 'brand') {
      // 依品牌：依品項類型分組，合併同品項的色號/規格變體
      const typeMap = new Map()
      filteredProducts.forEach(p => {
        const type = typeOf(p)
        if (!typeMap.has(type)) typeMap.set(type, [])
        typeMap.get(type).push(p)
      })
      datasets = [...typeMap.entries()].map(([type, prods], i) => {
        const priceMap = new Map()
        prods.forEach(p => {
          const d = trends[p.id] || {}
          ;['watsons', 'cosmed', 'poya'].forEach(pf => {
            ;(d[pf] || []).forEach(r => {
              const cur = priceMap.get(r.date)
              if (cur === undefined || r.price < cur) priceMap.set(r.date, r.price)
            })
          })
        })
        const color = COLORS[i % COLORS.length]
        return {
          label: type.length > 14 ? type.slice(0, 14) + '…' : type,
          data: allDates.map(d => priceMap.get(d) ?? null),
          borderColor: color, backgroundColor: color + '18', pointBackgroundColor: color,
          pointRadius: allDates.length > 20 ? 2 : 3, pointHoverRadius: 5,
          borderWidth: 1.8, tension: 0.3, spanGaps: false,
        }
      })
    } else {
      // 依品項：每個品牌一條線，合併同品牌所有商品取每日最低價
      const brandMap = new Map()
      filteredProducts.forEach(p => {
        const brand = p.brand || '未知品牌'
        if (!brandMap.has(brand)) brandMap.set(brand, [])
        brandMap.get(brand).push(p)
      })
      datasets = [...brandMap.entries()].map(([brand, prods], i) => {
        const priceMap = new Map()
        prods.forEach(p => {
          const d = trends[p.id] || {}
          ;['watsons', 'cosmed', 'poya'].forEach(pf => {
            ;(d[pf] || []).forEach(r => {
              const cur = priceMap.get(r.date)
              if (cur === undefined || r.price < cur) priceMap.set(r.date, r.price)
            })
          })
        })
        const color = COLORS[i % COLORS.length]
        return {
          label: brand.length > 14 ? brand.slice(0, 14) + '…' : brand,
          data: allDates.map(d => priceMap.get(d) ?? null),
          borderColor: color, backgroundColor: color + '18', pointBackgroundColor: color,
          pointRadius: allDates.length > 20 ? 2 : 3, pointHoverRadius: 5,
          borderWidth: 1.8, tension: 0.3, spanGaps: false,
        }
      })
    }

    return {
      labels: allDates.map(d => d.slice(5).replace('-', '/')),
      datasets,
    }
  }, [filteredProducts, trends, allDates, hasData, mode])

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          color: '#9d8fba',
          font: { family: 'Noto Sans TC, sans-serif', size: 11 },
          boxWidth: 12, padding: 12,
        }
      },
      tooltip: {
        backgroundColor: '#13102299',
        titleColor: '#f0e8ff',
        bodyColor: '#9d8fba',
        borderColor: '#2a2245',
        borderWidth: 1,
        callbacks: {
          label: c => c.raw == null ? null : ` ${c.dataset.label}  NT$${c.raw.toLocaleString()}`
        }
      }
    },
    scales: {
      x: {
        ticks: { color: '#5c5075', font: { family: 'DM Mono', size: 10 }, maxTicksLimit: 10 },
        grid: { color: '#ffffff08' }
      },
      y: {
        ticks: {
          color: '#5c5075',
          font: { family: 'DM Mono', size: 10 },
          callback: v => 'NT$' + v.toLocaleString(),
        },
        grid: { color: '#ffffff08' }
      }
    }
  }), [])

  if (!products || products.length === 0) return null

  return (
    <div className="chart-section">
      {/* ── 標題列 ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <h2 className="section-title" style={{ marginBottom: 0, flex: '0 0 auto' }}>趨勢分析</h2>

        {/* 模式切換 */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 3 }}>
          {[['brand','依品牌'],['type','依品項']].map(([key, label]) => (
            <button key={key} onClick={() => setMode(key)} style={{
              padding: '4px 14px', borderRadius: 7, fontSize: 12, cursor: 'pointer', border: 'none',
              background: mode === key ? 'rgba(155,109,202,0.3)' : 'transparent',
              color: mode === key ? 'var(--amethyst-light)' : 'var(--text-secondary)',
              fontFamily: 'Noto Sans TC, sans-serif', transition: 'all 0.15s',
            }}>{label}</button>
          ))}
        </div>

        {/* 選單 */}
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          style={{
            flex: '1 1 140px', maxWidth: 240,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '5px 10px',
            color: 'var(--text-primary)', fontSize: 13,
            fontFamily: 'Noto Sans TC, sans-serif',
            cursor: 'pointer', outline: 'none',
          }}
        >
          {options.map(o => (
            <option key={o} value={o} style={{ background: '#1a1630' }}>{o}</option>
          ))}
        </select>

        {/* 天數 */}
        <div style={{ display: 'flex', gap: 4 }}>
          {DAYS_OPTIONS.map(o => (
            <button key={o.value} onClick={() => setDays(o.value)} style={{
              padding: '4px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
              border: days === o.value ? '1px solid rgba(155,109,202,0.6)' : '1px solid rgba(255,255,255,0.1)',
              background: days === o.value ? 'rgba(155,109,202,0.15)' : 'rgba(255,255,255,0.03)',
              color: days === o.value ? 'var(--amethyst-light)' : 'var(--text-secondary)',
              fontFamily: 'DM Mono, monospace', transition: 'all 0.15s',
            }}>{o.label}</button>
          ))}
        </div>
      </div>

      {/* 說明文字 */}
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
        {mode === 'brand'
          ? `品牌「${selected}」各品項走勢（不同色號/規格已合併）`
          : `品項「${selected}」各品牌最低價走勢比較`}
        {filteredProducts.length > 0 && (() => {
          if (mode === 'brand') {
            const typeCount = new Set(filteredProducts.map(p => typeOf(p))).size
            return `，共 ${typeCount} 個品項`
          }
          const brandCount = new Set(filteredProducts.map(p => p.brand || '未知品牌')).size
          return `，共 ${brandCount} 個品牌`
        })()}
      </div>

      {/* 圖表 */}
      <div style={{ height: 320, position: 'relative' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
            載入中…
          </div>
        )}
        {!loading && !hasData && selected && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 13, textAlign: 'center' }}>
            <div style={{ fontSize: 28, opacity: 0.3 }}>📈</div>
            <div>「{selected}」在 {days} 天內尚無價格記錄</div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>請先執行爬蟲以收集歷史資料</div>
          </div>
        )}
        {!loading && hasData && chartData && (
          <Line data={chartData} options={chartOptions} />
        )}
      </div>
    </div>
  )
}
