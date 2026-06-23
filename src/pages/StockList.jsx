import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { Search, Edit2, Trash2, Download, AlertTriangle, RefreshCw } from 'lucide-react'

const CATS = ['All', 'Men', 'Women', 'Kids', 'Sports', 'Casual', 'Formal']
const PER_PAGE = 15

export default function StockList() {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [page, setPage] = useState(1)
  const [editModal, setEditModal] = useState(null)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: PER_PAGE }
      if (search) params.search = search
      if (category !== 'All') params.category = category
      const r = await api.get('/api/products', { params })
      setItems(r.data.items)
      setTotal(r.data.total)
    } catch {}
    setLoading(false)
  }, [page, search, category])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, category])

  const deleteItem = async id => {
    if (!confirm('Delete this stock item? This cannot be undone.')) return
    await api.delete(`/api/products/${id}`)
    load()
  }

  const exportCSV = async () => {
    const r = await api.get('/api/products', { params: { limit: 9999 } })
    const rows = r.data.items
    const cols = ['brand', 'article_number', 'category', 'size', 'color', 'quantity', 'purchase_price', 'selling_price', 'vendor', 'purchase_date']
    const header = 'Brand,Article Number,Category,Size,Colour,Qty,Purchase Price,Selling Price,Vendor,Date\n'
    const body = rows.map(row => cols.map(c => `"${row[c] ?? ''}"`).join(',')).join('\n')
    const blob = new Blob([header + body], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `khatri-stock-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const totalPages = Math.ceil(total / PER_PAGE)
  const lowCount = items.filter(s => s.quantity <= s.low_stock_threshold).length

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold text-blue-900">Stock List</h2>
          <p className="text-sm text-gray-500">{total} items · {lowCount > 0 ? <span className="text-red-600 font-medium">{lowCount} low stock</span> : 'all well-stocked'}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="btn-secondary btn-sm flex items-center gap-1.5"><Download size={14} /> Export CSV</button>
          <button onClick={() => navigate('/add-stock')} className="btn-primary btn-sm flex items-center gap-1.5">+ Add Stock</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 flex-1">
          <Search size={15} className="text-gray-400" />
          <input className="flex-1 outline-none text-sm bg-transparent" placeholder="Search brand, article, colour, vendor..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="select-field sm:w-40" value={category} onChange={e => setCategory(e.target.value)}>
          {CATS.map(c => <option key={c}>{c}</option>)}
        </select>
        <button onClick={load} className="btn-secondary btn-sm flex items-center gap-1.5"><RefreshCw size={14} /> Refresh</button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          ['Showing', items.length],
          ['Total Units', items.reduce((a, s) => a + Number(s.quantity), 0)],
          ['Retail Value', '₹' + items.reduce((a, s) => a + s.quantity * s.selling_price, 0).toLocaleString('en-IN')],
          ['Low Stock', items.filter(s => s.quantity <= s.low_stock_threshold).length],
        ].map(([l, v]) => (
          <div key={l} className="stat-card py-3">
            <div className="text-xs text-gray-400 uppercase font-semibold tracking-wide">{l}</div>
            <div className={`text-lg font-bold mt-1 ${l === 'Low Stock' && v > 0 ? 'text-red-600' : 'text-blue-900'}`}>{v}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="table-header">
              <tr>
                {['#','Brand','Article','Category','Size','Colour','Qty','Purchase ₹','Selling ₹','Margin','Vendor','Date','Actions'].map(h => (
                  <th key={h} className="px-3 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan="13" className="text-center py-10 text-gray-400">Loading...</td></tr>}
              {!loading && !items.length && (
                <tr><td colSpan="13" className="text-center py-10 text-gray-400">No stock items found</td></tr>
              )}
              {items.map((s, i) => {
                const isLow = s.quantity <= s.low_stock_threshold
                const mg = s.selling_price > 0 ? Math.round((s.selling_price - s.purchase_price) / s.selling_price * 100) : 0
                return (
                  <tr key={s.id} className={`hover:bg-gray-50 ${isLow ? 'bg-red-50/50' : ''}`}>
                    <td className="table-cell text-gray-400 text-xs">{(page - 1) * PER_PAGE + i + 1}</td>
                    <td className="table-cell font-semibold text-gray-800">{s.brand}</td>
                    <td className="table-cell"><span className="badge-blue">{s.article_number}</span></td>
                    <td className="table-cell"><span className="badge-gray">{s.category || '–'}</span></td>
                    <td className="table-cell text-sm">{s.size}</td>
                    <td className="table-cell text-sm">{s.color}</td>
                    <td className="table-cell">
                      {isLow
                        ? <span className="badge-red flex items-center gap-1"><AlertTriangle size={10} />{s.quantity}</span>
                        : <span className="font-bold text-sm">{s.quantity}</span>}
                    </td>
                    <td className="table-cell text-sm">₹{Number(s.purchase_price).toLocaleString('en-IN')}</td>
                    <td className="table-cell text-sm font-medium">₹{Number(s.selling_price).toLocaleString('en-IN')}</td>
                    <td className="table-cell">
                      <span className={mg >= 30 ? 'badge-green' : mg >= 15 ? 'badge-amber' : 'badge-red'}>{mg}%</span>
                    </td>
                    <td className="table-cell text-xs text-gray-400">{s.vendor || '–'}</td>
                    <td className="table-cell text-xs text-gray-400">{s.purchase_date ? s.purchase_date.split('T')[0] : '–'}</td>
                    <td className="table-cell">
                      <div className="flex gap-1">
                        <button onClick={() => setEditModal(s)} className="p-1.5 rounded hover:bg-blue-50 text-blue-600 transition-colors"><Edit2 size={13} /></button>
                        <button onClick={() => deleteItem(s.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-1.5 mt-4">
          {Array.from({ length: totalPages }, (_, i) => (
            <button key={i} onClick={() => setPage(i + 1)}
              className={`w-8 h-8 rounded text-xs font-medium border transition-colors ${page === i+1 ? 'bg-blue-900 text-white border-blue-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {editModal && <EditModal item={editModal} onClose={() => setEditModal(null)} onSave={() => { setEditModal(null); load() }} />}
    </div>
  )
}

function EditModal({ item, onClose, onSave }) {
  const [form, setForm] = useState({ ...item })
  const [saving, setSaving] = useState(false)
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const save = async () => {
    setSaving(true)
    try { await api.patch(`/api/products/${item.id}`, form); onSave() }
    catch { alert('Failed to update.') }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-lg font-bold text-blue-900">Edit Stock Item</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[['Brand','brand'],['Article Number','article_number'],['Size','size'],['Colour','color'],['Quantity','quantity'],['Purchase Price','purchase_price'],['Selling Price','selling_price'],['Vendor','vendor']].map(([l,k]) => (
            <div key={k}>
              <label className="label">{l}</label>
              <input className="input-field" value={form[k]||''} onChange={e => f(k, e.target.value)} />
            </div>
          ))}
          <div>
            <label className="label">Category</label>
            <select className="select-field" value={form.category||'Men'} onChange={e => f('category', e.target.value)}>
              {['Men','Women','Kids','Sports','Casual','Formal'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Low Stock Threshold</label>
            <input className="input-field" type="number" value={form.low_stock_threshold||3} onChange={e => f('low_stock_threshold', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  )
}
