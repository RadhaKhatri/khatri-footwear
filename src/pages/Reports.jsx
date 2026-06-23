import React, { useEffect, useState } from 'react'
import api from '../utils/api'
import { Download } from 'lucide-react'

const PERIODS = [
  ['today', 'Today'],
  ['week', 'This Week'],
  ['month', 'This Month'],
  ['year', 'This Year'],
]

export default function Reports() {
  const [period, setPeriod] = useState('month')
  const [data, setData] = useState(null)
  const [sales, setSales] = useState([])
  const [monthly, setMonthly] = useState([])
  const [topProducts, setTopProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get('/api/reports/dashboard', { params: { period } }),
      api.get('/api/sales', { params: { period, limit: 100 } }),
      api.get('/api/reports/monthly'),
      api.get('/api/reports/top-products', { params: { limit: 8 } }),
    ])
      .then(([r1, r2, r3, r4]) => {
        setData(r1.data)
        setSales(r2.data.sales || [])
        setMonthly(r3.data || [])
        setTopProducts(r4.data || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [period])

  const exportSalesCSV = () => {
    if (!sales.length) return
    const header = 'Invoice,Customer,Phone,Date,Payment,Total\n'
    const body = sales.map(s =>
      `"${s.invoice_number}","${s.customer_name}","${s.customer_phone || ''}","${s.sale_date?.split('T')[0]}","${s.payment_mode}","${s.total_amount}"`
    ).join('\n')
    const blob = new Blob([header + body], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `khatri-sales-${period}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const maxRevenue = data?.brandRevenue?.length
    ? Math.max(...data.brandRevenue.map(b => b.revenue), 1)
    : 1

  const maxMonthly = monthly.length
    ? Math.max(...monthly.map(m => m.revenue), 1)
    : 1

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold text-blue-900">Reports & Analytics</h2>
          <p className="text-sm text-gray-500">Revenue, stock performance, and business insights.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {PERIODS.map(([k, l]) => (
              <button
                key={k}
                onClick={() => setPeriod(k)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  period === k ? 'bg-white text-blue-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <button onClick={exportSalesCSV} className="btn-secondary btn-sm flex items-center gap-1.5">
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-blue-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              ['Total Revenue', `₹${Number(data?.periodRevenue ?? 0).toLocaleString('en-IN')}`, '💰'],
              ['Invoices', data?.periodInvoices ?? 0, '🧾'],
              ['Units Sold', data?.unitsSold ?? 0, '👟'],
              [
                'Avg Order Value',
                `₹${data?.periodInvoices ? Math.round(data.periodRevenue / data.periodInvoices).toLocaleString('en-IN') : 0}`,
                '📊',
              ],
            ].map(([l, v, icon]) => (
              <div key={l} className="stat-card">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide leading-tight">{l}</div>
                  <span className="text-lg">{icon}</span>
                </div>
                <div className="text-2xl font-bold text-blue-900">{v}</div>
              </div>
            ))}
          </div>

          {/* Monthly Revenue Chart */}
          {monthly.length > 0 && (
            <div className="card p-5 mb-6">
              <div className="section-title">📅 Monthly Revenue — Last 12 Months</div>
              <div className="flex items-end gap-1.5 h-36 mt-2">
                {monthly.map(m => {
                  const pct = Math.round((m.revenue / maxMonthly) * 100)
                  return (
                    <div key={m.month} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                      <div className="text-xs font-semibold text-blue-900 truncate">
                        {m.revenue > 0 ? `₹${Math.round(m.revenue / 1000)}k` : ''}
                      </div>
                      <div
                        className="w-full bg-blue-600 rounded-t-sm transition-all"
                        style={{ height: `${Math.max(pct, 2)}px`, maxHeight: '80px', height: `${Math.max(pct * 0.8, 2)}px` }}
                        title={`₹${Number(m.revenue).toLocaleString('en-IN')}`}
                      />
                      <div className="text-xs text-gray-400 truncate w-full text-center">{m.month}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Brand Revenue */}
            <div className="lg:col-span-2 space-y-5">
              <div className="card p-5">
                <div className="section-title">🏷️ Revenue by Brand</div>
                {!data?.brandRevenue?.length ? (
                  <p className="text-sm text-gray-400 py-4 text-center">No sales data for this period.</p>
                ) : (
                  <div className="space-y-3">
                    {data.brandRevenue.map(b => (
                      <div key={b.brand}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700">{b.brand}</span>
                          <span className="font-bold text-blue-900">₹{Number(b.revenue).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="bg-gray-100 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${Math.round(b.revenue / maxRevenue * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Top products */}
              {topProducts.length > 0 && (
                <div className="card p-5">
                  <div className="section-title">🔥 Top Selling Products</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="table-header">
                        <tr>
                          <th className="px-3 py-2 text-left">#</th>
                          <th className="px-3 py-2 text-left">Brand / Article</th>
                          <th className="px-3 py-2 text-left">Size</th>
                          <th className="px-3 py-2 text-center">Units Sold</th>
                          <th className="px-3 py-2 text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topProducts.map((p, i) => (
                          <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                            <td className="px-3 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                            <td className="px-3 py-2.5">
                              <div className="font-semibold">{p.brand}</div>
                              <div className="text-xs text-gray-400">{p.article_number} · {p.color}</div>
                            </td>
                            <td className="px-3 py-2.5">{p.size}</td>
                            <td className="px-3 py-2.5 text-center font-bold">{p.units_sold}</td>
                            <td className="px-3 py-2.5 text-right font-bold text-blue-900">
                              ₹{Number(p.revenue).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sales table */}
              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50 section-title mb-0">🧾 Invoice History</div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="table-header">
                      <tr>
                        {['Invoice', 'Customer', 'Items', 'Date', 'Payment', 'Amount'].map(h => (
                          <th key={h} className="px-3 py-3 text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {!sales.length && (
                        <tr><td colSpan="6" className="text-center py-8 text-gray-400">No sales for this period.</td></tr>
                      )}
                      {sales.map(s => (
                        <tr key={s.id} className="hover:bg-gray-50 border-t border-gray-50">
                          <td className="table-cell"><span className="badge-blue">{s.invoice_number}</span></td>
                          <td className="table-cell font-medium text-sm">{s.customer_name || 'Walk-in'}</td>
                          <td className="table-cell text-xs text-gray-400">{s.item_count} item(s)</td>
                          <td className="table-cell text-xs text-gray-400">{s.sale_date?.split('T')[0]}</td>
                          <td className="table-cell">
                            <span className={
                              s.payment_mode === 'Cash' ? 'badge-green' :
                              s.payment_mode === 'UPI' ? 'badge-blue' : 'badge-amber'
                            }>{s.payment_mode}</span>
                          </td>
                          <td className="table-cell font-bold text-blue-900">
                            ₹{Number(s.total_amount).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-5">
              <div className="card p-5">
                <div className="section-title">💳 Payment Modes</div>
                {!data?.paymentBreakdown?.length ? (
                  <p className="text-sm text-gray-400">No data.</p>
                ) : (
                  data.paymentBreakdown.map(p => (
                    <div key={p.payment_mode} className="flex justify-between items-center mb-4 last:mb-0">
                      <div>
                        <div className="text-sm font-medium text-gray-700">{p.payment_mode}</div>
                        <div className="text-xs text-gray-400">{p.count} invoice{p.count > 1 ? 's' : ''}</div>
                      </div>
                      <div className="font-bold text-blue-900 text-sm">
                        ₹{Number(p.revenue).toLocaleString('en-IN')}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="card p-5">
                <div className="section-title">📦 Stock by Category</div>
                {!data?.categoryBreakdown?.length ? (
                  <p className="text-sm text-gray-400">No stock.</p>
                ) : (
                  data.categoryBreakdown.map(c => {
                    const pct = data.totalStock > 0 ? Math.round(c.total_qty / data.totalStock * 100) : 0
                    return (
                      <div key={c.category} className="mb-3 last:mb-0">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-600 font-medium">{c.category}</span>
                          <span className="font-bold">{c.total_qty} units</span>
                        </div>
                        <div className="bg-gray-100 rounded-full h-1.5">
                          <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              <div className="card p-5">
                <div className="section-title">⚠️ Low Stock Alert</div>
                {!data?.lowStockItems?.length ? (
                  <div className="text-sm text-green-700 flex items-center gap-1.5">
                    <span className="text-green-500">✅</span> All items well-stocked.
                  </div>
                ) : (
                  data.lowStockItems.map(s => (
                    <div key={s.id} className="mb-3 last:mb-0 pb-3 border-b border-gray-50 last:border-0">
                      <div className="font-semibold text-sm">{s.brand} <span className="badge-blue ml-1">{s.article_number}</span></div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        Size {s.size} · Only <strong className="text-red-600">{s.quantity}</strong> left
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
