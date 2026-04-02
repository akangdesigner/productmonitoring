import { useState } from 'react'

const PF_LABEL = { watsons: '屈臣氏', cosmed: '康是美', poya: '寶雅' }
const PF_CLASS = { watsons: 'pb-watsons', cosmed: 'pb-cosmed', poya: 'pb-poya' }

function PriceCell({ pl, isMin, isMax }) {
  if (!pl?.price) return <td className="price-cell"><div className="price-num" style={{ color: 'var(--text-muted)' }}>—</div></td>
  const pct = pl.prevPrice && pl.price !== pl.prevPrice
    ? ((pl.price - pl.prevPrice) / pl.prevPrice * 100).toFixed(1)
    : null
  const hasOrig = pl.originalPrice && pl.originalPrice > pl.price
  return (
    <td className="price-cell">
      <div className={`price-num${isMin ? ' lowest' : isMax ? ' highest' : ''}`}>
        NT${pl.price.toLocaleString()}{hasOrig ? `（原${pl.originalPrice.toLocaleString()}）` : ''}
      </div>
      {pct && (
        <div className={`price-change ${pl.price < pl.prevPrice ? 'down' : 'up'}`}>
          {pl.price < pl.prevPrice ? '▼' : '▲'} {Math.abs(pct)}%
        </div>
      )}
    </td>
  )
}

// 把同 base_name 的商品合併成一列（取各平台最低價）
function groupProducts(products) {
  const map = new Map()
  for (const p of products) {
    const key = p.base_name || p.name
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(p)
  }

  return [...map.entries()].map(([key, items]) => {
    if (items.length === 1) return { key, rep: items[0], merged: null }

    // 多個色號 → 取代表商品欄位 + 各平台最低價
    const rep = items[0]
    const merged = {}
    for (const pf of ['watsons', 'cosmed', 'poya']) {
      const candidates = items.map(p => p[pf]).filter(pl => pl?.price > 0)
      if (candidates.length === 0) { merged[pf] = null; continue }
      const best = candidates.reduce((a, b) => a.price <= b.price ? a : b)
      merged[pf] = best
    }
    merged.variantCount = items.length

    return { key, rep, merged }
  })
}

export default function PriceTable({ products }) {
  const [filter, setFilter] = useState('all')
  const [category, setCategory] = useState('all')

  const filtered = products
    .filter(p => category === 'all' || p.category === category)
    .filter(p => {
      if (filter === 'drops') {
        return ['watsons', 'cosmed', 'poya'].some(k =>
          p[k]?.price && p[k]?.prevPrice && p[k].price < p[k].prevPrice
        )
      }
      return true
    })

  const groups = groupProducts(filtered)

  return (
    <div>
      <div className="section-header">
        <div className="section-title">即時比價總覽</div>
        <div className="section-actions">
          <select className="select-styled" onChange={e => setCategory(e.target.value)}>
            <option value="all">全部品類</option>
            <option value="skincare">保養</option>
            <option value="makeup">彩妝</option>
            <option value="唇膏">唇膏</option>
            <option value="haircare">洗護</option>
          </select>
          <div className="tab-bar">
            {[['all','全部'],['drops','降價中']].map(([k,l]) => (
              <button key={k} className={`tab${filter===k?' active':''}`} onClick={() => setFilter(k)}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <table className="price-table">
          <thead>
            <tr>
              <th style={{ width: 260 }}>商品</th>
              {Object.entries(PF_LABEL).map(([k, l]) => (
                <th key={k} className="platform-col">
                  <span className={`platform-badge ${PF_CLASS[k]}`}>{l}</span>
                </th>
              ))}
              <th className="platform-col" style={{ color: 'var(--text-primary)' }}>最低價</th>
              <th style={{ minWidth: 160 }}>備註</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(({ key, rep, merged }) => {
              const pData = merged ?? {
                watsons: rep.watsons,
                cosmed:  rep.cosmed,
                poya:    rep.poya,
              }
              const prices = ['watsons', 'cosmed', 'poya'].map(k => pData[k]?.price).filter(v => v > 0)
              const minP = prices.length ? Math.min(...prices) : 0
              const maxP = prices.length ? Math.max(...prices) : 0
              const lowestPf = ['watsons', 'cosmed', 'poya'].find(k => pData[k]?.price === minP)

              return (
                <tr key={key}>
                  <td>
                    <div className="product-cell">
                      <div className="product-img">{rep.emoji || '✨'}</div>
                      <div>
                        <div className="product-name">{key}</div>
                        <div className="product-brand">{rep.brand}</div>
                      </div>
                    </div>
                  </td>
                  <PriceCell pl={pData.watsons} isMin={pData.watsons?.price === minP && minP > 0} isMax={pData.watsons?.price === maxP && maxP > minP} />
                  <PriceCell pl={pData.cosmed}  isMin={pData.cosmed?.price  === minP && minP > 0} isMax={pData.cosmed?.price  === maxP && maxP > minP} />
                  <PriceCell pl={pData.poya}    isMin={pData.poya?.price    === minP && minP > 0} isMax={pData.poya?.price    === maxP && maxP > minP} />
                  <td className="price-cell">
                    {minP > 0 ? <>
                      <div className="price-num lowest">NT${minP.toLocaleString()}</div>
                      <div style={{ marginTop: 3 }}>
                        <span className={`platform-badge ${PF_CLASS[lowestPf]}`}>{PF_LABEL[lowestPf]}</span>
                      </div>
                    </> : '—'}
                  </td>
                  <td>
                    {merged?.variantCount > 1 && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                        共 {merged.variantCount} 種色號
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
