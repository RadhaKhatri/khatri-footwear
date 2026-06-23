import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { Package, ShoppingBag, TrendingUp, AlertTriangle, Plus, Mic, Upload, ArrowRight } from 'lucide-react'

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/api/reports/dashboard')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-blue-900 border-t-transparent rounded-full animate-spin" /></div>

  const stats = [
    { label: 'Total Stock Units', value: data?.totalStock ?? 0, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50', sub: `${data?.productCount ?? 0} products` },
    { label: 'Inventory Value', value: `₹${(data?.inventoryValue ?? 0).toLocaleString('en-IN')}`, icon: ShoppingBag, color: 'text-purple-600', bg: 'bg-purple-50', sub: 'Purchase cost' },
    { label: "Today's Revenue", value: `₹${(data?.todayRevenue ?? 0).toLocaleString('en-IN')}`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50', sub: `${data?.todayInvoices ?? 0} invoices` },
    { label: 'Low Stock Items', value: data?.lowStockCount ?? 0, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', sub: 'Need reorder', alert: (data?.lowStockCount ?? 0) > 0 },
  ]

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold text-blue-900">Good {hour()}, Bhavarlal Ji 🙏</h1>
        <p className="text-sm text-gray-500 mt-0.5">Here is your shop overview for today.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className={`stat-card ${s.alert ? 'border-red-200' : ''}`}>
            <div className="flex items-start justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{s.label}</p>
              <div className={`${s.bg} p-1.5 rounded-lg`}><s.icon size={15} className={s.color} /></div>
            </div>
            <div className={`text-2xl font-bold ${s.alert ? 'text-red-600' : 'text-blue-900'}`}>{s.value}</div>
            <div className="text-xs text-gray-400 mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Low stock alert */}
      {data?.lowStockItems?.length > 0 && (
        <div className="alert-warn flex items-start gap-3">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <div>
            <strong>Low stock alert:</strong>{' '}
            {data.lowStockItems.map(s => `${s.brand} ${s.article_number} (${s.quantity} left)`).join(' · ')}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Quick actions */}
        <div className="card p-5">
          <div className="section-title">⚡ Quick Actions</div>
          <div className="space-y-2">
            <button onClick={() => navigate('/add-stock?tab=manual')} className="flex items-center gap-3 w-full p-3 bg-blue-50 hover:bg-blue-100 rounded-lg text-sm font-medium text-blue-800 transition-colors">
              <Plus size={16} /><span>Add Stock Manually</span><ArrowRight size={14} className="ml-auto" />
            </button>
            <button onClick={() => navigate('/add-stock?tab=voice')} className="flex items-center gap-3 w-full p-3 bg-green-50 hover:bg-green-100 rounded-lg text-sm font-medium text-green-800 transition-colors">
              <Mic size={16} /><span>Voice Stock Entry</span><ArrowRight size={14} className="ml-auto" />
            </button>
            <button onClick={() => navigate('/vendor-bills')} className="flex items-center gap-3 w-full p-3 bg-amber-50 hover:bg-amber-100 rounded-lg text-sm font-medium text-amber-800 transition-colors">
              <Upload size={16} /><span>Upload Vendor Bill</span><ArrowRight size={14} className="ml-auto" />
            </button>
            <button onClick={() => navigate('/billing')} className="flex items-center gap-3 w-full p-3 bg-purple-50 hover:bg-purple-100 rounded-lg text-sm font-medium text-purple-800 transition-colors">
              <ShoppingBag size={16} /><span>New Bill / Invoice</span><ArrowRight size={14} className="ml-auto" />
            </button>
          </div>
        </div>

        {/* Recent sales */}
        <div className="card p-5">
          <div className="section-title">🧾 Recent Sales</div>
          {!data?.recentSales?.length
            ? <p className="text-sm text-gray-400 text-center py-6">No sales recorded yet.</p>
            : <div className="space-y-3">
                {data.recentSales.map(s => (
                  <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <div className="text-sm font-semibold text-gray-800">{s.customer_name || 'Walk-in Customer'}</div>
                      <div className="text-xs text-gray-400">{s.invoice_number} · {s.payment_mode}</div>
                    </div>
                    <div className="text-sm font-bold text-blue-900">₹{Number(s.total_amount).toLocaleString('en-IN')}</div>
                  </div>
                ))}
              </div>
          }
        </div>

        {/* Monthly revenue */}
        <div className="card p-5">
          <div className="section-title">📊 This Month</div>
          <div className="mb-4">
            <div className="text-3xl font-bold text-blue-900">₹{(data?.monthRevenue ?? 0).toLocaleString('en-IN')}</div>
            <div className="text-xs text-gray-400 mt-1">{data?.monthInvoices ?? 0} invoices · {new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</div>
          </div>
          {data?.categoryBreakdown?.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Stock by Category</div>
              {data.categoryBreakdown.map(c => {
                const pct = data.totalStock > 0 ? Math.round(c.total_qty / data.totalStock * 100) : 0
                return (
                  <div key={c.category}>
                    <div className="flex justify-between text-xs mb-1"><span className="text-gray-500">{c.category}</span><span className="font-semibold">{c.total_qty}</span></div>
                    <div className="bg-gray-100 rounded-full h-1.5"><div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${pct}%` }} /></div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function hour() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
