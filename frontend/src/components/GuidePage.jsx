import { useState } from 'react'

/* ── 注入 keyframes ── */
const INJECT_CSS = `
@keyframes gp-fadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes gp-gradFlow {
  0%,100% { background-position: 0% 50%; }
  50%      { background-position: 100% 50%; }
}
@keyframes gp-shimmer {
  0%   { transform: translateX(-120%) skewX(-18deg); }
  100% { transform: translateX(220%)  skewX(-18deg); }
}
.gp-toc-pill {
  display: flex; align-items: center; gap: 7px;
  padding: 7px 14px; border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.04);
  color: var(--text-secondary); font-size: 13px;
  text-decoration: none; white-space: nowrap;
  transition: all 0.2s ease; cursor: pointer;
  font-family: 'Noto Sans TC', sans-serif;
}
.gp-toc-pill:hover {
  background: rgba(155,109,202,0.14);
  border-color: rgba(155,109,202,0.35);
  color: var(--amethyst-light);
}
.gp-feature-card {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 16px;
  padding: 22px 18px 20px;
  transition: all 0.25s ease;
  animation: gp-fadeUp 0.5s ease both;
}
.gp-feature-card:hover {
  transform: translateY(-4px);
  background: rgba(155,109,202,0.07);
  border-color: rgba(155,109,202,0.2);
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
}
.gp-section {
  margin-bottom: 48px;
  scroll-margin-top: 24px;
  animation: gp-fadeUp 0.5s ease both;
}
.gp-faq-item {
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 14px;
  overflow: hidden;
  transition: border-color 0.2s;
}
.gp-faq-item:hover {
  border-color: rgba(155,109,202,0.25);
}
.gp-faq-q {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; cursor: pointer;
  user-select: none; gap: 12px;
  transition: background 0.2s;
}
.gp-faq-q:hover {
  background: rgba(155,109,202,0.06);
}
.gp-tip-row {
  display: flex; gap: 12px; font-size: 14px;
  color: var(--text-secondary); line-height: 1.65;
  padding: 11px 14px; border-radius: 10px;
  transition: background 0.2s;
}
.gp-tip-row:hover {
  background: rgba(155,109,202,0.06);
}
`

/* ── Feature card icons (SVG) ── */
function IconRadar() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="2.5" fill="url(#ri-g)"/>
      <path d="M12 2a10 10 0 1 1 0 20A10 10 0 0 1 12 2z" stroke="url(#ri-g)" strokeWidth="1.5" fill="none" opacity="0.3"/>
      <path d="M12 7a5 5 0 1 1 0 10A5 5 0 0 1 12 7z" stroke="url(#ri-g)" strokeWidth="1.5" fill="none" opacity="0.5"/>
      <path d="M12 12l-5-3" stroke="url(#ri-g)" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
      <defs><linearGradient id="ri-g" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse"><stop stopColor="#c084fc"/><stop offset="1" stopColor="#9b6dca"/></linearGradient></defs>
    </svg>
  )
}
function IconChart() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 20h18M8 20V12m5 8V8m5 12V4" stroke="url(#ci-g)" strokeWidth="2" strokeLinecap="round"/>
      <defs><linearGradient id="ci-g" x1="3" y1="4" x2="21" y2="20" gradientUnits="userSpaceOnUse"><stop stopColor="#d4956a"/><stop offset="1" stopColor="#c084fc"/></linearGradient></defs>
    </svg>
  )
}
function IconBell() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="url(#bi-g)" strokeWidth="2" strokeLinecap="round"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="url(#bi-g)" strokeWidth="2" strokeLinecap="round"/>
      <defs><linearGradient id="bi-g" x1="3" y1="8" x2="21" y2="21" gradientUnits="userSpaceOnUse"><stop stopColor="#38bdf8"/><stop offset="1" stopColor="#c084fc"/></linearGradient></defs>
    </svg>
  )
}
function IconList() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="3" rx="1.5" fill="url(#li-g)" opacity="0.4"/>
      <rect x="3" y="10.5" width="18" height="3" rx="1.5" fill="url(#li-g)" opacity="0.7"/>
      <rect x="3" y="16" width="12" height="3" rx="1.5" fill="url(#li-g)"/>
      <defs><linearGradient id="li-g" x1="3" y1="5" x2="21" y2="19" gradientUnits="userSpaceOnUse"><stop stopColor="#4ade80"/><stop offset="1" stopColor="#38bdf8"/></linearGradient></defs>
    </svg>
  )
}
function IconClock() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="url(#tk-g)" strokeWidth="1.8"/>
      <path d="M12 7v5l3 3" stroke="url(#tk-g)" strokeWidth="2" strokeLinecap="round"/>
      <defs><linearGradient id="tk-g" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse"><stop stopColor="#fbbf24"/><stop offset="1" stopColor="#f97316"/></linearGradient></defs>
    </svg>
  )
}
function IconLine() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="13" rx="3" stroke="url(#ln-g)" strokeWidth="1.8" fill="none"/>
      <path d="M3 15l4-4 3 3 4-5 4 4" stroke="url(#ln-g)" strokeWidth="1.6" strokeLinejoin="round" fill="none"/>
      <defs><linearGradient id="ln-g" x1="3" y1="4" x2="21" y2="17" gradientUnits="userSpaceOnUse"><stop stopColor="#4ade80"/><stop offset="1" stopColor="#38bdf8"/></linearGradient></defs>
    </svg>
  )
}
function IconHelp() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="url(#hg)" strokeWidth="1.8"/>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" stroke="url(#hg)" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="12" cy="17" r="1" fill="url(#hg)"/>
      <defs><linearGradient id="hg" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse"><stop stopColor="#c084fc"/><stop offset="1" stopColor="#d4956a"/></linearGradient></defs>
    </svg>
  )
}
function IconCheck() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="url(#ck-g)" strokeWidth="1.8"/>
      <path d="M8 12l3 3 5-5" stroke="url(#ck-g)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <defs><linearGradient id="ck-g" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse"><stop stopColor="#4ade80"/><stop offset="1" stopColor="#38bdf8"/></linearGradient></defs>
    </svg>
  )
}

/* ── Section heading ── */
function SectionHeading({ icon, title, id }) {
  return (
    <div id={id} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      marginBottom: 22, paddingBottom: 16,
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      scrollMarginTop: 24,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: 'linear-gradient(135deg, rgba(155,109,202,0.18), rgba(212,149,106,0.12))',
        border: '1px solid rgba(155,109,202,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <h2 style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: 26, fontWeight: 400, letterSpacing: '-0.01em',
        color: 'var(--text-primary)', margin: 0, lineHeight: 1.1,
      }}>{title}</h2>
    </div>
  )
}

/* ── Step bubble ── */
function StepBubble({ n }) {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, #9b6dca, #d4956a)',
      color: '#fff', fontSize: 14, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 2px 12px rgba(155,109,202,0.4), 0 0 0 4px rgba(155,109,202,0.1)',
      zIndex: 1, position: 'relative',
    }}>{n}</div>
  )
}

/* ── FAQ accordion item ── */
function FaqItem({ q, a, delay = 0 }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="gp-faq-item" style={{ animationDelay: `${delay}ms` }}>
      <div className="gp-faq-q" onClick={() => setOpen(v => !v)}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{
            width: 22, height: 22, borderRadius: '50%', flexShrink: 0, marginTop: 1,
            background: 'linear-gradient(135deg, rgba(155,109,202,0.3), rgba(212,149,106,0.2))',
            border: '1px solid rgba(155,109,202,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: 'var(--amethyst-light)',
            fontFamily: "'DM Mono', monospace",
          }}>Q</div>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.5 }}>{q}</span>
        </div>
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none"
          style={{ flexShrink: 0, transition: 'transform 0.3s', transform: open ? 'rotate(180deg)' : 'none' }}
        >
          <path d="M6 9l6 6 6-6" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>
      {open && (
        <div style={{
          padding: '0 20px 18px 52px',
          fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75,
          animation: 'gp-fadeUp 0.2s ease both',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingTop: 14,
        }}>{a}</div>
      )}
    </div>
  )
}

/* ── Data ── */
const SECTIONS = [
  {
    id: 'intro', icon: <IconRadar />, title: '這是什麼系統？',
    content: [
      { type: 'text', value: '競品監控台是一套自動追蹤美妝電商價格的工具。它會定期自動爬取屈臣氏、康是美、寶雅等平台的商品售價，並在競品降價時即時通知你。' },
      {
        type: 'cards',
        items: [
          { icon: <IconRadar />,  title: '自動爬蟲',     desc: '定時抓取各平台商品價格，不需手動查詢', grad: 'linear-gradient(135deg,rgba(192,132,252,0.2),rgba(155,109,202,0.1))' },
          { icon: <IconChart />,  title: '比價儀表板',   desc: '一眼看出各平台售價高低，找出差異',     grad: 'linear-gradient(135deg,rgba(212,149,106,0.2),rgba(249,115,22,0.1))' },
          { icon: <IconBell />,   title: 'LINE 即時推播', desc: '競品降價超過設定門檻時，自動傳訊給你', grad: 'linear-gradient(135deg,rgba(56,189,248,0.2),rgba(192,132,252,0.1))' },
          { icon: <IconList />,   title: '商品管理',     desc: '建立自家商品目錄，作為比價基準',       grad: 'linear-gradient(135deg,rgba(74,222,128,0.2),rgba(56,189,248,0.1))' },
        ],
      },
    ],
  },
  {
    id: 'start', icon: <IconCheck />, title: '快速開始',
    content: [
      {
        type: 'steps',
        items: [
          { title: '完成初始設定',  desc: '前往「初始設定」頁，選擇 1～3 個要追蹤的平台，貼上分類頁網址，並選填 LINE User ID。' },
          { title: '執行第一次爬蟲', desc: '前往「爬蟲排程」頁，點「立即執行」，系統會馬上抓取各平台商品資料（約需 1～3 分鐘）。' },
          { title: '查看儀表板',    desc: '回到「監控儀表板」，就能看到各平台商品的最新售價與漲跌狀況。' },
          { title: '設定 LINE 通知', desc: '前往「LINE 通知」頁，填入 Channel Access Token 與 User ID，開啟降價警示開關。' },
        ],
      },
    ],
  },
  {
    id: 'dashboard', icon: <IconChart />, title: '看懂儀表板',
    content: [
      { type: 'text', value: '儀表板上方有 4 個數字卡片，下方是各商品的跨平台比價表格。' },
      {
        type: 'table',
        rows: [
          { label: '監控商品數',   desc: '目前系統追蹤中的商品總數' },
          { label: '今日比較筆數', desc: '今天爬蟲抓到的價格記錄數量' },
          { label: '今日降價數',   desc: '與上次爬蟲相比，今日降價的商品數' },
          { label: '未讀警示',     desc: '尚未查看的價差警示數量' },
        ],
      },
      { type: 'text', value: '比價表格中，綠色 ▼ 代表降價，紅色 ▲ 代表漲價。點擊商品可查看歷史趨勢圖。' },
    ],
  },
  {
    id: 'scraper', icon: <IconClock />, title: '爬蟲排程設定',
    content: [
      { type: 'text', value: '系統支援自動排程，可以設定每隔幾小時自動爬取一次。也可以隨時手動觸發。' },
      {
        type: 'tips',
        items: [
          '建議頻率：每 4～8 小時執行一次，避免對目標網站造成過大負荷',
          '每次執行大約需要 1～5 分鐘（視商品數量與網路狀況而定）',
          '執行記錄會顯示在排程頁下方，可確認是否成功',
          '若某次爬蟲失敗，系統會自動記錄錯誤，不影響下次排程',
        ],
      },
    ],
  },
  {
    id: 'line', icon: <IconLine />, title: 'LINE 通知設定',
    content: [
      { type: 'text', value: '系統使用 LINE Messaging API 發送通知，需要準備以下資訊：' },
      {
        type: 'table',
        rows: [
          { label: 'Channel Access Token', desc: '在 LINE Developers 後台建立 Messaging API Channel 後取得' },
          { label: 'Channel Secret',       desc: '同上，位於 Channel 設定頁的 Basic Settings' },
          { label: 'User ID（UID）',        desc: '以 LINE 帳號傳訊給 Bot 後，可在 Webhook 收到的事件中取得' },
        ],
      },
      {
        type: 'tips',
        items: [
          '降價通知：競品售價下降超過設定門檻（預設 5%）時發送',
          '每日早報：每天早上 8:00 自動彙整前一日所有降價商品',
          '價差報告：可手動從儀表板觸發，一次傳送所有跨平台價差摘要',
        ],
      },
    ],
  },
  {
    id: 'faq', icon: <IconHelp />, title: '常見問題',
    content: [
      {
        type: 'faq',
        items: [
          { q: '爬蟲執行後儀表板沒有資料？',  a: '請確認填入的網址是分類頁（如「唇膏」類別頁），而非單一商品頁。執行後等待約 1～2 分鐘，再重新整理頁面。' },
          { q: 'LINE 通知沒有收到？',         a: '請確認 Channel Access Token 與 User ID 都正確填寫，並已開啟降價通知開關。可在「LINE 通知」頁使用「傳送測試訊息」功能驗證。' },
          { q: '系統重新部署後資料消失？',     a: '若部署在 Zeabur 或類似雲端服務，需掛載 Persistent Volume 到 /data 路徑，並設定環境變數 DB_PATH=/data/beauty_monitor.sqlite，才能讓資料庫持久保存。' },
          { q: '可以同時追蹤多少商品？',       a: '系統沒有硬性限制，但建議每個平台不超過 200 個商品，以確保爬蟲速度與穩定性。' },
          { q: '網址填錯了怎麼辦？',           a: '前往「爬蟲排程」頁，可以看到目前所有監控網址的清單，點擊刪除後重新新增正確網址即可。' },
        ],
      },
    ],
  },
]

/* ── Block renderer ── */
function Block({ block }) {
  if (block.type === 'text') {
    return (
      <p style={{
        color: 'var(--text-secondary)', fontSize: 15,
        lineHeight: 1.8, margin: '0 0 18px',
      }}>{block.value}</p>
    )
  }

  if (block.type === 'cards') {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 14, marginBottom: 18,
      }}>
        {block.items.map((item, i) => (
          <div key={i} className="gp-feature-card" style={{ animationDelay: `${i * 70}ms` }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, marginBottom: 14,
              background: item.grad,
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{item.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 7, lineHeight: 1.3 }}>
              {item.title}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              {item.desc}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (block.type === 'steps') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 18 }}>
        {block.items.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 18, position: 'relative', paddingBottom: i < block.items.length - 1 ? 28 : 0 }}>
            {/* connecting line */}
            {i < block.items.length - 1 && (
              <div style={{
                position: 'absolute', left: 17, top: 36, width: 2,
                height: 'calc(100% - 8px)',
                background: 'linear-gradient(to bottom, rgba(155,109,202,0.4), rgba(212,149,106,0.15))',
              }}/>
            )}
            <StepBubble n={i + 1} />
            <div style={{ paddingTop: 6, paddingBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                {item.title}
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                {item.desc}
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (block.type === 'table') {
    return (
      <div style={{
        borderRadius: 12, overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.07)',
        marginBottom: 18,
      }}>
        {block.rows.map((row, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '180px 1fr',
            borderBottom: i < block.rows.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
          }}>
            <div style={{
              padding: '12px 16px',
              background: 'rgba(155,109,202,0.08)',
              borderRight: '1px solid rgba(155,109,202,0.12)',
              fontFamily: "'DM Mono', monospace",
              fontSize: 12, fontWeight: 500,
              color: 'var(--amethyst-light)',
              display: 'flex', alignItems: 'center',
            }}>{row.label}</div>
            <div style={{
              padding: '12px 16px',
              fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6,
              background: i % 2 === 1 ? 'rgba(255,255,255,0.01)' : 'transparent',
            }}>{row.desc}</div>
          </div>
        ))}
      </div>
    )
  }

  if (block.type === 'tips') {
    return (
      <div style={{
        background: 'rgba(155,109,202,0.04)',
        border: '1px solid rgba(155,109,202,0.12)',
        borderRadius: 12, marginBottom: 18,
        padding: '6px 4px',
        overflow: 'hidden',
      }}>
        {block.items.map((tip, i) => (
          <div key={i} className="gp-tip-row">
            <div style={{
              width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 1,
              background: 'linear-gradient(135deg, rgba(155,109,202,0.3), rgba(212,149,106,0.2))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'linear-gradient(135deg, #c084fc, #d4956a)' }}/>
            </div>
            <span>{tip}</span>
          </div>
        ))}
      </div>
    )
  }

  if (block.type === 'faq') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {block.items.map((item, i) => (
          <FaqItem key={i} q={item.q} a={item.a} delay={i * 50} />
        ))}
      </div>
    )
  }

  return null
}

/* ── Main ── */
export default function GuidePage({ onNav }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: INJECT_CSS }} />
      <div style={{ padding: '36px 24px 80px', maxWidth: 860, margin: '0 auto' }}>

        {/* ── Hero Header ── */}
        <div style={{
          marginBottom: 40,
          padding: '36px 32px',
          borderRadius: 20,
          background: 'linear-gradient(135deg, rgba(155,109,202,0.1) 0%, rgba(212,149,106,0.07) 50%, rgba(0,0,0,0) 100%)',
          border: '1px solid rgba(155,109,202,0.15)',
          position: 'relative', overflow: 'hidden',
          animation: 'gp-fadeUp 0.5s ease both',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 28,
        }}>
          {/* decorative orb */}
          <div style={{
            position: 'absolute', top: -60, right: -60,
            width: 240, height: 240, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(155,109,202,0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}/>

          {/* left: text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.28em', color: 'var(--amethyst)', textTransform: 'uppercase', marginBottom: 14 }}>
              使用說明 · GUIDE
            </div>
            <h1 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 48, fontWeight: 300, letterSpacing: '-0.025em', lineHeight: 1.05,
              background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--rose-light) 50%, var(--amethyst-light) 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              margin: '0 0 14px',
            }}>
              第一次使用？
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.7, margin: 0, maxWidth: 420 }}>
              這裡有你需要知道的一切——從平台設定到 LINE 通知，一步步帶你上手。
            </p>
          </div>

          {/* right: CTA */}
          {onNav && (
            <button
              onClick={() => onNav('register')}
              style={{
                flexShrink: 0, position: 'relative', zIndex: 1,
                background: 'linear-gradient(135deg, rgba(155,109,202,0.18), rgba(212,149,106,0.12))',
                border: '1px solid rgba(155,109,202,0.35)',
                borderRadius: 18, padding: '22px 26px',
                cursor: 'pointer', textAlign: 'center',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                transition: 'all 0.25s ease',
                minWidth: 148,
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 36px rgba(155,109,202,0.28)'; e.currentTarget.style.borderColor = 'rgba(155,109,202,0.6)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = 'rgba(155,109,202,0.35)' }}
            >
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: 'linear-gradient(135deg, rgba(155,109,202,0.25), rgba(212,149,106,0.18))',
                border: '1px solid rgba(155,109,202,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8z" stroke="url(#cta-g)" strokeWidth="1.8" fill="none"/>
                  <path d="M12 14c-5 0-8 2-8 4v1h16v-1c0-2-3-4-8-4z" stroke="url(#cta-g)" strokeWidth="1.8" fill="none"/>
                  <path d="M17 7l1.5 1.5M17 10h2M19 13l-1.5 1.5" stroke="url(#cta-g)" strokeWidth="1.6" strokeLinecap="round" opacity="0.7"/>
                  <defs>
                    <linearGradient id="cta-g" x1="4" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#c084fc"/><stop offset="1" stopColor="#d4956a"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--amethyst-light)', lineHeight: 1.3, fontFamily: "'Noto Sans TC', sans-serif" }}>前往初始設定</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em' }}>SETUP →</div>
            </button>
          )}
        </div>

        {/* ── TOC ── */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 44,
          padding: '16px 18px',
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 14,
          animation: 'gp-fadeUp 0.5s ease both',
          animationDelay: '80ms',
        }}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: '0.2em', color: 'var(--text-muted)', textTransform: 'uppercase', alignSelf: 'center', marginRight: 4 }}>
            目錄
          </span>
          {SECTIONS.map(sec => (
            <a key={sec.id} href={`#${sec.id}`} className="gp-toc-pill">
              <span style={{ display: 'flex', alignItems: 'center' }}>{sec.icon}</span>
              {sec.title}
            </a>
          ))}
        </div>

        {/* ── Sections ── */}
        {SECTIONS.map((sec, idx) => (
          <section key={sec.id} className="gp-section" style={{ animationDelay: `${100 + idx * 60}ms` }}>
            <SectionHeading icon={sec.icon} title={sec.title} id={sec.id} />
            {sec.content.map((block, i) => <Block key={i} block={block} />)}
          </section>
        ))}

        {/* ── Footer note ── */}
        <div style={{
          marginTop: 16, padding: '18px 22px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 12,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(155,109,202,0.2), rgba(212,149,106,0.15))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="url(#ft-g)" strokeWidth="1.8"/>
              <path d="M12 8v4l3 3" stroke="url(#ft-g)" strokeWidth="2" strokeLinecap="round"/>
              <defs><linearGradient id="ft-g" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse"><stop stopColor="#c084fc"/><stop offset="1" stopColor="#d4956a"/></linearGradient></defs>
            </svg>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
            更多功能說明持續更新中。如有問題，可直接查看原始碼或聯繫開發者。
          </p>
        </div>

      </div>
    </>
  )
}
