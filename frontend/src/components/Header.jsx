import { useState, useEffect } from 'react'

export default function Header() {
  const [time, setTime] = useState('')

  useEffect(() => {
    const update = () => {
      setTime(new Date().toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }))
    }
    update()
    const t = setInterval(update, 60000)
    return () => clearInterval(t)
  }, [])

  return (
    <header className="header">
      <div className="header-left">
        <h1>價格與贈品 <em>監控台</em></h1>
        <p>監控屈臣氏・康是美・寶雅・競品官網｜即時比價・降價預警</p>
      </div>
      <div className="header-right">
        <div className="last-update">
          <span>{time}</span>
          最後更新
        </div>
      </div>
    </header>
  )
}
