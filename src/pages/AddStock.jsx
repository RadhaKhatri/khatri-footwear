import React, { useState, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { Mic, MicOff, Upload, Save, RefreshCw, CheckCircle, Plus, Trash2 } from 'lucide-react'

const CATS = ['Men', 'Women', 'Kids', 'Sports', 'Casual', 'Formal']
const UK_SIZES = ['1','2','3','4','5','6','7','7.5','8','8.5','9','9.5','10','10.5','11','12','13']

// Default single-row form
const EMPTY_FORM = {
  brand: '', article_number: '', category: 'Men', color: '',
  purchase_price: '', selling_price: '', vendor: '',
  purchase_date: new Date().toISOString().split('T')[0],
  low_stock_threshold: 3, remarks: ''
}
// Default size row
const EMPTY_SIZE = { size: '', quantity: '' }

export default function AddStock() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState(params.get('tab') || 'manual')
  const [form, setForm] = useState(EMPTY_FORM)
  const [sizeRows, setSizeRows] = useState([{ size: '', quantity: '' }])
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [successCount, setSuccessCount] = useState(0)
  // Voice
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [recSecs, setRecSecs] = useState(0)
  const recRef = useRef(null)
  const timerRef = useRef(null)
  // Image
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [dragging, setDragging] = useState(false)
  // AI
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState(null)
  const navigate = useNavigate()

  const f = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErrors(p => ({ ...p, [k]: '' })) }

  // ── Size rows ────────────────────────────────────────────────────────────────
  const addSizeRow = () => setSizeRows(p => [...p, { size: '', quantity: '' }])
  const removeSizeRow = i => setSizeRows(p => p.filter((_, idx) => idx !== i))
  const updateSizeRow = (i, k, v) => setSizeRows(p => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r))

  // ── Validation ───────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {}
    if (!form.brand.trim()) e.brand = 'Required'
    if (!form.article_number.trim()) e.article_number = 'Required'
    if (!form.color.trim()) e.color = 'Required'
    if (!form.purchase_price || form.purchase_price <= 0) e.purchase_price = 'Required'
    if (!form.selling_price || form.selling_price <= 0) e.selling_price = 'Required'
    const validSizes = sizeRows.filter(r => r.size.trim() && r.quantity > 0)
    if (!validSizes.length) e.sizes = 'Add at least one size with quantity'
    setErrors(e)
    return !Object.keys(e).length
  }

  // ── Save manual (one DB row per size) ────────────────────────────────────────
  const save = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const validSizes = sizeRows.filter(r => r.size.trim() && r.quantity > 0)
      for (const row of validSizes) {
        await api.post('/api/products', {
          ...form,
          size: row.size,
          quantity: parseInt(row.quantity),
          purchase_price: parseFloat(form.purchase_price),
          selling_price: parseFloat(form.selling_price),
          low_stock_threshold: parseInt(form.low_stock_threshold) || 3,
        })
      }
      setSuccessCount(validSizes.length)
      setSuccess(true)
      setForm(EMPTY_FORM)
      setSizeRows([{ size: '', quantity: '' }])
      setTimeout(() => setSuccess(false), 4000)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save stock.')
    }
    setSaving(false)
  }

  // ── Voice ────────────────────────────────────────────────────────────────────
  const startRec = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert('Speech recognition not supported. Please use Chrome or Edge.'); return }
    const sr = new SR()
    sr.continuous = true; sr.interimResults = true; sr.lang = 'en-IN'
    let final = ''
    sr.onresult = e => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + ' '
        else interim += e.results[i][0].transcript
      }
      setTranscript(final + interim)
    }
    sr.start(); recRef.current = sr; setRecording(true); setRecSecs(0)
    timerRef.current = setInterval(() => setRecSecs(s => s + 1), 1000)
  }
  const stopRec = () => {
    recRef.current?.stop(); clearInterval(timerRef.current); setRecording(false)
  }
  const extractVoice = async () => {
    if (!transcript.trim()) { alert('Please record something first.'); return }
    setExtracting(true)
    try {
      const r = await api.post('/api/voice/process', { transcript })
      setExtracted(Array.isArray(r.data) ? r.data : [r.data])
    } catch (err) {
      alert(err.response?.data?.error || 'AI extraction failed. Please fill manually.')
    }
    setExtracting(false)
  }

  // ── Image ────────────────────────────────────────────────────────────────────
  const handleFile = file => {
    setFile(file); setExtracted(null)
    if (file?.type?.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = e => setPreview(e.target.result)
      reader.readAsDataURL(file)
    } else setPreview(null)
  }
  const extractImage = async () => {
    if (!file) return
    setExtracting(true)
    const fd = new FormData(); fd.append('bill', file)
    try {
      const r = await api.post('/api/vendor-bills/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setExtracted(Array.isArray(r.data.items) ? r.data.items : [r.data.items])
      if (r.data.warning) alert('⚠️ ' + r.data.warning)
    } catch (err) {
      alert(err.response?.data?.error || 'Extraction failed. Please fill manually.')
    }
    setExtracting(false)
  }

  const confirmExtracted = async () => {
    setSaving(true)
    try {
      for (const item of extracted) await api.post('/api/products', item)
      setExtracted(null); setFile(null); setPreview(null); setTranscript('')
      setSuccessCount(extracted.length)
      setSuccess(true)
      setTimeout(() => { setSuccess(false); navigate('/stock') }, 2500)
    } catch { alert('Failed to save extracted items.') }
    setSaving(false)
  }
  const updateExtracted = (i, k, v) => setExtracted(p => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r))

  const margin = (pp, sp) => sp > 0 ? Math.round((sp - pp) / sp * 100) : 0

  return (
    <div className="max-w-4xl">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-blue-900">Add Stock</h2>
        <p className="text-sm text-gray-500">Enter new footwear stock via typing, voice, or vendor bill image.</p>
      </div>

      {success && (
        <div className="alert-success mb-5 flex items-center gap-2">
          <CheckCircle size={16} />
          {successCount} stock row{successCount > 1 ? 's' : ''} saved successfully!
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[['manual','✍️ Manual Entry'],['voice','🎤 Voice Entry'],['image','📸 Bill Image']].map(([k, label]) => (
          <button key={k} onClick={() => { setTab(k); setExtracted(null) }}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${tab === k ? 'bg-blue-900 text-white border-blue-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── MANUAL TAB ── */}
      {tab === 'manual' && (
        <div className="card p-6">
          <div className="section-title">📦 Stock Entry Form</div>
          <div className="alert-info mb-5">Fields marked <span className="text-red-500 font-bold">*</span> are required. You can add multiple sizes for the same article below.</div>

          {/* Common fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="label">Brand *</label>
              <input className={`input-field ${errors.brand ? 'border-red-400' : ''}`} placeholder="e.g. Bata, Nike, Paragon" value={form.brand} onChange={e => f('brand', e.target.value)} />
              {errors.brand && <p className="text-xs text-red-500 mt-1">{errors.brand}</p>}
            </div>
            <div>
              <label className="label">Article Number *</label>
              <input className={`input-field ${errors.article_number ? 'border-red-400' : ''}`} placeholder="e.g. B-2341" value={form.article_number} onChange={e => f('article_number', e.target.value)} />
              {errors.article_number && <p className="text-xs text-red-500 mt-1">{errors.article_number}</p>}
            </div>
            <div>
              <label className="label">Category</label>
              <select className="select-field" value={form.category} onChange={e => f('category', e.target.value)}>
                {CATS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Colour *</label>
              <input className={`input-field ${errors.color ? 'border-red-400' : ''}`} placeholder="e.g. Black, White/Blue" value={form.color} onChange={e => f('color', e.target.value)} />
              {errors.color && <p className="text-xs text-red-500 mt-1">{errors.color}</p>}
            </div>
            <div>
              <label className="label">Purchase Price (₹) *</label>
              <input className={`input-field ${errors.purchase_price ? 'border-red-400' : ''}`} type="number" min="0" step="0.01" placeholder="0.00" value={form.purchase_price} onChange={e => f('purchase_price', e.target.value)} />
              {errors.purchase_price && <p className="text-xs text-red-500 mt-1">{errors.purchase_price}</p>}
            </div>
            <div>
              <label className="label">Selling Price (₹) *</label>
              <input className={`input-field ${errors.selling_price ? 'border-red-400' : ''}`} type="number" min="0" step="0.01" placeholder="0.00" value={form.selling_price} onChange={e => f('selling_price', e.target.value)} />
              {errors.selling_price && <p className="text-xs text-red-500 mt-1">{errors.selling_price}</p>}
            </div>
            {form.purchase_price && form.selling_price && (
              <div>
                <label className="label">Margin</label>
                <div className={`input-field font-semibold ${margin(form.purchase_price, form.selling_price) >= 30 ? 'text-green-700' : margin(form.purchase_price, form.selling_price) >= 15 ? 'text-amber-700' : 'text-red-600'}`}>
                  {margin(form.purchase_price, form.selling_price)}% profit
                </div>
              </div>
            )}
            <div>
              <label className="label">Vendor / Supplier</label>
              <input className="input-field" placeholder="Supplier name" value={form.vendor} onChange={e => f('vendor', e.target.value)} />
            </div>
            <div>
              <label className="label">Purchase Date</label>
              <input className="input-field" type="date" value={form.purchase_date} onChange={e => f('purchase_date', e.target.value)} />
            </div>
            <div>
              <label className="label">Low Stock Alert (qty)</label>
              <input className="input-field" type="number" min="0" placeholder="3" value={form.low_stock_threshold} onChange={e => f('low_stock_threshold', e.target.value)} />
            </div>
          </div>

          {/* Multi-size rows */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-semibold text-blue-900">Sizes & Quantities *</div>
                <div className="text-xs text-gray-400">Add one row per size. Same article, different sizes.</div>
              </div>
              <button onClick={addSizeRow} className="btn-secondary btn-sm flex items-center gap-1.5">
                <Plus size={13} /> Add Size
              </button>
            </div>
            {errors.sizes && <p className="text-xs text-red-500 mb-2">{errors.sizes}</p>}
            <div className="space-y-2">
              {sizeRows.map((row, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1">
                    <select
                      className="select-field"
                      value={row.size}
                      onChange={e => updateSizeRow(i, 'size', e.target.value)}
                    >
                      <option value="">Select Size (UK)</option>
                      {UK_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <input
                      className="input-field"
                      type="number"
                      min="0"
                      placeholder="Quantity"
                      value={row.quantity}
                      onChange={e => updateSizeRow(i, 'quantity', e.target.value)}
                    />
                  </div>
                  <button
                    onClick={() => removeSizeRow(i)}
                    disabled={sizeRows.length === 1}
                    className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            {/* Summary */}
            {sizeRows.some(r => r.size && r.quantity > 0) && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg text-xs text-blue-800">
                <strong>Summary:</strong>{' '}
                {sizeRows.filter(r => r.size && r.quantity > 0).map(r => `Size ${r.size} × ${r.quantity}`).join(' · ')}{' '}
                — Total: <strong>{sizeRows.reduce((a, r) => a + (parseInt(r.quantity) || 0), 0)} pairs</strong>
              </div>
            )}
          </div>

          <div>
            <label className="label">Remarks (optional)</label>
            <input className="input-field mb-5" placeholder="Any notes" value={form.remarks} onChange={e => f('remarks', e.target.value)} />
          </div>

          <div className="flex gap-3">
            <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
              {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={15} />}
              {saving ? 'Saving…' : 'Save to Stock'}
            </button>
            <button onClick={() => { setForm(EMPTY_FORM); setSizeRows([{ size: '', quantity: '' }]) }} className="btn-secondary flex items-center gap-2">
              <RefreshCw size={15} /> Clear Form
            </button>
          </div>
        </div>
      )}

      {/* ── VOICE TAB ── */}
      {tab === 'voice' && (
        <div className="card p-6 max-w-xl">
          <div className="section-title">🎤 Voice Stock Entry</div>
          <div className="alert-info mb-5">
            Press the microphone and speak clearly in English or Hindi-English mix.<br />
            <em className="text-blue-700 text-xs">
              Example: "Bata article B-2341 size 8 black colour 12 pairs purchase 450 selling 750 vendor Bata distributor"
            </em>
          </div>
          <div className="text-center py-6">
            <button
              onClick={recording ? stopRec : startRec}
              className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-lg transition-all ${recording ? 'bg-red-500 recording-pulse' : 'bg-blue-900 hover:bg-blue-800'}`}>
              {recording ? <MicOff size={28} className="text-white" /> : <Mic size={28} className="text-white" />}
            </button>
            <div className="mt-3 text-sm text-gray-500">
              {recording
                ? <span className="text-red-500 font-semibold">🔴 Recording… {recSecs}s — tap to stop</span>
                : 'Tap to start recording'}
            </div>
          </div>
          <div className="mb-4">
            <label className="label">Transcript (edit before extracting)</label>
            <textarea className="input-field min-h-[100px] resize-y" value={transcript} onChange={e => setTranscript(e.target.value)} placeholder="Your speech will appear here, or type/paste manually." />
          </div>
          <div className="flex gap-3">
            <button onClick={extractVoice} disabled={extracting || !transcript.trim()} className="btn-primary flex items-center gap-2">
              {extracting ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '🧠'}
              {extracting ? 'Extracting…' : 'Extract with AI'}
            </button>
            <button onClick={() => setTranscript('')} className="btn-secondary">Clear</button>
          </div>
          {extracted && <ReviewTable items={extracted} onChange={updateExtracted} onConfirm={confirmExtracted} onDiscard={() => setExtracted(null)} saving={saving} />}
        </div>
      )}

      {/* ── IMAGE TAB ── */}
      {tab === 'image' && (
        <div className="card p-6 max-w-xl">
          <div className="section-title">📸 Vendor Bill Upload</div>
          <div className="alert-info mb-5">Upload a photo or scan of your vendor bill. AI will extract all stock items automatically.</div>
          <div
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
            onClick={() => document.getElementById('bill-file').click()}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}>
            <Upload size={32} className="mx-auto mb-3 text-gray-300" />
            <div className="text-sm font-semibold text-gray-600">Click or drag vendor bill here</div>
            <div className="text-xs text-gray-400 mt-1">JPG, PNG, PDF · Max 10 MB</div>
            <input type="file" id="bill-file" className="hidden" accept="image/*,.pdf" onChange={e => handleFile(e.target.files[0])} />
          </div>
          {preview && <img src={preview} alt="Preview" className="mt-4 rounded-lg border border-gray-100 max-h-52 object-contain w-full" />}
          {file && !preview && <div className="alert-info mt-4">📄 {file.name}</div>}
          {file && (
            <div className="flex gap-3 mt-4">
              <button onClick={extractImage} disabled={extracting} className="btn-primary flex items-center gap-2">
                {extracting ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '🧠'}
                {extracting ? 'Reading bill with AI…' : 'Extract Stock Data'}
              </button>
              <button onClick={() => { setFile(null); setPreview(null); setExtracted(null) }} className="btn-secondary">Remove</button>
            </div>
          )}
          {extracted && <ReviewTable items={extracted} onChange={updateExtracted} onConfirm={confirmExtracted} onDiscard={() => setExtracted(null)} saving={saving} />}
        </div>
      )}
    </div>
  )
}

function ReviewTable({ items, onChange, onConfirm, onDiscard, saving }) {
  return (
    <div className="mt-6">
      <div className="alert-success mb-3 flex items-center gap-2">
        <CheckCircle size={16} /> AI extracted {items.length} item(s). Review and edit before saving.
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 table-header">
            <tr>{['Brand','Article','Cat','Size','Colour','Qty','Buy ₹','Sell ₹','Vendor'].map(h => (
              <th key={h} className="px-2 py-2 text-left">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {items.map((row, i) => (
              <tr key={i} className="border-t border-gray-50">
                {[['brand','text'],['article_number','text'],['category','cat'],['size','text'],['color','text'],['quantity','num'],['purchase_price','num'],['selling_price','num'],['vendor','text']].map(([k, t]) => (
                  <td key={k} className="px-1 py-1">
                    {t === 'cat'
                      ? <select className="border border-gray-200 rounded px-1 py-1 text-xs w-full" value={row[k] || 'Men'} onChange={e => onChange(i, k, e.target.value)}>
                          {['Men','Women','Kids','Sports','Casual','Formal'].map(c => <option key={c}>{c}</option>)}
                        </select>
                      : <input className="border border-gray-200 rounded px-1.5 py-1 text-xs w-full min-w-[55px]" type={t === 'num' ? 'number' : 'text'} value={row[k] || ''} onChange={e => onChange(i, k, e.target.value)} />
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-3 mt-4">
        <button onClick={onConfirm} disabled={saving} className="btn-success flex items-center gap-2">
          {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle size={15} />}
          {saving ? 'Saving…' : `Confirm & Save ${items.length} Item(s)`}
        </button>
        <button onClick={onDiscard} className="btn-secondary">Discard</button>
      </div>
    </div>
  )
}
