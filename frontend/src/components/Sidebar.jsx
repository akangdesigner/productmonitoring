export default function Sidebar({ activeNav, onNav, unreadCount, scraperIdle }) {
  const navItems = [
    { key: 'dashboard', icon: '◈', label: '監控儀表板' },
    { key: 'products',  icon: '◇', label: '商品管理' },
    { key: 'alerts',    icon: '◉', label: '價差警示', badge: unreadCount },
    { key: 'trends',    icon: '◈', label: '趨勢分析' },
  ]
  const settingItems = [
    { key: 'line',    icon: '✦', label: 'LINE 通知' },
    { key: 'scraper', icon: '◌', label: '爬蟲排程' },
  ]

  const now = new Date()
  const nextHour = new Date(now)
  nextHour.setHours(Math.ceil(now.getHours() / 4) * 4, 0, 0, 0)
  const nextRun = nextHour.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-tag">Beauty · Intel</div>
        <div className="logo-name">Competitive<br />Monitor</div>
        <div className="logo-sub">競品監控台 v1.0</div>
      </div>

      <nav className="nav">
        <div className="nav-section-title">主要功能</div>
        {navItems.map(item => (
          <div
            key={item.key}
            className={`nav-item${activeNav === item.key ? ' active' : ''}`}
            onClick={() => onNav(item.key)}
          >
            <span className="icon">{item.icon}</span>
            {item.label}
            {item.badge > 0 && <span className="nav-badge">{item.badge}</span>}
          </div>
        ))}

        <div className="nav-section-title" style={{ marginTop: 16 }}>系統設定</div>
        {settingItems.map(item => (
          <div
            key={item.key}
            className={`nav-item${activeNav === item.key ? ' active' : ''}`}
            onClick={() => onNav(item.key)}
          >
            <span className="icon">{item.icon}</span>
            {item.label}
          </div>
        ))}
      </nav>

      <div className="sidebar-status">
        <div className="status-row">
          <span className={`status-dot${scraperIdle ? ' idle' : ''}`} />
          <span>{scraperIdle ? '閒置中' : '爬蟲運行中'}</span>
        </div>
        <div className="status-next">下次執行：{nextRun}</div>
      </div>
    </aside>
  )
}
