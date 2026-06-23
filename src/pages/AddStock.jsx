import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { Mic, MicOff, Upload, Save, RefreshCw, CheckCircle, Edit3 } from 'lucide-react'

const CATS = ['Men', 'Women', 'Kids', 'Sports', 'Casual', 'Formal']
const EMPTY = { brand: '', article_number: '', category: 'Men', size: '', color: '', quantity: '', purchase_price: '', selling_price: '', vendor: '', purchase_date: new Date().toISOString().split('T')[0], low_stock_threshold: 3, remarks: '' }

export default function AddStock() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState(params.get('tab') || 'manual')
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
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

  const validate = () => {
    const e = {}
    if (!form.brand.trim()) e.brand = 'Required'
    if (!form.article_number.trim()) e.article_number = 'Required'
    if (!form.size.trim()) e.size = 'Required'
    if (!form.color.trim()) e.color = 'Required'
    if (!form.quantity || form.quantity < 0) e.quantity = 'Required'
    if (!form.purchase_price || form.purchase_price <= 0) e.purchase_price = 'Required'
    if (!form.selling_price || form.selling_price <= 0) e.selling_price = 'Required'
    setErrors(e)
    return !Object.keys(e).length
  }

  const save = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      await api.post('/api/products', form)
      setSuccess(true)
      setForm(EMPTY)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save stock.')
    } finally { setSaving(false) }
  }

  // Voice
  const startRec = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert('Speech recognition not available. Please use Chrome or Edge browser.'); return }
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
    } catch { alert('AI extraction failed. Please fill manually.') }
    setExtracting(false)
  }

  // Image
  const handleFile = f => {
    setFile(f)
    if (f?.type?.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = e => setPreview(e.target.result)
      reader.readAsDataURL(f)
    } else { setPreview(null) }
  }

  const extractImage = async () => {
    if (!file) return
    setExtracting(true)
    const fd = new FormData(); fd.append('bill', file)
    try {
      const r = await api.post('/api/vendor-bills/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setExtracted(Array.isArray(r.data.items) ? r.data.items : [r.data.items])
    } catch { alert('Extraction failed. Please fill manually.') }
    setExtracting(false)
  }

  const confirmExtracted = async () => {
    setSaving(true)
    try {
      for (const item of extracted) await api.post('/api/products', item)
      setExtracted(null); setFile(null); setPreview(null); setTranscript('')
      setSuccess(true); setTimeout(() => { setSuccess(false); navigate('/stock') }, 2000)
    } catch { alert('Failed to save extracted items.') }
    setSaving(false)
  }

  const updateExtracted = (i, k, v) => {
    setExtracted(prev => prev.map((row, idx) => idx === i ? { ...row, [k]: v } : row))
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-blue-900">Add Stock</h2>
        <p className="text-sm text-gray-500 mt-0.5">Enter new footwear stock via typing, voice, or vendor bill image.</p>
      </div>

      {success && <div className="alert-success mb-5 flex items-center gap-2"><CheckCircle size={16} /> Stock saved successfully!</div>}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[['manual','✍️ Manual Entry'],['voice','🎤 Voice Entry'],['image','📸 Bill Image']].map(([k,label]) => (
          <button key={k} onClick={() => { setTab(k); setExtracted(null) }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${tab===k ? 'bg-blue-900 text-white border-blue-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Manual */}
      {tab === 'manual' && (
        <div className="card p-6">
          <div className="section-title">📦 Stock Entry Form</div>
          <div className="alert-info mb-5">All fields marked <span className="text-red-500 font-bold">*</span> are required.</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
            {[
              ['Brand *','brand','text','e.g. Bata, Nike, Liberty'],
              ['Article Number *','article_number','text','e.g. B-2341'],
              ['Size (UK) *','size','text','e.g. 7, 8, 9'],
              ['Colour *','color','text','e.g. Black, White/Blue'],
            ].map(([label, key, type, ph]) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input className={`input-field ${errors[key] ? 'border-red-400' : ''}`} type={type} placeholder={ph} value={form[key]} onChange={e => f(key, e.target.value)} />
                {errors[key] && <p className="text-xs text-red-500 mt-1">{errors[key]}</p>}
              </div>
            ))}
            <div>
              <label className="label">Category</label>
              <select className="select-field" value={form.category} onChange={e => f('category', e.target.value)}>
                {CATS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Quantity *</label>
              <input className={`input-field ${errors.quantity ? 'border-red-400' : ''}`} type="number" min="0" placeholder="0" value={form.quantity} onChange={e => f('quantity', e.target.value)} />
              {errors.quantity && <p className="text-xs text-red-500 mt-1">{errors.quantity}</p>}
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
                <div className={`input-field font-semibold ${profitColor(form.purchase_price, form.selling_price)}`}>
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
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="label">Remarks (optional)</label>
              <input className="input-field" placeholder="Any notes about this stock item" value={form.remarks} onChange={e => f('remarks', e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
              {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={15} />}
              {saving ? 'Saving...' : 'Save to Stock'}
            </button>
            <button onClick={() => setForm(EMPTY)} className="btn-secondary flex items-center gap-2"><RefreshCw size={15} /> Clear Form</button>
          </div>
        </div>
      )}

      {/* Voice */}
      {tab === 'voice' && (
        <div className="card p-6 max-w-xl">
          <div className="section-title">🎤 Voice Stock Entry</div>
          <div className="alert-info mb-5">
            Press the microphone and speak clearly. Example:<br />
            <em className="text-blue-700">"Bata article B-2341 size 8 black colour quantity 12 purchase price 450 selling price 750 vendor Bata distributor"</em>
          </div>
          <div className="text-center py-6">
            <button
              onClick={recording ? stopRec : startRec}
              className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto transition-all shadow-lg ${recording ? 'bg-red-500 recording-pulse' : 'bg-blue-900 hover:bg-blue-800'}`}>
              {recording ? <MicOff size={28} className="text-white" /> : <Mic size={28} className="text-white" />}
            </button>
            <div className="mt-3 text-sm text-gray-500">
              {recording ? <span className="text-red-500 font-semibold">🔴 Recording... {recSecs}s — tap to stop</span> : 'Tap to start recording'}
            </div>
          </div>
          <div>
            <label className="label">Transcript (you can edit before extracting)</label>
            <textarea className="input-field min-h-[100px] resize-y" value={transcript} onChange={e => setTranscript(e.target.value)} placeholder="Your speech will appear here. You can also type or paste text." />
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={extractVoice} disabled={extracting || !transcript.trim()} className="btn-primary flex items-center gap-2">
              {extracting ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '🧠'}
              {extracting ? 'Extracting...' : 'Extract with AI'}
            </button>
            <button onClick={() => setTranscript('')} className="btn-secondary">Clear</button>
          </div>
          {extracted && <ReviewTable items={extracted} onChange={updateExtracted} onConfirm={confirmExtracted} onDiscard={() => setExtracted(null)} saving={saving} />}
        </div>
      )}

      {/* Image */}
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
            <div className="text-xs text-gray-400 mt-1">Supports JPG, PNG, PDF</div>
            <input type="file" id="bill-file" className="hidden" accept="image/*,.pdf" onChange={e => handleFile(e.target.files[0])} />
          </div>
          {preview && <img src={preview} alt="Preview" className="mt-4 rounded-lg max-h-48 object-contain border border-gray-100 w-full" />}
          {file && !preview && <div className="alert-info mt-4">📄 {file.name}</div>}
          {file && (
            <div className="flex gap-3 mt-4">
              <button onClick={extractImage} disabled={extracting} className="btn-primary flex items-center gap-2">
                {extracting ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '🧠'}
                {extracting ? 'Extracting stock data...' : 'Extract with AI'}
              </button>
              <button onClick={() => { setFile(null); setPreview(null) }} className="btn-secondary">Remove</button>
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
      <div className="alert-success mb-4 flex items-center gap-2"><CheckCircle size={16} /> AI extracted {items.length} item(s). Review and edit before saving.</div>
      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 table-header">
            <tr>{['Brand','Article','Cat','Size','Colour','Qty','Purchase ₹','Selling ₹','Vendor'].map(h => <th key={h} className="px-2 py-2 text-left">{h}</th>)}</tr>
          </thead>
          <tbody>
            {items.map((row, i) => (
              <tr key={i} className="border-t border-gray-50">
                {[['brand','text'],['article_number','text'],['category','cat'],['size','text'],['color','text'],['quantity','num'],['purchase_price','num'],['selling_price','num'],['vendor','text']].map(([k, type]) => (
                  <td key={k} className="px-1 py-1">
                    {type === 'cat'
                      ? <select className="border border-gray-200 rounded px-1 py-1 text-xs w-full" value={row[k]||'Men'} onChange={e => onChange(i,k,e.target.value)}>
                          {['Men','Women','Kids','Sports','Casual','Formal'].map(c=><option key={c}>{c}</option>)}
                        </select>
                      : <input className="border border-gray-200 rounded px-1.5 py-1 text-xs w-full min-w-[60px]" type={type==='num'?'number':'text'} value={row[k]||''} onChange={e => onChange(i,k,e.target.value)} />
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
          {saving ? 'Saving...' : 'Confirm & Save All'}
        </button>
        <button onClick={onDiscard} className="btn-secondary">Discard</button>
      </div>
    </div>
  )
}

function margin(pp, sp) { return sp > 0 ? Math.round((sp - pp) / sp * 100) : 0 }
function profitColor(pp, sp) { const m = margin(pp, sp); return m >= 30 ? 'text-green-700' : m >= 15 ? 'text-amber-700' : 'text-red-600' }
