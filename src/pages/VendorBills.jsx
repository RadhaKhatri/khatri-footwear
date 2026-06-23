import React, { useState, useEffect } from 'react'
import api from '../utils/api'
import { Upload, CheckCircle, FileText } from 'lucide-react'

export default function VendorBills() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState(null)
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState([])

  useEffect(() => {
    api.get('/api/vendor-bills').then(r => setHistory(r.data)).catch(() => {})
  }, [])

  const handleFile = f => {
    setFile(f); setExtracted(null)
    if (f?.type?.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = e => setPreview(e.target.result)
      reader.readAsDataURL(f)
    } else setPreview(null)
  }

  const extract = async () => {
    if (!file) return
    setExtracting(true)
    const fd = new FormData(); fd.append('bill', file)
    try {
      const r = await api.post('/api/vendor-bills/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setExtracted(Array.isArray(r.data.items) ? r.data.items : [r.data.items])
    } catch (e) { alert(e.response?.data?.error || 'Extraction failed.') }
    setExtracting(false)
  }

  const updateRow = (i, k, v) => setExtracted(p => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r))

  const confirmSave = async () => {
    setSaving(true)
    try {
      for (const item of extracted) await api.post('/api/products', item)
      alert(`✅ ${extracted.length} stock item(s) saved successfully!`)
      setFile(null); setPreview(null); setExtracted(null)
      api.get('/api/vendor-bills').then(r => setHistory(r.data)).catch(() => {})
    } catch { alert('Failed to save.') }
    setSaving(false)
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-blue-900">Vendor Bills</h2>
        <p className="text-sm text-gray-500">Upload vendor bills — AI extracts all stock items automatically.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Upload area */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-6">
            <div className="section-title">📤 Upload Vendor Bill</div>
            <div className="alert-info mb-4">
              Works best with clear photos of printed invoices. AI reads brand, article, size, colour, quantity, and price from the bill.
            </div>
            <div
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
              onClick={() => document.getElementById('vbill-file').click()}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}>
              <Upload size={36} className="mx-auto mb-3 text-gray-300" />
              <div className="text-sm font-semibold text-gray-600">Click or drag your vendor bill here</div>
              <div className="text-xs text-gray-400 mt-1">JPG, PNG, PDF · Max 10 MB</div>
              <input type="file" id="vbill-file" className="hidden" accept="image/*,.pdf" onChange={e => handleFile(e.target.files[0])} />
            </div>

            {preview && <img src={preview} alt="Bill preview" className="mt-4 rounded-lg border border-gray-100 max-h-56 object-contain w-full" />}
            {file && !preview && <div className="alert-info mt-4 flex items-center gap-2"><FileText size={16} /> {file.name}</div>}

            {file && (
              <div className="flex gap-3 mt-4">
                <button onClick={extract} disabled={extracting} className="btn-primary flex items-center gap-2">
                  {extracting ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '🧠'}
                  {extracting ? 'Reading bill with AI...' : 'Extract Stock Data'}
                </button>
                <button onClick={() => { setFile(null); setPreview(null); setExtracted(null) }} className="btn-secondary">Remove</button>
              </div>
            )}
          </div>

          {/* Review */}
          {extracted && (
            <div className="card p-6">
              <div className="section-title"><CheckCircle size={16} className="text-green-600" /> Review Extracted Items</div>
              <div className="alert-success mb-4">AI found {extracted.length} item(s). Edit any field, then confirm to save.</div>
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 table-header">
                    <tr>{['Brand','Article','Cat','Size','Colour','Qty','Buy ₹','Sell ₹','Vendor'].map(h => <th key={h} className="px-2 py-2 text-left">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {extracted.map((row, i) => (
                      <tr key={i} className="border-t border-gray-50">
                        {[['brand','text'],['article_number','text'],['category','cat'],['size','text'],['color','text'],['quantity','num'],['purchase_price','num'],['selling_price','num'],['vendor','text']].map(([k, t]) => (
                          <td key={k} className="px-1 py-1">
                            {t === 'cat'
                              ? <select className="border border-gray-200 rounded px-1 py-1 text-xs" value={row[k]||'Men'} onChange={e => updateRow(i,k,e.target.value)}>
                                  {['Men','Women','Kids','Sports','Casual','Formal'].map(c=><option key={c}>{c}</option>)}
                                </select>
                              : <input className="border border-gray-200 rounded px-1.5 py-1 text-xs w-full min-w-[55px]" type={t==='num'?'number':'text'} value={row[k]||''} onChange={e => updateRow(i,k,e.target.value)} />
                            }
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={confirmSave} disabled={saving} className="btn-success flex items-center gap-2">
                  {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle size={15} />}
                  {saving ? 'Saving...' : `Confirm & Save ${extracted.length} Item(s)`}
                </button>
                <button onClick={() => setExtracted(null)} className="btn-secondary">Discard</button>
              </div>
            </div>
          )}
        </div>

        {/* History */}
        <div className="card p-5">
          <div className="section-title">📋 Upload History</div>
          {!history.length
            ? <p className="text-sm text-gray-400 py-4 text-center">No bills uploaded yet.</p>
            : <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {history.map(b => (
                  <div key={b.id} className="p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                    <div className="font-semibold text-sm text-blue-900">{b.vendor_name || 'Unknown Vendor'}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{b.created_at?.split('T')[0]}</div>
                    {b.cloudinary_url && (
                      <a href={b.cloudinary_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline mt-1 block">View bill ↗</a>
                    )}
                  </div>
                ))}
              </div>
          }
        </div>
      </div>
    </div>
  )
}
