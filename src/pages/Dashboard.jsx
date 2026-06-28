import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { Package, ShoppingBag, TrendingUp, AlertTriangle, ArrowRight } from 'lucide-react'

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/api/reports/dashboard', { params: { period: 'month' } })
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-blue-900 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  // ── Only NON-sensitive stats on dashboard ─────────────────────────────────
  const stats = [
    {
      label: 'Total Stock Units',
      value: (data?.totalStock ?? 0).toLocaleString('en-IN'),
      icon: Package,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      sub: `${data?.productCount ?? 0} product variants`,
    },
    {
      label: "Today's Sales",
      value: `₹${(data?.todayRevenue ?? 0).toLocaleString('en-IN')}`,
      icon: TrendingUp,
      color: 'text-green-600',
      bg: 'bg-green-50',
      sub: `${data?.todayInvoices ?? 0} invoice${data?.todayInvoices !== 1 ? 's' : ''} today`,
    },
    {
      label: 'This Month Sales',
      value: `₹${(data?.monthRevenue ?? 0).toLocaleString('en-IN')}`,
      icon: ShoppingBag,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      sub: `${data?.monthInvoices ?? 0} invoices this month`,
    },
    {
      label: 'Low Stock Items',
      value: data?.lowStockCount ?? 0,
      icon: AlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-50',
      sub: 'Items need reorder',
      alert: (data?.lowStockCount ?? 0) > 0,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold text-blue-900">Good {hour()}, Bhavarlal Ji 🙏</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* KPI Stats — public info only */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className={`stat-card ${s.alert ? 'border-red-200 bg-red-50/30' : ''}`}>
            <div className="flex items-start justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide leading-tight">{s.label}</p>
              <div className={`${s.bg} p-1.5 rounded-lg`}>
                <s.icon size={15} className={s.color} />
              </div>
            </div>
            <div className={`text-2xl font-bold ${s.alert ? 'text-red-600' : 'text-blue-900'}`}>{s.value}</div>
            <div className="text-xs text-gray-400 mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Low stock alert banner */}
      {data?.lowStockItems?.length > 0 && (
        <div className="alert-warn flex items-start gap-3">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-amber-600" />
          <div>
            <strong>Low stock alert — </strong>
            {data.lowStockItems.map(s => `${s.brand} ${s.article_number} (${s.quantity} left)`).join(' · ')}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="card p-5">
          <div className="section-title">⚡ Quick Actions</div>
          <div className="space-y-2">
            {[
              ['/add-stock?tab=manual', '➕', 'Add Stock Manually',  'bg-blue-50   text-blue-800   hover:bg-blue-100'],
              ['/add-stock?tab=voice',  '🎤', 'Voice Stock Entry',   'bg-green-50  text-green-800  hover:bg-green-100'],
              ['/vendor-bills',         '📸', 'Upload Vendor Bill',  'bg-amber-50  text-amber-800  hover:bg-amber-100'],
              ['/billing',              '🧾', 'New Bill / Invoice',  'bg-purple-50 text-purple-800 hover:bg-purple-100'],
              ['/reports',              '📊', 'View Reports',        'bg-slate-50  text-slate-800  hover:bg-slate-100'],
            ].map(([to, icon, label, cls]) => (
              <button
                key={to}
                onClick={() => navigate(to)}
                className={`flex items-center gap-3 w-full p-3 rounded-lg text-sm font-medium transition-colors ${cls}`}
              >
                <span>{icon}</span>
                <span>{label}</span>
                <ArrowRight size={14} className="ml-auto" />
              </button>
            ))}
          </div>
        </div>

        {/* Recent Sales */}
        <div className="card p-5">
          <div className="section-title">🧾 Recent Sales</div>
          {!data?.recentSales?.length ? (
            <p className="text-sm text-gray-400 text-center py-6">No sales recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {data.recentSales.map(s => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <div className="text-sm font-semibold">{s.customer_name || 'Walk-in Customer'}</div>
                    <div className="text-xs text-gray-400">{s.invoice_number} · {s.payment_mode} · {s.sale_date?.split('T')[0]}</div>
                  </div>
                  <div className="text-sm font-bold text-blue-900">
                    ₹{Number(s.total_amount).toLocaleString('en-IN')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stock by Category */}
        <div className="card p-5">
          <div className="section-title">📦 Stock by Category</div>
          {!data?.categoryBreakdown?.length ? (
            <p className="text-sm text-gray-400 text-center py-6">No stock added yet.</p>
          ) : (
            <div className="space-y-3">
              {data.categoryBreakdown.map(c => {
                const pct = data.totalStock > 0 ? Math.round(c.total_qty / data.totalStock * 100) : 0
                return (
                  <div key={c.category}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600 font-medium">{c.category}</span>
                      <span className="font-bold text-blue-900">{c.total_qty} units</span>
                    </div>
                    <div className="bg-gray-100 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
              <div className="pt-2 border-t border-gray-100 text-xs text-gray-400 flex justify-between">
                <span>Total units in stock</span>
                <span className="font-bold text-blue-900">{data.totalStock}</span>
              </div>
            </div>
          )}
          <button
            onClick={() => navigate('/stock')}
            className="mt-4 w-full text-xs text-blue-600 hover:underline text-center"
          >
            View full stock list →
          </button>
        </div>
      </div>

      {/* Low Stock Items Detail */}
      {data?.lowStockItems?.length > 0 && (
        <div className="card p-5">
          <div className="section-title">⚠️ Items Needing Reorder</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-header">
                <tr>
                  <th className="px-3 py-2 text-left">Brand</th>
                  <th className="px-3 py-2 text-left">Article</th>
                  <th className="px-3 py-2 text-left">Size</th>
                  <th className="px-3 py-2 text-left">Colour</th>
                  <th className="px-3 py-2 text-center">Stock Left</th>
                  <th className="px-3 py-2 text-center">Alert At</th>
                </tr>
              </thead>
              <tbody>
                {data.lowStockItems.map(s => (
                  <tr key={s.id} className="border-t border-gray-50 bg-red-50/40">
                    <td className="px-3 py-2.5 font-semibold">{s.brand}</td>
                    <td className="px-3 py-2.5"><span className="badge-blue">{s.article_number}</span></td>
                    <td className="px-3 py-2.5">{s.size}</td>
                    <td className="px-3 py-2.5 text-gray-500">{s.color}</td>
                    <td className="px-3 py-2.5 text-center"><span className="badge-red font-bold">{s.quantity}</span></td>
                    <td className="px-3 py-2.5 text-center text-gray-400">{s.low_stock_threshold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function hour() {
  const h = new Date().getHours()
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
}
