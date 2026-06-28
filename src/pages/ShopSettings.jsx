import React, { useEffect, useState } from 'react'
import api from '../utils/api'
import { Save, CheckCircle, Eye, EyeOff, ShieldCheck, Lock } from 'lucide-react'

export default function ShopSettings() {
  const [form, setForm] = useState({
    shop_name: '', owner_name: '', address: '', phone: '',
    gstin: '', invoice_prefix: 'KF', default_tax_pct: 0,
    report_password: '', report_password_confirm: '',
  })
  const [hasReportPassword, setHasReportPassword] = useState(false)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState('')
  const [showPwd, setShowPwd]   = useState(false)

  useEffect(() => {
    api.get('/api/shop-settings')
      .then(r => {
        setForm(prev => ({
          ...prev,
          shop_name:       r.data.shop_name       || '',
          owner_name:      r.data.owner_name      || '',
          address:         r.data.address         || '',
          phone:           r.data.phone           || '',
          gstin:           r.data.gstin           || '',
          invoice_prefix:  r.data.invoice_prefix  || 'KF',
          default_tax_pct: r.data.default_tax_pct || 0,
        }))
        setHasReportPassword(!!r.data.has_report_password)
      })
      .catch(() => setError('Failed to load settings.'))
      .finally(() => setLoading(false))
  }, [])

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const save = async e => {
    e.preventDefault()
    setError('')

    // Validate report password if provided
    if (form.report_password.trim()) {
      if (form.report_password.trim().length < 4) {
        setError('Report password must be at least 4 characters.')
        return
      }
      if (form.report_password !== form.report_password_confirm) {
        setError('Report passwords do not match.')
        return
      }
    }

    setSaving(true)
    try {
      const payload = {
        shop_name:       form.shop_name,
        owner_name:      form.owner_name,
        address:         form.address,
        phone:           form.phone,
        gstin:           form.gstin,
        invoice_prefix:  form.invoice_prefix,
        default_tax_pct: form.default_tax_pct,
      }
      if (form.report_password.trim()) {
        payload.report_password = form.report_password.trim()
      }

      const r = await api.patch('/api/shop-settings', payload)
      setHasReportPassword(!!r.data.has_report_password)
      setForm(prev => ({ ...prev, report_password: '', report_password_confirm: '' }))
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
        <p className="text-sm text-gray-500">Update shop information, invoice settings, and security options.</p>
      </div>

      {error && <div className="alert-error mb-5">{error}</div>}
      {saved && (
        <div className="alert-success mb-5 flex items-center gap-2">
          <CheckCircle size={16} /> Settings saved successfully!
        </div>
      )}

      <form onSubmit={save} className="space-y-5">
        {/* Shop Info */}
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
              <input className="input-field" type="tel" value={form.phone} onChange={e => f('phone', e.target.value)} placeholder="e.g. 8412890197" />
            </div>
            <div>
              <label className="label">GSTIN (optional)</label>
              <input className="input-field" value={form.gstin} onChange={e => f('gstin', e.target.value)} placeholder="27XXXXXXXXXXXXX" />
            </div>
          </div>
        </div>

        {/* Invoice Settings */}
        <div className="card p-6">
          <div className="section-title">🧾 Invoice & Billing Defaults</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Invoice Prefix</label>
              <input className="input-field" value={form.invoice_prefix} onChange={e => f('invoice_prefix', e.target.value)} placeholder="KF" maxLength={5} />
              <p className="text-xs text-gray-400 mt-1">
                Invoices: {form.invoice_prefix || 'KF'}-0001, {form.invoice_prefix || 'KF'}-0002…
              </p>
            </div>
            <div>
              <label className="label">Default Tax / GST (%)</label>
              <input className="input-field" type="number" min="0" max="100" step="0.5" value={form.default_tax_pct} onChange={e => f('default_tax_pct', e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">Applied by default on new bills.</p>
            </div>
          </div>
        </div>

        {/* Report Password */}
        <div className="card p-6">
          <div className="section-title"><Lock size={15} /> Reports Security</div>

          {hasReportPassword ? (
            <div className="alert-success mb-4 flex items-center gap-2">
              <ShieldCheck size={16} /> Report password is set. Reports page is protected.
            </div>
          ) : (
            <div className="alert-warn mb-4">
              ⚠️ No report password set. Anyone logged in can view financial reports. Set a password below to protect sensitive data.
            </div>
          )}

          <p className="text-sm text-gray-500 mb-4">
            The <strong>Report Password</strong> is separate from your login password.
            You will need to enter it every time you open the Reports page.
            This protects profit, loss, and inventory cost data from being seen by others.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">{hasReportPassword ? 'New Report Password' : 'Set Report Password'}</label>
              <div className="relative">
                <input
                  className="input-field pr-10"
                  type={showPwd ? 'text' : 'password'}
                  placeholder={hasReportPassword ? 'Enter new password to change' : 'Min 4 characters'}
                  value={form.report_password}
                  onChange={e => f('report_password', e.target.value)}
                />
                <button type="button" onClick={() => setShowPwd(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Confirm Report Password</label>
              <input
                className="input-field"
                type={showPwd ? 'text' : 'password'}
                placeholder="Re-enter password"
                value={form.report_password_confirm}
                onChange={e => f('report_password_confirm', e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Leave both fields empty to keep the existing password unchanged.
          </p>
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
