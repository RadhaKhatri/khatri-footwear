import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { Package, ShoppingBag, TrendingUp, AlertTriangle, Plus, Mic, Upload, ArrowRight, TrendingDown } from 'lucide-react'

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

  const pl = data?.pl || {}
  const todayProfit = pl.today?.profit ?? 0
  const monthProfit = pl.month?.profit ?? 0
  const yearProfit = pl.year?.profit ?? 0

  const stats = [
    { label: 'Total Stock Units', value: data?.totalStock ?? 0, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50', sub: `${data?.productCount ?? 0} products` },
    { label: 'Inventory Value', value: `₹${(data?.inventoryValue ?? 0).toLocaleString('en-IN')}`, icon: ShoppingBag, color: 'text-purple-600', bg: 'bg-purple-50', sub: 'Purchase cost' },
    { label: "Today's Revenue", value: `₹${(data?.todayRevenue ?? 0).toLocaleString('en-IN')}`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50', sub: `${data?.todayInvoices ?? 0} invoices` },
    { label: 'Low Stock Items', value: data?.lowStockCount ?? 0, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', sub: 'Need reorder', alert: (data?.lowStockCount ?? 0) > 0 },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-blue-900">Good {hour()}, Bhavarlal Ji 🙏</h1>
        <p className="text-sm text-gray-500 mt-0.5">Here is your shop overview for today.</p>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className={`stat-card ${s.alert ? 'border-red-200' : ''}`}>
            <div className="flex items-start justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide leading-tight">{s.label}</p>
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
          <div><strong>Low stock alert:</strong>{' '}
            {data.lowStockItems.map(s => `${s.brand} ${s.article_number} (${s.quantity} left)`).join(' · ')}
          </div>
        </div>
      )}

      {/* ── PROFIT & LOSS SECTION ─────────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="section-title mb-0">📊 Profit & Loss Summary</div>
          <button onClick={() => navigate('/reports')} className="text-xs text-blue-600 hover:underline">View detailed report →</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {[
            { label: "Today's Profit", value: todayProfit, cost: pl.today?.cost ?? 0, revenue: pl.today?.revenue ?? 0 },
            { label: "This Month's Profit", value: monthProfit, cost: pl.month?.cost ?? 0, revenue: pl.month?.revenue ?? 0 },
            { label: "This Year's Profit", value: yearProfit, cost: pl.year?.cost ?? 0, revenue: pl.year?.revenue ?? 0 },
          ].map(({ label, value, cost, revenue }) => {
            const isProfit = value >= 0
            return (
              <div key={label} className={`rounded-xl p-4 border ${isProfit ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">{label}</div>
                <div className={`text-2xl font-bold ${isProfit ? 'text-green-700' : 'text-red-600'} flex items-center gap-1`}>
                  {isProfit ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                  {isProfit ? '+' : ''}₹{Math.abs(value).toLocaleString('en-IN')}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Revenue ₹{revenue.toLocaleString('en-IN')} · Cost ₹{cost.toLocaleString('en-IN')}
                </div>
              </div>
            )
          })}
        </div>

        {/* Product-wise P&L table */}
        {pl.products?.length > 0 && (
          <>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Top Products — This Month</div>
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 table-header">
                  <tr>
                    <th className="px-3 py-2 text-left">Brand / Article</th>
                    <th className="px-3 py-2 text-center">Size</th>
                    <th className="px-3 py-2 text-center">Sold</th>
                    <th className="px-3 py-2 text-right">Revenue</th>
                    <th className="px-3 py-2 text-right">Cost</th>
                    <th className="px-3 py-2 text-right">Profit</th>
                    <th className="px-3 py-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pl.products.slice(0, 8).map((p, i) => (
                    <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <span className="font-semibold">{p.brand}</span>
                        <span className="text-gray-400 ml-1">{p.article_number}</span>
                        <span className="text-gray-400 ml-1">({p.color})</span>
                      </td>
                      <td className="px-3 py-2 text-center">{p.size}</td>
                      <td className="px-3 py-2 text-center font-bold">{p.units_sold}</td>
                      <td className="px-3 py-2 text-right">₹{p.revenue.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-2 text-right text-red-500">₹{p.cost.toLocaleString('en-IN')}</td>
                      <td className={`px-3 py-2 text-right font-bold ${p.profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                        {p.profit >= 0 ? '+' : ''}₹{p.profit.toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={p.profit >= 0 ? 'badge-green' : 'badge-red'}>
                          {p.profit >= 0 ? '▲ Profit' : '▼ Loss'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {(!pl.products || !pl.products.length) && (
          <p className="text-sm text-gray-400 text-center py-4">No sales data yet. Start billing to see profit & loss.</p>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Quick actions */}
        <div className="card p-5">
          <div className="section-title">⚡ Quick Actions</div>
          <div className="space-y-2">
            {[
              ['/add-stock?tab=manual', '➕', 'Add Stock Manually', 'bg-blue-50 text-blue-800 hover:bg-blue-100'],
              ['/add-stock?tab=voice', '🎤', 'Voice Stock Entry', 'bg-green-50 text-green-800 hover:bg-green-100'],
              ['/vendor-bills', '📸', 'Upload Vendor Bill', 'bg-amber-50 text-amber-800 hover:bg-amber-100'],
              ['/billing', '🧾', 'New Bill / Invoice', 'bg-purple-50 text-purple-800 hover:bg-purple-100'],
            ].map(([to, icon, label, cls]) => (
              <button key={to} onClick={() => navigate(to)}
                className={`flex items-center gap-3 w-full p-3 rounded-lg text-sm font-medium transition-colors ${cls}`}>
                <span>{icon}</span><span>{label}</span><ArrowRight size={14} className="ml-auto" />
              </button>
            ))}
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
                      <div className="text-sm font-semibold">{s.customer_name || 'Walk-in Customer'}</div>
                      <div className="text-xs text-gray-400">{s.invoice_number} · {s.payment_mode}</div>
                    </div>
                    <div className="text-sm font-bold text-blue-900">₹{Number(s.total_amount).toLocaleString('en-IN')}</div>
                  </div>
                ))}
              </div>
          }
        </div>

        {/* Monthly summary */}
        <div className="card p-5">
          <div className="section-title">📅 This Month</div>
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
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500">{c.category}</span>
                      <span className="font-semibold">{c.total_qty}</span>
                    </div>
                    <div className="bg-gray-100 rounded-full h-1.5">
                      <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
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
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
}
