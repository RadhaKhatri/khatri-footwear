import React, { useState, useEffect, useCallback, useRef } from 'react'
import api from '../utils/api'
import {
  Plus, Trash2, Camera, Eye, X, ChevronDown, ChevronUp,
  IndianRupee, TrendingDown, AlertCircle, CheckCircle, Upload
} from 'lucide-react'

function fmt(n) { return Number(n || 0).toLocaleString('en-IN') }
function today() { return new Date().toISOString().split('T')[0] }

// ── Small stat card ────────────────────────────────────────────────────────────
function SummaryCard({ label, value, sub, color = 'text-blue-900', bg = 'bg-white' }) {
  return (
    <div className={`${bg} border border-gray-100 rounded-xl p-4 shadow-sm`}>
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>₹{fmt(value)}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

// ── Bill image viewer modal ────────────────────────────────────────────────────
function ImageModal({ url, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-10 right-0 text-white hover:text-gray-300 flex items-center gap-1 text-sm">
          <X size={18} /> Close
        </button>
        <img src={url} alt="Vendor bill" className="w-full rounded-xl shadow-2xl max-h-[85vh] object-contain bg-white" />
      </div>
    </div>
  )
}

// ── Add Payment modal ──────────────────────────────────────────────────────────
function PaymentModal({ purchase, onClose, onPaid }) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async e => {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { setError('Enter a valid amount.'); return }
    if (amt > parseFloat(purchase.remaining)) {
      setError(`Cannot pay more than remaining ₹${fmt(purchase.remaining)}.`); return
    }
    setSaving(true); setError('')
    try {
      const r = await api.post(`/api/vendor-purchases/${purchase.id}/payments`, {
        amount: amt, payment_date: date, note
      })
      onPaid(r.data)
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record payment.')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-blue-900">Record Payment</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm">
          <div className="font-semibold text-amber-800">{purchase.vendor_name}</div>
          <div className="text-amber-700 mt-1">
            Total Bill: ₹{fmt(purchase.total_amount)} &nbsp;·&nbsp;
            Already Paid: ₹{fmt(purchase.total_paid)} &nbsp;·&nbsp;
            <strong>Still Due: ₹{fmt(purchase.remaining)}</strong>
          </div>
        </div>

        {error && <div className="alert-error mb-4 text-sm">{error}</div>}

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">Amount Being Paid Now (₹)</label>
            <input className="input-field text-lg font-semibold" type="number" min="1" step="1"
              placeholder={`Max ₹${fmt(purchase.remaining)}`}
              value={amount} onChange={e => { setAmount(e.target.value); setError('') }} autoFocus />
          </div>
          <div>
            <label className="label">Payment Date</label>
            <input className="input-field" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Note (optional)</label>
            <input className="input-field" placeholder="e.g. Cash payment, UPI, cheque no." value={note} onChange={e => setNote(e.target.value)} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2 py-2.5">
              {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle size={15} />}
              {saving ? 'Saving…' : 'Record Payment'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary px-4">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Payment history row ────────────────────────────────────────────────────────
function PaymentHistory({ purchaseId, onDelete }) {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/api/vendor-purchases/${purchaseId}/payments`)
      .then(r => setPayments(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [purchaseId])

  if (loading) return <div className="text-xs text-gray-400 py-2">Loading payment history…</div>
  if (!payments.length) return <div className="text-xs text-gray-400 py-2 italic">No additional payments recorded yet.</div>

  return (
    <div className="space-y-1.5">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Payment History</div>
      {payments.map(p => (
        <div key={p.id} className="flex items-center justify-between bg-green-50 border border-green-100 rounded-lg px-3 py-2">
          <div>
            <span className="text-sm font-semibold text-green-700">+₹{fmt(p.amount)} paid</span>
            <span className="text-xs text-gray-400 ml-2">{p.payment_date?.split('T')[0]}</span>
            {p.note && <span className="text-xs text-gray-400 ml-2">— {p.note}</span>}
          </div>
          <button onClick={() => onDelete(p.id)} className="text-gray-300 hover:text-red-500 p-1 ml-2">
            <Trash2 size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Single purchase row (expandable) ──────────────────────────────────────────
function PurchaseRow({ purchase: initialPurchase, onDelete, onUpdate }) {
  const [purchase, setPurchase] = useState(initialPurchase)
  const [expanded, setExpanded] = useState(false)
  const [showImage, setShowImage] = useState(false)
  const [showPayModal, setShowPayModal] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileRef = useRef()

  useEffect(() => { setPurchase(initialPurchase) }, [initialPurchase])

  const remaining = parseFloat(purchase.remaining || 0)
  const totalPaid  = parseFloat(purchase.total_paid || 0)
  const pctPaid    = purchase.total_amount > 0 ? Math.min(100, Math.round(totalPaid / purchase.total_amount * 100)) : 0
  const isFullyPaid = remaining <= 0

  const handleImageUpload = async e => {
    const file = e.target.files[0]
    if (!file) return
    setUploadingImage(true)
    const fd = new FormData(); fd.append('bill_image', file)
    try {
      const r = await api.patch(`/api/vendor-purchases/${purchase.id}/image`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setPurchase(r.data); onUpdate(r.data)
    } catch (err) {
      alert(err.response?.data?.error || 'Image upload failed.')
    }
    setUploadingImage(false)
    fileRef.current.value = ''
  }

  const deletePayment = async paymentId => {
    if (!confirm('Remove this payment entry?')) return
    try {
      const r = await api.delete(`/api/vendor-purchases/payments/${paymentId}`)
      setPurchase(r.data); onUpdate(r.data)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove payment.')
    }
  }

  return (
    <>
      {showImage && <ImageModal url={purchase.bill_image_url} onClose={() => setShowImage(false)} />}
      {showPayModal && (
        <PaymentModal
          purchase={purchase}
          onClose={() => setShowPayModal(false)}
          onPaid={updated => { setPurchase(updated); onUpdate(updated) }}
        />
      )}

      {/* Main row */}
      <tr className={`border-t border-gray-50 hover:bg-gray-50/70 transition-colors ${isFullyPaid ? 'opacity-70' : ''}`}>
        {/* Vendor */}
        <td className="px-3 py-3">
          <div className="font-semibold text-sm text-gray-800">{purchase.vendor_name}</div>
          {purchase.vendor_phone && <div className="text-xs text-gray-400">{purchase.vendor_phone}</div>}
        </td>

        {/* Date */}
        <td className="px-3 py-3 text-sm text-gray-500">{purchase.purchase_date?.split('T')[0]}</td>

        {/* Total Bill */}
        <td className="px-3 py-3 text-right font-bold text-gray-800">₹{fmt(purchase.total_amount)}</td>

        {/* Total Paid */}
        <td className="px-3 py-3 text-right font-semibold text-green-700">₹{fmt(totalPaid)}</td>

        {/* Remaining */}
        <td className="px-3 py-3 text-right">
          {isFullyPaid ? (
            <span className="badge-green font-semibold">✅ Fully Paid</span>
          ) : (
            <span className="font-bold text-red-600">₹{fmt(remaining)}</span>
          )}
        </td>

        {/* Progress bar */}
        <td className="px-3 py-3" style={{ minWidth: '100px' }}>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-100 rounded-full h-2">
              <div className={`h-2 rounded-full transition-all ${isFullyPaid ? 'bg-green-500' : 'bg-amber-500'}`}
                style={{ width: `${pctPaid}%` }} />
            </div>
            <span className="text-xs text-gray-400 flex-shrink-0">{pctPaid}%</span>
          </div>
        </td>

        {/* Bill image */}
        <td className="px-3 py-3 text-center">
          {purchase.bill_image_url ? (
            <button onClick={() => setShowImage(true)} className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium">
              <Eye size={14} /> View Bill
            </button>
          ) : (
            <button onClick={() => fileRef.current.click()}
              disabled={uploadingImage}
              className="inline-flex items-center gap-1 text-gray-400 hover:text-blue-600 text-xs border border-dashed border-gray-300 rounded px-2 py-1 transition-colors">
              {uploadingImage
                ? <span className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin" />
                : <Upload size={12} />}
              {uploadingImage ? 'Uploading…' : 'Add Bill'}
            </button>
          )}
          <input ref={fileRef} type="file" className="hidden" accept="image/*,.pdf" onChange={handleImageUpload} />
        </td>

        {/* Actions */}
        <td className="px-3 py-3">
          <div className="flex items-center gap-1.5">
            {!isFullyPaid && (
              <button onClick={() => setShowPayModal(true)}
                className="btn-primary btn-sm flex items-center gap-1">
                <Plus size={12} /> Pay
              </button>
            )}
            <button onClick={() => setExpanded(e => !e)}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <button onClick={() => onDelete(purchase.id)}
              className="p-1.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500">
              <Trash2 size={14} />
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr>
          <td colSpan="8" className="bg-blue-50/40 border-t border-blue-100 px-6 py-4">
            <div className="grid sm:grid-cols-2 gap-6">
              {/* Notes */}
              <div>
                {purchase.notes && (
                  <div className="mb-3">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</div>
                    <div className="text-sm text-gray-700 bg-white rounded-lg border border-gray-100 p-2.5">{purchase.notes}</div>
                  </div>
                )}
                {/* Bill image replace button */}
                {purchase.bill_image_url && (
                  <button onClick={() => fileRef.current.click()} disabled={uploadingImage}
                    className="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1">
                    <Camera size={12} /> {uploadingImage ? 'Uploading…' : 'Replace bill image'}
                  </button>
                )}
              </div>

              {/* Payment history */}
              <div>
                <PaymentHistory purchaseId={purchase.id} onDelete={deletePayment} key={purchase.total_paid} />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Add New Purchase Modal ─────────────────────────────────────────────────────
function AddPurchaseModal({ vendors, onClose, onAdded }) {
  const [form, setForm] = useState({
    vendor_id: '', purchase_date: today(),
    total_amount: '', paid_amount: '', notes: ''
  })
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleFile = file => {
    setFile(file)
    if (file?.type?.startsWith('image/')) {
      const reader = new FileReader(); reader.onload = e => setPreview(e.target.result); reader.readAsDataURL(file)
    } else setPreview(null)
  }

  const submit = async e => {
    e.preventDefault()
    if (!form.vendor_id) { setError('Please select a vendor.'); return }
    if (!form.total_amount || parseFloat(form.total_amount) <= 0) { setError('Enter the total bill amount.'); return }
    setSaving(true); setError('')
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v) })
      if (file) fd.append('bill_image', file)
      const r = await api.post('/api/vendor-purchases', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      onAdded(r.data)
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add purchase.')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-blue-900">Add New Purchase</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {error && <div className="alert-error mb-4">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Vendor / Supplier <span className="text-red-500">*</span></label>
            <select className="select-field" value={form.vendor_id} onChange={e => f('vendor_id', e.target.value)}>
              <option value="">— Select Vendor —</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}{v.phone ? ` (${v.phone})` : ''}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Purchase Date</label>
              <input className="input-field" type="date" value={form.purchase_date} onChange={e => f('purchase_date', e.target.value)} />
            </div>
            <div>
              <label className="label">Total Bill Amount (₹) <span className="text-red-500">*</span></label>
              <input className="input-field" type="number" min="0" step="1" placeholder="e.g. 10000"
                value={form.total_amount} onChange={e => f('total_amount', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Amount Paid Today (₹)</label>
            <input className="input-field" type="number" min="0" step="1"
              placeholder="Leave 0 if nothing paid yet"
              value={form.paid_amount} onChange={e => f('paid_amount', e.target.value)} />
            {form.total_amount && form.paid_amount && (
              <p className="text-xs mt-1 text-amber-700">
                Remaining: ₹{fmt(Math.max(0, parseFloat(form.total_amount || 0) - parseFloat(form.paid_amount || 0)))}
              </p>
            )}
          </div>

          <div>
            <label className="label">Notes (optional)</label>
            <textarea className="input-field resize-none" rows={2}
              placeholder="e.g. Bata summer collection, 50 pairs, cheque no. 1234"
              value={form.notes} onChange={e => f('notes', e.target.value)} />
          </div>

          {/* Bill image upload */}
          <div>
            <label className="label">Bill / Invoice Image (optional)</label>
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
              onClick={() => document.getElementById('np-file').click()}>
              {preview ? (
                <img src={preview} alt="preview" className="max-h-32 object-contain mx-auto rounded-lg" />
              ) : file ? (
                <div className="text-sm text-blue-700 font-medium">📄 {file.name}</div>
              ) : (
                <div className="text-sm text-gray-400">
                  <Upload size={24} className="mx-auto mb-2 text-gray-300" />
                  Click to attach bill photo or PDF
                </div>
              )}
              <input id="np-file" type="file" className="hidden" accept="image/*,.pdf"
                onChange={e => handleFile(e.target.files[0])} />
            </div>
            {file && (
              <button type="button" onClick={() => { setFile(null); setPreview(null) }}
                className="text-xs text-red-400 hover:text-red-600 mt-1 flex items-center gap-1">
                <X size={11} /> Remove file
              </button>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2 py-3">
              {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Plus size={15} />}
              {saving ? 'Saving…' : 'Add Purchase Entry'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary px-5">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Add Vendor Modal ───────────────────────────────────────────────────────────
function AddVendorModal({ onClose, onAdded }) {
  const [form, setForm] = useState({ name: '', phone: '', address: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async e => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Vendor name is required.'); return }
    setSaving(true)
    try {
      const r = await api.post('/api/vendor-purchases/vendors', form)
      onAdded(r.data); onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add vendor.')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-blue-900">Add New Vendor</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        {error && <div className="alert-error mb-4">{error}</div>}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">Vendor / Company Name <span className="text-red-500">*</span></label>
            <input className="input-field" placeholder="e.g. Bata India Ltd, Paragon Footwear"
              value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus />
          </div>
          <div>
            <label className="label">Phone Number</label>
            <input className="input-field" type="tel" placeholder="Vendor's mobile number"
              value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
          </div>
          <div>
            <label className="label">Address</label>
            <textarea className="input-field resize-none" rows={2} placeholder="Vendor address (optional)"
              value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2 py-2.5">
              {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Plus size={15} />}
              {saving ? 'Saving…' : 'Add Vendor'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary px-4">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function VendorPurchases() {
  const [vendors,        setVendors]        = useState([])
  const [purchases,      setPurchases]      = useState([])
  const [summary,        setSummary]        = useState({})
  const [loading,        setLoading]        = useState(true)
  const [filterVendor,   setFilterVendor]   = useState('')
  const [filterDate,     setFilterDate]     = useState('')
  const [showAddPurchase,setShowAddPurchase] = useState(false)
  const [showAddVendor,  setShowAddVendor]  = useState(false)
  const [activeTab,      setActiveTab]      = useState('purchases') // 'purchases' | 'vendors'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (filterVendor) params.vendor_id = filterVendor
      if (filterDate)   params.date      = filterDate
      const [purchRes, vendRes] = await Promise.all([
        api.get('/api/vendor-purchases', { params }),
        api.get('/api/vendor-purchases/vendors'),
      ])
      setPurchases(purchRes.data.purchases)
      setSummary(purchRes.data.summary)
      setVendors(vendRes.data)
    } catch {}
    setLoading(false)
  }, [filterVendor, filterDate])

  useEffect(() => { load() }, [load])

  const deletePurchase = async id => {
    if (!confirm('Delete this purchase entry? All payment records will also be deleted.')) return
    try { await api.delete(`/api/vendor-purchases/${id}`); load() }
    catch (err) { alert(err.response?.data?.error || 'Failed to delete.') }
  }

  const deleteVendor = async id => {
    if (!confirm('Delete this vendor and all their purchase records?')) return
    try { await api.delete(`/api/vendor-purchases/vendors/${id}`); load() }
    catch (err) { alert(err.response?.data?.error || 'Failed to delete vendor.') }
  }

  const updatePurchase = updated => {
    setPurchases(prev => prev.map(p => p.id === updated.id ? updated : p))
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold text-blue-900">Purchase Ledger</h2>
          <p className="text-sm text-gray-500">Track stock purchases from vendors with partial payment support.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAddVendor(true)} className="btn-secondary flex items-center gap-1.5">
            <Plus size={14} /> Add Vendor
          </button>
          <button onClick={() => setShowAddPurchase(true)} className="btn-primary flex items-center gap-1.5">
            <Plus size={14} /> New Purchase
          </button>
        </div>
      </div>

      {/* Today's Summary */}
      <div className="mb-2 text-xs font-bold text-gray-400 uppercase tracking-widest">Today's Summary</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <SummaryCard label="Today's Purchases" value={summary.today_total ?? 0} sub="Total bill value today" />
        <SummaryCard label="Paid Today" value={summary.today_paid ?? 0} color="text-green-700" sub="Money paid out today" />
        <SummaryCard label="Today's Remaining" value={summary.today_remaining ?? 0} color="text-amber-600" sub="Still to pay from today" />
        <SummaryCard label="Total Outstanding" value={summary.grand_remaining ?? 0}
          color={(summary.grand_remaining ?? 0) > 0 ? 'text-red-600' : 'text-green-700'}
          bg={(summary.grand_remaining ?? 0) > 0 ? 'bg-red-50' : 'bg-green-50'}
          sub="All unpaid dues (all time)" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {[['purchases','📋 All Purchases'],['vendors','🏭 Vendor Accounts']].map(([k, l]) => (
          <button key={k} onClick={() => setActiveTab(k)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${activeTab === k ? 'bg-blue-900 text-white border-blue-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* ── Purchases Tab ── */}
      {activeTab === 'purchases' && (
        <>
          {/* Filters */}
          <div className="flex gap-3 mb-4 flex-wrap">
            <select className="select-field sm:w-48" value={filterVendor} onChange={e => setFilterVendor(e.target.value)}>
              <option value="">All Vendors</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <input className="input-field sm:w-44" type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
            {(filterVendor || filterDate) && (
              <button onClick={() => { setFilterVendor(''); setFilterDate('') }} className="btn-secondary btn-sm">
                Clear Filters
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-blue-900 border-t-transparent rounded-full animate-spin" /></div>
          ) : !purchases.length ? (
            <div className="card p-10 text-center">
              <div className="text-4xl mb-3">📋</div>
              <div className="text-gray-500 font-medium">No purchase entries yet</div>
              <div className="text-sm text-gray-400 mt-1">Click "New Purchase" to add your first vendor purchase.</div>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="table-header">
                    <tr>
                      <th className="px-3 py-3 text-left">Vendor</th>
                      <th className="px-3 py-3 text-left">Date</th>
                      <th className="px-3 py-3 text-right">Total Bill</th>
                      <th className="px-3 py-3 text-right">Total Paid</th>
                      <th className="px-3 py-3 text-right">Remaining</th>
                      <th className="px-3 py-3 text-left">Payment Progress</th>
                      <th className="px-3 py-3 text-center">Bill</th>
                      <th className="px-3 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map(p => (
                      <PurchaseRow
                        key={p.id}
                        purchase={p}
                        onDelete={deletePurchase}
                        onUpdate={updatePurchase}
                      />
                    ))}
                  </tbody>
                  {/* Footer totals */}
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td className="px-3 py-3 font-bold text-gray-600 text-sm" colSpan={2}>
                        Showing {purchases.length} entries
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-gray-800">
                        ₹{fmt(purchases.reduce((a, p) => a + parseFloat(p.total_amount || 0), 0))}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-green-700">
                        ₹{fmt(purchases.reduce((a, p) => a + parseFloat(p.total_paid || 0), 0))}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-red-600">
                        ₹{fmt(purchases.reduce((a, p) => a + Math.max(0, parseFloat(p.remaining || 0)), 0))}
                      </td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Vendors Tab ── */}
      {activeTab === 'vendors' && (
        loading ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-blue-900 border-t-transparent rounded-full animate-spin" /></div>
        ) : !vendors.length ? (
          <div className="card p-10 text-center">
            <div className="text-4xl mb-3">🏭</div>
            <div className="text-gray-500 font-medium">No vendors added yet</div>
            <div className="text-sm text-gray-400 mt-1">Add your first vendor to start tracking purchases.</div>
            <button onClick={() => setShowAddVendor(true)} className="btn-primary mt-4 inline-flex items-center gap-2">
              <Plus size={14} /> Add First Vendor
            </button>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="table-header">
                  <tr>
                    <th className="px-3 py-3 text-left">Vendor Name</th>
                    <th className="px-3 py-3 text-left">Phone</th>
                    <th className="px-3 py-3 text-center">Purchases</th>
                    <th className="px-3 py-3 text-right">Total Purchased</th>
                    <th className="px-3 py-3 text-right">Total Paid</th>
                    <th className="px-3 py-3 text-right">Outstanding Dues</th>
                    <th className="px-3 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map(v => {
                    const rem = parseFloat(v.total_remaining || 0)
                    return (
                      <tr key={v.id} className="border-t border-gray-50 hover:bg-gray-50">
                        <td className="px-3 py-3 font-semibold">{v.name}</td>
                        <td className="px-3 py-3 text-gray-500">{v.phone || '—'}</td>
                        <td className="px-3 py-3 text-center">
                          <span className="badge-blue">{v.purchase_count}</span>
                        </td>
                        <td className="px-3 py-3 text-right font-medium">₹{fmt(v.total_purchased)}</td>
                        <td className="px-3 py-3 text-right text-green-700 font-medium">₹{fmt(v.total_paid)}</td>
                        <td className="px-3 py-3 text-right">
                          {rem > 0
                            ? <span className="font-bold text-red-600">₹{fmt(rem)}</span>
                            : <span className="badge-green">✅ Clear</span>}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => { setFilterVendor(String(v.id)); setActiveTab('purchases') }}
                              className="btn-secondary btn-sm">View Purchases</button>
                            <button onClick={() => deleteVendor(v.id)}
                              className="p-1.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Modals */}
      {showAddVendor && (
        <AddVendorModal
          onClose={() => setShowAddVendor(false)}
          onAdded={v => { setVendors(prev => [v, ...prev]); load() }}
        />
      )}
      {showAddPurchase && (
        <AddPurchaseModal
          vendors={vendors}
          onClose={() => setShowAddPurchase(false)}
          onAdded={p => { setPurchases(prev => [p, ...prev]); load() }}
        />
      )}
    </div>
  )
}
