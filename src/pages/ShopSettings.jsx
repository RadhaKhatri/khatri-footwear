import React, { useEffect, useState } from 'react'
import api from '../utils/api'
import { Save, CheckCircle } from 'lucide-react'

export default function ShopSettings() {
  const [form, setForm] = useState({
    shop_name: '', owner_name: '', address: '', phone: '',
    gstin: '', invoice_prefix: 'KF', default_tax_pct: 0,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/api/shop-settings')
      .then(r => setForm({
        shop_name:       r.data.shop_name       || '',
        owner_name:      r.data.owner_name      || '',
        address:         r.data.address         || '',
        phone:           r.data.phone           || '',
        gstin:           r.data.gstin           || '',
        invoice_prefix:  r.data.invoice_prefix  || 'KF',
        default_tax_pct: r.data.default_tax_pct || 0,
      }))
      .catch(() => setError('Failed to load settings.'))
      .finally(() => setLoading(false))
  }, [])

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const save = async e => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      await api.patch('/api/shop-settings', form)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save settings.')
    }
    setSaving(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-2 border-blue-900 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-2xl">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-blue-900">Shop Settings</h2>
        <p className="text-sm text-gray-500">Update your shop information, invoice prefix and tax defaults.</p>
      </div>

      {error && <div className="alert-error mb-5">{error}</div>}
      {saved && (
        <div className="alert-success mb-5 flex items-center gap-2">
          <CheckCircle size={16} /> Settings saved successfully!
        </div>
      )}

      <form onSubmit={save} className="space-y-5">
        <div className="card p-6">
          <div className="section-title">🏪 Shop Information</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Shop Name</label>
              <input className="input-field" value={form.shop_name} onChange={e => f('shop_name', e.target.value)} required />
            </div>
            <div>
              <label className="label">Owner Name</label>
              <input className="input-field" value={form.owner_name} onChange={e => f('owner_name', e.target.value)} required />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Shop Address</label>
              <textarea className="input-field resize-none" rows={2} value={form.address} onChange={e => f('address', e.target.value)} placeholder="Full shop address" />
            </div>
            <div>
              <label className="label">Phone Number</label>
              <input className="input-field" type="tel" value={form.phone} onChange={e => f('phone', e.target.value)} placeholder="+91 XXXXX XXXXX" />
            </div>
            <div>
              <label className="label">GSTIN (optional)</label>
              <input className="input-field" value={form.gstin} onChange={e => f('gstin', e.target.value)} placeholder="27XXXXXXXXXXXXX" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="section-title">🧾 Invoice & Billing Defaults</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Invoice Prefix</label>
              <input className="input-field" value={form.invoice_prefix} onChange={e => f('invoice_prefix', e.target.value)} placeholder="KF" maxLength={5} />
              <p className="text-xs text-gray-400 mt-1">Invoices will be numbered: {form.invoice_prefix || 'KF'}-0001, {form.invoice_prefix || 'KF'}-0002…</p>
            </div>
            <div>
              <label className="label">Default Tax / GST (%)</label>
              <input className="input-field" type="number" min="0" max="100" step="0.5" value={form.default_tax_pct} onChange={e => f('default_tax_pct', e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">Applied by default on new bills. Can be overridden per bill.</p>
            </div>
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 py-2.5 px-6">
          {saving
            ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <Save size={15} />}
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </form>
    </div>
  )
}
