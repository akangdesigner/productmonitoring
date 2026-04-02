import { useEffect, useState } from 'react'
import { api } from '../api'

function fmtPrice(v) {
  return typeof v === 'number' && v > 0 ? `NT$${v.toLocaleString()}` : '—'
}

export default function AlertRecordsPage({ isOnline, toast }) {
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState({ items: [], page: 1, totalPages: 1, total: 0 })

  useEffect(() => {
    async function load() {
      if (!isOnline) return
      setLoading(true)
      try {
        const res = await api.getAlertGaps(page, limit)
        setData(res || { items: [], page, totalPages: 1, total: 0 })
      } catch (err) {
        toast?.(`載入警示紀錄失敗：${err.message}`, 'error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isOnline, page, limit, toast])

  return (
    <div className="card" style={{ padding: '20px 24px' }}>
      <div className="section-header" style={{ marginBottom: 12 }}>
        <div className="section-title">警示紀錄（跨平台價差）</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {loading ? '載入中…' : `共 ${data.total || 0} 筆`}
        </div>
      </div>

      {data.items?.length ? (
        <>
          <div className="table-wrap">
            <table className="price-table">
              <thead>
                <tr>
                  <th>商品</th>
                  <th>屈臣氏</th>
                  <th>康是美</th>
                  <th>寶雅</th>
                  <th>最低價</th>
                  <th>最高價</th>
                  <th>價差</th>
                  <th>更新時間</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map(row => (
                  <tr key={row.product_id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{row.product_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.brand || '—'}</div>
                    </td>
                    <td>{fmtPrice(row.watsons_price)}</td>
                    <td>{fmtPrice(row.cosmed_price)}</td>
                    <td>{fmtPrice(row.poya_price)}</td>
                    <td style={{ color: 'var(--green)' }}>{fmtPrice(row.min_price)}</td>
                    <td style={{ color: 'var(--red)' }}>{fmtPrice(row.max_price)}</td>
                    <td style={{ fontWeight: 600 }}>NT${(row.gap || 0).toLocaleString()}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>
                      {row.latest_at || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              className="btn btn-ghost"
              disabled={page <= 1 || loading}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              ← 上一頁
            </button>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              第 {data.page || page} / {data.totalPages || 1} 頁
            </div>
            <button
              className="btn btn-ghost"
              disabled={page >= (data.totalPages || 1) || loading}
              onClick={() => setPage(p => p + 1)}
            >
              下一頁 →
            </button>
          </div>
        </>
      ) : (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
          {loading ? '載入中…' : '目前沒有跨平台價差警示'}
        </div>
      )}
    </div>
  )
}

