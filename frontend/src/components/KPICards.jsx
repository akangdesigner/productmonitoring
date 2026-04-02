export default function KPICards({ kpi }) {
  return (
    <div className="kpi-grid">
      <div className="kpi-card" style={{ '--accent': '#9b6dca18' }}>
        <div className="kpi-label">監控商品</div>
        <div className="kpi-value violet">{kpi.productCount ?? 0}</div>
        <div className="kpi-sub">跨 3 大平台・持續監控中</div>
      </div>

      <div className="kpi-card" style={{ '--accent': '#ff4d6d18' }}>
        <div className="kpi-label">今日警示</div>
        <div className="kpi-value red">{kpi.todayAlerts ?? 0}</div>
        <div className="kpi-sub">
          <span className="badge badge-red">↓ 降價</span>&nbsp;
          <span className="badge badge-green">+ 贈品</span>
        </div>
      </div>

      <div className="kpi-card" style={{ '--accent': '#4ade8018' }}>
        <div className="kpi-label">最低價平台</div>
        <div className="kpi-value green" style={{ fontSize: 22, paddingTop: 6 }}>
          {kpi.lowestPlatform ?? '寶雅'}
        </div>
        <div className="kpi-sub">本週最多商品最低價</div>
      </div>

      <div className="kpi-card" style={{ '--accent': '#d4956a18' }}>
        <div className="kpi-label">未讀警示</div>
        <div className="kpi-value rose">{kpi.unreadAlerts ?? 0}</div>
        <div className="kpi-sub">
          {kpi.unreadAlerts > 0
            ? <span className="badge badge-red">待處理</span>
            : <span className="badge badge-green">全部已讀</span>
          }
        </div>
      </div>
    </div>
  )
}
