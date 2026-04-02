const TYPE_MAP = {
  price_drop:    { icon:'↓', cls:'ai-red',    diffCls:'neg' },
  price_surge:   { icon:'↑', cls:'ai-yellow', diffCls:'pos' },
  gift_added:    { icon:'🎁', cls:'ai-violet', diffCls:'pos' },
  gift_removed:  { icon:'⚠', cls:'ai-yellow', diffCls:'pos' },
  back_in_stock: { icon:'✓', cls:'ai-green',  diffCls:'neg' },
}
const PF_LABEL = { watsons:'屈臣氏', cosmed:'康是美', poya:'寶雅', pchome:'PChome' }
const PF_CLASS = { watsons:'pb-watsons', cosmed:'pb-cosmed', poya:'pb-poya', pchome:'pb-watsons' }

export default function AlertFeed({ alerts, onMarkAllRead }) {
  return (
    <div className="alert-card">
      <div className="section-header" style={{ marginBottom: 12 }}>
        <div className="section-title">警示動態</div>
        <button className="btn btn-ghost" style={{ fontSize: 11, padding: '5px 10px' }} onClick={onMarkAllRead}>
          全部已讀
        </button>
      </div>
      <div className="alert-list">
        {alerts.map(a => {
          const t = TYPE_MAP[a.type] ?? { icon:'●', cls:'ai-violet', diffCls:'neg' }
          const isCritical = a.type === 'price_drop' && !a.is_read
          const timeFmt = a.created_at
            ? new Date(a.created_at).toLocaleString('zh-TW', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })
            : ''

          let diffText = ''
          if (['price_drop','price_surge'].includes(a.type) && a.old_value && a.new_value) {
            const diff = parseInt(a.new_value) - parseInt(a.old_value)
            diffText = `${diff > 0 ? '+' : '-'}NT$${Math.abs(diff).toLocaleString()}`
          } else if (a.type === 'gift_added')   diffText = '+贈品'
          else if (a.type === 'gift_removed') diffText = '-贈品'

          return (
            <div key={a.id} className={`alert-item${!a.is_read ? ' unread' : ''}${isCritical ? ' critical' : ''}`}>
              <div className={`alert-icon ${t.cls}`}>{t.icon}</div>
              <div className="alert-body">
                <div className="alert-title">{a.title || a.message}</div>
                <div className="alert-meta">
                  <span className={`platform-badge ${PF_CLASS[a.platform] ?? 'pb-watsons'}`}>
                    {PF_LABEL[a.platform] ?? a.platform}
                  </span>
                  {diffText && <span className={`alert-diff ${t.diffCls}`}>{diffText}</span>}
                  <span className="alert-time">{timeFmt}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
