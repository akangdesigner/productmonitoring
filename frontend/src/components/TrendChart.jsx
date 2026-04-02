import { useEffect, useRef, useState } from 'react'
import { Line } from 'react-chartjs-2'
import { Chart, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip } from 'chart.js'
import { MOCK_TREND } from '../mockData'
import { api } from '../api'

Chart.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip)

const LABELS = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() - (29 - i))
  return `${d.getMonth()+1}/${d.getDate()}`
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#13102299',
      titleColor: '#f0e8ff',
      bodyColor: '#9d8fba',
      borderColor: '#2a2245',
      borderWidth: 1,
      callbacks: { label: c => ` NT$${c.raw?.toLocaleString() ?? '—'}` }
    }
  },
  scales: {
    x: { ticks: { color: '#5c5075', font: { family: 'DM Mono', size: 10 }, maxTicksLimit: 8 }, grid: { color: '#ffffff08' } },
    y: { ticks: { color: '#5c5075', font: { family: 'DM Mono', size: 10 }, callback: v => 'NT$'+v.toLocaleString() }, grid: { color: '#ffffff08' } }
  }
}

export default function TrendChart({ products, isOnline }) {
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [chartData, setChartData] = useState(null)

  useEffect(() => {
    async function load() {
      const p = products[selectedIdx]
      if (isOnline && p?.id && typeof p.id === 'string') {
        try {
          const trend = await api.getTrend(p.id)
          const toArr = pf => {
            if (!trend[pf]?.length) return MOCK_TREND[selectedIdx]?.[pf] ?? []
            const map = Object.fromEntries(trend[pf].map(r => [r.date, r.price]))
            return LABELS.map((_, i) => {
              const d = new Date(); d.setDate(d.getDate() - (29-i))
              return map[d.toISOString().slice(0,10)] ?? null
            })
          }
          setChartData({ watsons: toArr('watsons'), cosmed: toArr('cosmed'), poya: toArr('poya') })
          return
        } catch {}
      }
      setChartData(MOCK_TREND[selectedIdx] ?? MOCK_TREND[0])
    }
    load()
  }, [selectedIdx, products, isOnline])

  const data = {
    labels: LABELS,
    datasets: [
      { label:'屈臣氏', data: chartData?.watsons ?? [], borderColor:'#00a0e3', backgroundColor:'#00a0e310', tension:0.4, pointRadius:0, borderWidth:2, fill:false },
      { label:'康是美', data: chartData?.cosmed  ?? [], borderColor:'#f47920', backgroundColor:'#f4792010', tension:0.4, pointRadius:0, borderWidth:2, fill:false },
      { label:'寶雅',   data: chartData?.poya    ?? [], borderColor:'#16a34a', backgroundColor:'#16a34a10', tension:0.4, pointRadius:0, borderWidth:2, fill:true },
    ]
  }

  return (
    <div className="chart-card">
      <div className="section-header" style={{ marginBottom: 0 }}>
        <div className="section-title">30 日價格走勢</div>
        <select className="select-styled" value={selectedIdx} onChange={e => setSelectedIdx(Number(e.target.value))}>
          {products.map((p, i) => <option key={p.id} value={i}>{p.name}</option>)}
        </select>
      </div>
      <div className="chart-legend" style={{ marginTop: 14 }}>
        {[['#00a0e3','屈臣氏'],['#f47920','康是美'],['#16a34a','寶雅']].map(([color,label]) => (
          <div key={label} className="legend-item">
            <div className="legend-dot" style={{ background: color }} />
            {label}
          </div>
        ))}
      </div>
      <div className="chart-container">
        {chartData && <Line data={data} options={chartOptions} />}
      </div>
    </div>
  )
}
