import { useState } from 'react'

const EMOJIS = ['✨','💄','🖤','💋','🌸','💊','🧴']

export default function AddProductModal({ open, onClose, onSubmit }) {
  const [name, setName]         = useState('')
  const [brand, setBrand]       = useState('')
  const [category, setCategory] = useState('skincare')
  const [emoji, setEmoji]       = useState('✨')
  const [urlW, setUrlW]         = useState('')
  const [urlC, setUrlC]         = useState('')
  const [urlP, setUrlP]         = useState('')
  const [loading, setLoading]   = useState(false)

  function reset() {
    setName(''); setBrand(''); setCategory('skincare'); setEmoji('✨')
    setUrlW(''); setUrlC(''); setUrlP('')
  }

  function handleClose() { reset(); onClose() }

  async function handleSubmit() {
    if (!name.trim())              return alert('請填寫商品名稱')
    if (!urlW && !urlC && !urlP)   return alert('至少填寫一個平台網址')
    const urls = []
    if (urlW) urls.push({ platform: 'watsons', url: urlW.trim() })
    if (urlC) urls.push({ platform: 'cosmed',  url: urlC.trim() })
    if (urlP) urls.push({ platform: 'poya',    url: urlP.trim() })
    setLoading(true)
    await onSubmit({ name: name.trim(), brand: brand.trim(), category, emoji, urls })
    setLoading(false)
    reset()
  }

  if (!open) return null

  return (
    <div className="modal-backdrop open" onClick={e => e.target === e.currentTarget && handleClose()}>
      <div className="modal">
        <div className="modal-title">
          新增監控商品
          <button className="modal-close" onClick={handleClose}>✕</button>
        </div>

        <div className="modal-section">基本資訊</div>
        <div className="modal-row">
          <div className="form-group">
            <label className="form-label">商品名稱 *</label>
            <input className="form-input" placeholder="例：SK-II 神仙水 230ml" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">品牌</label>
            <input className="form-input" placeholder="例：SK-II" value={brand} onChange={e => setBrand(e.target.value)} />
          </div>
        </div>

        <div className="modal-row" style={{ marginTop: 12 }}>
          <div className="form-group">
            <label className="form-label">品類</label>
            <select className="form-input select-styled" value={category} onChange={e => setCategory(e.target.value)}>
              <option value="skincare">保養</option>
              <option value="makeup">彩妝</option>
              <option value="haircare">洗護</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">圖示</label>
            <div className="emoji-picker">
              {EMOJIS.map(e => (
                <div key={e} className={`emoji-btn${emoji === e ? ' selected' : ''}`} onClick={() => setEmoji(e)}>{e}</div>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-section">各平台商品網址</div>
        {[
          { label: '屈臣氏', cls: 'watsons', val: urlW, set: setUrlW, ph: 'https://www.watsons.com.tw/product/...' },
          { label: '康是美', cls: 'cosmed',  val: urlC, set: setUrlC, ph: 'https://www.cosmed.com.tw/product/...' },
          { label: '寶雅',   cls: 'poya',    val: urlP, set: setUrlP, ph: 'https://www.poyabuy.com.tw/v2/official/SalePageDetail/...' },
        ].map(({ label, cls, val, set, ph }) => (
          <div key={cls} className="url-row">
            <span className={`url-label ${cls}`}>{label}</span>
            <input className="form-input" placeholder={ph} value={val} onChange={e => set(e.target.value)} />
          </div>
        ))}

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={handleClose}>取消</button>
          <button className={`btn btn-primary${loading ? ' loading' : ''}`} onClick={handleSubmit} disabled={loading}>
            ✦ 加入監控
          </button>
        </div>
      </div>
    </div>
  )
}
