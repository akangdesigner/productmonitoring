import { useEffect, useRef, useState } from 'react'

const CLIENT_ID = '838352037247-km4l8l1qlfrmp0bv4o85lupkun99q2t9.apps.googleusercontent.com'

const CSS = `
@keyframes lp-fadeUp {
  from { opacity: 0; transform: translateY(22px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes lp-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes lp-pulse {
  0%,100% { opacity: 1; } 50% { opacity: 0.45; }
}
@keyframes lp-gradFlow {
  0%,100% { background-position: 0% 50%; }
  50%      { background-position: 100% 50%; }
}
.lp-card {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 24px;
  padding: 52px 44px 44px;
  width: 380px;
  animation: lp-fadeUp 0.6s ease both;
  backdrop-filter: blur(16px);
  position: relative;
  z-index: 1;
}
`

export default function LoginPage({ onLogin }) {
  const btnRef = useRef(null)
  const callbackRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [gisReady, setGisReady] = useState(false)

  callbackRef.current = async ({ credential }) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || '驗證失敗')
      localStorage.setItem('auth_token', data.token)
      localStorage.setItem('auth_user', JSON.stringify(data.user))
      onLogin(data.user)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  useEffect(() => {
    function init() {
      if (!window.google) return
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (r) => callbackRef.current(r),
      })
      setGisReady(true)
    }

    if (window.google) {
      init()
    } else {
      const t1 = setTimeout(init, 600)
      const t2 = setTimeout(init, 1800)
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
  }, [])

  useEffect(() => {
    if (gisReady && btnRef.current) {
      window.google.accounts.id.renderButton(btnRef.current, {
        theme: 'filled_black',
        size: 'large',
        shape: 'pill',
        width: 260,
      })
    }
  }, [gisReady])

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}>
        <div className="lp-card">
          {/* 裝飾漸層光暈 */}
          <div style={{
            position: 'absolute', top: -80, right: -80,
            width: 240, height: 240, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(155,109,202,0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          {/* Monospace 標籤 */}
          <div style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 10, letterSpacing: '0.28em',
            color: 'var(--amethyst)', textTransform: 'uppercase',
            marginBottom: 18, textAlign: 'center',
          }}>
            Competitive Intel
          </div>

          {/* 主標題 */}
          <h1 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 42, fontWeight: 300,
            letterSpacing: '-0.02em', lineHeight: 1.1,
            background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--rose-light) 45%, var(--amethyst-light) 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            margin: '0 0 10px', textAlign: 'center',
          }}>
            美妝競品監控台
          </h1>

          <p style={{
            color: 'var(--text-muted)', fontSize: 13,
            textAlign: 'center', margin: '0 0 36px',
            lineHeight: 1.6,
          }}>
            請使用 Google 帳號登入以繼續
          </p>

          {/* 分隔線 */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 32 }} />

          {/* Google 登入按鈕區 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>

            {loading ? (
              <div style={{
                color: 'var(--text-muted)', fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 10,
                animation: 'lp-pulse 1.4s ease infinite',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  style={{ animation: 'lp-spin 0.9s linear infinite' }}>
                  <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.18)" strokeWidth="3"/>
                  <path d="M12 3a9 9 0 0 1 9 9" stroke="var(--amethyst)" strokeWidth="3" strokeLinecap="round"/>
                </svg>
                驗證中，請稍候…
              </div>
            ) : (
              <div
                ref={btnRef}
                style={{ minHeight: 44, display: 'flex', justifyContent: 'center' }}
              />
            )}

            {!gisReady && !loading && (
              <div style={{
                color: 'var(--text-muted)', fontSize: 12,
                animation: 'lp-pulse 1.5s ease infinite',
              }}>
                載入登入元件…
              </div>
            )}

            {error && (
              <div style={{
                color: '#f87171', fontSize: 12,
                padding: '9px 16px',
                background: 'rgba(239,68,68,0.07)',
                borderRadius: 8,
                border: '1px solid rgba(239,68,68,0.18)',
                textAlign: 'center',
              }}>
                {error}
              </div>
            )}
          </div>

          {/* 底部說明 */}
          <p style={{
            marginTop: 32, color: 'var(--text-muted)',
            fontSize: 11, textAlign: 'center', lineHeight: 1.6,
          }}>
            僅限授權帳號使用<br />
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>登入即代表同意使用條款</span>
          </p>
        </div>
      </div>
    </>
  )
}
