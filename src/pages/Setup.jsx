import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'

export default function Setup() {
  const [form, setForm] = useState({ username: '', password: '', confirm: '', shopName: 'Khatri Footwear', ownerName: 'Bhavarlal Khatri', phone: '', address: '', gstin: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setSetupRequired } = useAuth()
  const navigate = useNavigate()

  const handle = async e => {
    e.preventDefault()
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true); setError('')
    try {
      await api.post('/api/auth/setup', form)
      setSetupRequired(false)
      navigate('/login')
    } catch (err) {
      setError(err.response?.data?.error || 'Setup failed. Please try again.')
    } finally { setLoading(false) }
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8">
        <div className="text-center mb-7">
          <div className="text-5xl mb-3">👟</div>
          <h1 className="text-2xl font-bold text-blue-900">Welcome to Khatri Footwear</h1>
          <p className="text-gray-500 text-sm mt-1">First-time setup — create your owner account</p>
        </div>

        {error && <div className="alert-error mb-5">{error}</div>}

        <form onSubmit={handle} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Shop Name</label><input className="input-field" value={form.shopName} onChange={e => f('shopName', e.target.value)} required /></div>
            <div><label className="label">Owner Name</label><input className="input-field" value={form.ownerName} onChange={e => f('ownerName', e.target.value)} required /></div>
          </div>
          <div><label className="label">Shop Address</label><input className="input-field" placeholder="Main Market, Sholapur, Maharashtra" value={form.address} onChange={e => f('address', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Phone</label><input className="input-field" type="tel" value={form.phone} onChange={e => f('phone', e.target.value)} /></div>
            <div><label className="label">GSTIN (optional)</label><input className="input-field" placeholder="27XXXXX..." value={form.gstin} onChange={e => f('gstin', e.target.value)} /></div>
          </div>
          <hr className="border-gray-100" />
          <div><label className="label required">Login Username</label><input className="input-field" value={form.username} onChange={e => f('username', e.target.value)} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label required">Password</label><input className="input-field" type="password" value={form.password} onChange={e => f('password', e.target.value)} required /></div>
            <div><label className="label required">Confirm Password</label><input className="input-field" type="password" value={form.confirm} onChange={e => f('confirm', e.target.value)} required /></div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 mt-2 flex items-center gap-2">
            {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '🚀'}
            {loading ? 'Setting up...' : 'Complete Setup & Go to Login'}
          </button>
        </form>
      </div>
    </div>
  )
}
