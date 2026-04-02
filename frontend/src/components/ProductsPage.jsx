import { useState, useEffect, useRef } from 'react'
import { apiFetch } from '../api'

const CATEGORY_LABEL = {
  skincare: '保養', makeup: '彩妝', haircare: '洗護', 唇膏: '唇膏', other: '其他',
}
const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABEL)

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []
  const headers = lines[0].split(/,|\t/).map(h => h.trim().toLowerCase())
  return lines.slice(1).map(line => {
    const cols = line.split(/,|\t/)
    const row = {}
    headers.forEach((h, i) => { row[h] = (cols[i] || '').trim() })
    return row
  }).filter(r => r['名稱'] || r['name'])
}

function mapRow(row) {
  return {
    name:      row['名稱']  || row['name']      || '',
    brand:     row['品牌']  || row['brand']     || '',
    category:  row['品類']  || row['category']  || 'skincare',
    price:     parseFloat(row['售價'] || row['price'] || '') || null,
    image_url: row['圖片']  || row['image_url'] || row['image'] || '',
    note:      row['備註']  || row['note']      || '',
  }
}

function ProductCard({ p, onEdit, onDelete }) {
  const hasImg = p.image_url?.startsWith('http')
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
      borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        height: 120, background: 'rgba(0,0,0,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 36, overflow: 'hidden',
      }}>
        {hasImg
          ? <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />
          : '✨'
        }
      </div>
      <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.brand || '—'}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>{p.name}</div>
        <span style={{ fontSize: 10, background: 'rgba(155,109,202,0.2)', color: '#c084fc', padding: '2px 6px', borderRadius: 4, alignSelf: 'flex-start' }}>
          {CATEGORY_LABEL[p.category] || p.category}
        </span>
        {p.price != null && (
          <div style={{ fontSize: 13, color: '#4ade80', fontWeight: 600 }}>
            NT${Number(p.price).toLocaleString()}
          </div>
        )}
        {p.note && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.note}</div>}
      </div>
      <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6 }}>
        <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 10px', flex: 1 }} onClick={() => onEdit(p)}>✎ 編輯</button>
        <button
          onClick={() => onDelete(p.id, p.name)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: '3px 6px', borderRadius: 4 }}
          onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >✕</button>
      </div>
    </div>
  )
}

const EMPTY_FORM = { name: '', brand: '', category: 'skincare', image_url: '', price: '', note: '' }

export default function ProductsPage({ isOnline, toast }) {
  const [products,  setProducts]  = useState([])
  const [loading,   setLoading]   = useState(false)
  const [keyword,   setKeyword]   = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [modal,     setModal]     = useState(false)
  const [editId,    setEditId]    = useState(null)
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [saving,    setSaving]    = useState(false)
  const [csvRows,   setCsvRows]   = useState([])
  const [csvBusy,   setCsvBusy]   = useState(false)
  const fileRef = useRef()

  async function load() {
    if (!isOnline) return
    setLoading(true)
    try { setProducts(await apiFetch('/api/my-products') || []) } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [isOnline])

  const kw = keyword.trim().toLowerCase()
  const filtered = products.filter(p => {
    if (catFilter !== 'all' && p.category !== catFilter) return false
    if (kw && !(p.name || '').toLowerCase().includes(kw) && !(p.brand || '').toLowerCase().includes(kw)) return false
    return true
  })

  function openAdd() { setEditId(null); setForm(EMPTY_FORM); setModal(true) }
  function openEdit(p) {
    setEditId(p.id)
    setForm({ name: p.name || '', brand: p.brand || '', category: p.category || 'skincare', image_url: p.image_url || '', price: p.price != null ? String(p.price) : '', note: p.note || '' })
    setModal(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { toast('商品名稱為必填', 'error'); return }
    setSaving(true)
    const payload = {
      name:      form.name.trim(),
      brand:     form.brand.trim() || null,
      category:  form.category,
      image_url: form.image_url.trim() || null,
      price:     form.price !== '' ? parseFloat(form.price) : null,
      note:      form.note.trim() || null,
    }
    try {
      if (editId) {
        await apiFetch(`/api/my-products/${editId}`, { method: 'PATCH', body: JSON.stringify(payload) })
        toast('已更新', 'success')
      } else {
        await apiFetch('/api/my-products', { method: 'POST', body: JSON.stringify(payload) })
        toast(`已新增「${payload.name}」`, 'success')
      }
      setModal(false)
      await load()
    } catch (err) { toast(`儲存失敗：${err.message}`, 'error') }
    setSaving(false)
  }

  async function handleDelete(id, name) {
    if (!isOnline) { toast('後端離線', 'error'); return }
    if (!window.confirm(`確定刪除「${name}」？`)) return
    try {
      await apiFetch(`/api/my-products/${id}`, { method: 'DELETE' })
      toast('已刪除', 'success')
      setProducts(prev => prev.filter(p => p.id !== id))
    } catch (err) { toast(`刪除失敗：${err.message}`, 'error') }
  }

  async function handleClearAll() {
    if (!isOnline) { toast('後端離線', 'error'); return }
    if (!window.confirm(`確定清空全部 ${products.length} 項商品？`)) return
    try {
      await apiFetch('/api/my-products/all', { method: 'DELETE' })
      toast('已清空', 'success')
      setProducts([])
    } catch (err) { toast(`失敗：${err.message}`, 'error') }
  }

  function handleCSVFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const rows = parseCSV(ev.target.result).map(mapRow).filter(r => r.name)
      if (!rows.length) { toast('CSV 解析失敗，請確認欄位', 'error'); return }
      setCsvRows(rows)
    }
    reader.readAsText(file, 'UTF-8')
    e.target.value = ''
  }

  async function handleCSVImport() {
    if (!isOnline) { toast('後端離線', 'error'); return }
    setCsvBusy(true)
    let ok = 0, fail = 0
    for (const row of csvRows) {
      try { await apiFetch('/api/my-products', { method: 'POST', body: JSON.stringify(row) }); ok++ }
      catch { fail++ }
    }
    toast(`匯入完成：成功 ${ok} 筆${fail ? `，失敗 ${fail} 筆` : ''}`, fail ? 'info' : 'success')
    setCsvRows([])
    setCsvBusy(false)
    await load()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* 標題列 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>我的商品</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>共 {products.length} 項</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {products.length > 0 && (
            <button className="btn btn-ghost" style={{ fontSize: 12, color: '#f87171' }} onClick={handleClearAll}>
              清空全部
            </button>
          )}
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => fileRef.current?.click()}>
            📂 CSV 批量匯入
          </button>
          <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" style={{ display: 'none' }} onChange={handleCSVFile} />
          <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={openAdd}>＋ 單筆新增</button>
        </div>
      </div>

      {/* CSV 預覽 */}
      {csvRows.length > 0 && (
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>CSV 預覽（共 {csvRows.length} 筆）</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setCsvRows([])}>取消</button>
              <button className={`btn btn-primary${csvBusy ? ' loading' : ''}`} style={{ fontSize: 12 }} onClick={handleCSVImport} disabled={csvBusy}>
                {csvBusy ? '匯入中…' : `確認匯入 ${csvRows.length} 筆`}
              </button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="price-table">
              <thead><tr><th>名稱</th><th>品牌</th><th>品類</th><th>售價</th><th>備註</th></tr></thead>
              <tbody>
                {csvRows.slice(0, 10).map((r, i) => (
                  <tr key={i}>
                    <td>{r.name}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{r.brand || '—'}</td>
                    <td>{CATEGORY_LABEL[r.category] || r.category}</td>
                    <td>{r.price != null ? `NT$${r.price.toLocaleString()}` : '—'}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{r.note || '—'}</td>
                  </tr>
                ))}
                {csvRows.length > 10 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>…還有 {csvRows.length - 10} 筆</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
            欄位格式：<code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 3 }}>名稱,品牌,品類,售價,備註</code>
          </div>
        </div>
      )}

      {/* 篩選列 */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text" placeholder="搜尋名稱或品牌…" value={keyword}
          onChange={e => setKeyword(e.target.value)}
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', fontSize: 12, color: 'var(--text-primary)', outline: 'none', width: 180 }}
        />
        <select className="select-styled" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="all">全部品類</option>
          {CATEGORY_OPTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>顯示 {filtered.length} / {products.length} 項</div>
      </div>

      {/* 商品 Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '48px 0' }}>載入中…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '48px 0', border: '1px dashed var(--border)', borderRadius: 10, fontSize: 13 }}>
          {products.length === 0 ? '尚無商品，點擊「單筆新增」或「CSV 批量匯入」開始' : '找不到符合的商品'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
          {filtered.map(p => <ProductCard key={p.id} p={p} onEdit={openEdit} onDelete={handleDelete} />)}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px 28px', width: 420, maxWidth: '90vw' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>{editId ? '編輯商品' : '新增商品'}</div>

            {[
              ['商品名稱 *', 'name',      'text',   '例：SK-II 神仙水 230ml'],
              ['品牌',       'brand',     'text',   '例：SK-II'],
              ['圖片網址',   'image_url', 'url',    'https://…'],
              ['售價',       'price',     'number', '例：3960'],
              ['備註',       'note',      'text',   '選填'],
            ].map(([label, key, type, ph]) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>{label}</div>
                <input type={type} className="form-input" placeholder={ph} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>品類</div>
              <select className="select-styled" style={{ width: '100%' }} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORY_OPTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            {form.image_url?.startsWith('http') && (
              <div style={{ marginBottom: 14, textAlign: 'center' }}>
                <img src={form.image_url} alt="預覽" style={{ maxHeight: 100, maxWidth: '100%', borderRadius: 6, objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setModal(false)}>取消</button>
              <button className={`btn btn-primary${saving ? ' loading' : ''}`} onClick={handleSave} disabled={saving}>
                {saving ? '儲存中…' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
