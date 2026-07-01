import React, { useEffect, useState, useCallback } from 'react'
import api from '../utils/api'
import {
  Download, Lock, Eye, EyeOff, TrendingUp, TrendingDown,
  ShieldCheck, Wallet, Plus, Trash2, IndianRupee
} from 'lucide-react'

const PERIODS = [
  ['today', 'Today'],
  ['week', 'This Week'],
  ['month', 'This Month'],
  ['year', 'This Year'],
]

function fmt(n) { return Number(n || 0).toLocaleString('en-IN') }

// ─── Password Lock Gate ────────────────────────────────────────────────────────
function ReportLock({ onUnlock, hasPassword }) {
  const [pwd, setPwd] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  const submit = async e => {
    e.preventDefault()
    if (!pwd.trim()) { setError('Please enter the report password.'); return }
    setChecking(true); setError('')
    try {
      const r = await api.post('/api/shop-settings/verify-report-password', { password: pwd })
      if (r.data.verified) onUnlock()
      else setError('Incorrect password.')
    } catch (err) {
      setError(err.response?.data?.error || 'Incorrect password.')
    }
    setChecking(false)
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="card p-8 w-full max-w-sm text-center shadow-lg">
        <div className="w-14 h-14 bg-blue-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Lock size={26} className="text-white" />
        </div>
        <h2 className="text-xl font-bold text-blue-900 mb-1">Reports — Protected</h2>
        <p className="text-sm text-gray-500 mb-6">
          {hasPassword
            ? 'Enter your report password to view financial data, profit & loss, and inventory details.'
            : 'This section contains sensitive financial data. Set a report password in Shop Settings to protect it.'}
        </p>

        {!hasPassword && (
          <div className="alert-warn mb-5 text-left text-xs">
            ⚠️ No report password is set yet. Go to <strong>Shop Settings</strong> → set a <strong>Report Password</strong> to protect this page.
            <br /><br />
            For now, click below to enter without a password.
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div className="relative">
            <input
              className="input-field pr-10 text-center tracking-widest text-lg"
              type={show ? 'text' : 'password'}
              placeholder={hasPassword ? 'Report password' : 'Press Enter to continue'}
              value={pwd}
              onChange={e => { setPwd(e.target.value); setError('') }}
              autoFocus
            />
            <button type="button" onClick={() => setShow(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={checking} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
            {checking
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <ShieldCheck size={16} />}
            {checking ? 'Verifying…' : 'Unlock Reports'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Daily Expenses Panel — owner logs personal/business cash spends ──────────
function ExpensesPanel({ period, netProfit }) {
  const [expenses, setExpenses] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [adding, setAdding] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    api.get('/api/expenses', { params: { period } })
      .then(r => { setExpenses(r.data.expenses); setTotal(r.data.total) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [period])

  useEffect(() => { load() }, [load])

  const addExpense = async e => {
    e.preventDefault()
    if (!amount || parseFloat(amount) <= 0) { alert('Please enter a valid amount.'); return }
    if (!reason.trim()) { alert('Please enter what this money was used for.'); return }
    setAdding(true)
    try {
      await api.post('/api/expenses', { amount: parseFloat(amount), reason: reason.trim(), expense_date: date })
      setAmount(''); setReason('')
      load()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add expense.')
    }
    setAdding(false)
  }

  const removeExpense = async id => {
    if (!confirm('Remove this expense entry?')) return
    await api.delete(`/api/expenses/${id}`)
    load()
  }

  const netTakeHome = netProfit - total

  return (
    <div className="card p-5">
      <div className="section-title">
        <Wallet size={16} /> Owner's Personal & Daily Expenses
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Record cash you spent from shop earnings for personal or other needs — for example, money given to the doctor,
        to your wife, or for household expenses. This amount is subtracted from shop profit to show what you actually keep.
      </p>

      {/* Add expense form */}
      <form onSubmit={addExpense} className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-4">
        <div className="sm:col-span-1">
          <input
            type="number" min="0" step="1"
            className="input-field"
            placeholder="Amount ₹"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <input
            type="text"
            className="input-field"
            placeholder="What was it for? e.g. Doctor fee, gave to wife"
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
        </div>
        <div className="sm:col-span-1 flex gap-2">
          <input
            type="date"
            className="input-field"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>
        <button type="submit" disabled={adding} className="btn-primary sm:col-span-4 flex items-center justify-center gap-2 py-2">
          {adding ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Plus size={14} />}
          {adding ? 'Adding…' : 'Add Expense Entry'}
        </button>
      </form>

      {/* Net Take-Home summary */}
      <div className={`rounded-xl p-4 border mb-4 ${netTakeHome >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Shop Profit</div>
            <div className="text-lg font-bold text-blue-900 mt-1">₹{fmt(netProfit)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Money You Spent</div>
            <div className="text-lg font-bold text-red-600 mt-1">−₹{fmt(total)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">You Actually Keep</div>
            <div className={`text-lg font-bold mt-1 flex items-center justify-center gap-1 ${netTakeHome >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              {netTakeHome >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              ₹{fmt(Math.abs(netTakeHome))}
            </div>
          </div>
        </div>
      </div>

      {/* Expense list */}
      {loading ? (
        <div className="flex justify-center py-6">
          <div className="w-6 h-6 border-2 border-blue-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !expenses.length ? (
        <p className="text-sm text-gray-400 text-center py-4">No personal expenses recorded for this period.</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {expenses.map(exp => (
            <div key={exp.id} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-700 truncate">{exp.reason}</div>
                <div className="text-xs text-gray-400">{exp.expense_date?.split('T')[0]}</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="font-bold text-red-600 text-sm">−₹{fmt(exp.amount)}</span>
                <button onClick={() => removeExpense(exp.id)} className="text-gray-300 hover:text-red-500 p-1">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Reports Component ────────────────────────────────────────────────────
export default function Reports() {
  const [unlocked, setUnlocked]       = useState(false)
  const [hasPassword, setHasPassword] = useState(true)
  const [checkingAuth, setCheckingAuth] = useState(true)

  const [period, setPeriod]           = useState('month')
  const [data, setData]               = useState(null)
  const [sales, setSales]             = useState([])
  const [monthly, setMonthly]         = useState([])
  const [topProducts, setTopProducts] = useState([])
  const [loading, setLoading]         = useState(false)

  useEffect(() => {
    api.get('/api/shop-settings')
      .then(r => setHasPassword(!!r.data.has_report_password))
      .catch(() => setHasPassword(false))
      .finally(() => setCheckingAuth(false))
  }, [])

  const loadData = useCallback(() => {
    if (!unlocked) return
    setLoading(true)
    Promise.all([
      api.get('/api/reports/dashboard', { params: { period } }),
      api.get('/api/sales', { params: { period, limit: 100 } }),
      api.get('/api/reports/monthly'),
      api.get('/api/reports/top-products', { params: { limit: 10 } }),
    ])
      .then(([r1, r2, r3, r4]) => {
        setData(r1.data)
        setSales(r2.data.sales || [])
        setMonthly(r3.data || [])
        setTopProducts(r4.data || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [period, unlocked])

  useEffect(() => { loadData() }, [loadData])

  const exportCSV = () => {
    if (!sales.length) return
    const header = 'Invoice,Customer,Phone,Date,Payment,Amount\n'
    const body = sales.map(s =>
      `"${s.invoice_number}","${s.customer_name}","${s.customer_phone || ''}","${s.sale_date?.split('T')[0]}","${s.payment_mode}","${s.total_amount}"`
    ).join('\n')
    const blob = new Blob([header + body], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `khatri-sales-${period}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  if (checkingAuth) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-2 border-blue-900 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!unlocked) {
    return <ReportLock onUnlock={() => setUnlocked(true)} hasPassword={hasPassword} />
  }

  const pl = data?.pl || {}
  const maxRevenue = data?.brandRevenue?.length ? Math.max(...data.brandRevenue.map(b => b.revenue), 1) : 1
  const maxMonthly = monthly.length ? Math.max(...monthly.map(m => m.revenue), 1) : 1

  // Build a quick lookup of invoice-wise profit so we can show it inline in Invoice History
  const invoiceProfitMap = {}
  ;(pl.invoiceWise || []).forEach(iv => { invoiceProfitMap[iv.id] = iv })

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold text-blue-900 flex items-center gap-2">
            <ShieldCheck size={20} className="text-green-600" /> Reports & Analytics
          </h2>
          <p className="text-sm text-gray-500">Sensitive financial data — do not share screen in public.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {PERIODS.map(([k, l]) => (
              <button key={k} onClick={() => setPeriod(k)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${period === k ? 'bg-white text-blue-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {l}
              </button>
            ))}
          </div>
          <button onClick={exportCSV} className="btn-secondary btn-sm flex items-center gap-1.5"><Download size={13} /> Export CSV</button>
          <button onClick={() => setUnlocked(false)} className="btn-secondary btn-sm flex items-center gap-1.5"><Lock size={13} /> Lock</button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-blue-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── SECTION 1: Sales KPIs ── */}
          <div className="mb-2 text-xs font-bold text-gray-400 uppercase tracking-widest">Sales Performance</div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              ['Total Revenue', `₹${fmt(data?.periodRevenue ?? 0)}`, '💰'],
              ['Invoices', data?.periodInvoices ?? 0, '🧾'],
              ['Units Sold', data?.unitsSold ?? 0, '👟'],
              ['Avg Order Value', `₹${data?.periodInvoices ? Math.round(data.periodRevenue / data.periodInvoices).toLocaleString('en-IN') : 0}`, '📊'],
            ].map(([l, v, icon]) => (
              <div key={l} className="stat-card">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{l}</div>
                  <span className="text-lg">{icon}</span>
                </div>
                <div className="text-2xl font-bold text-blue-900">{v}</div>
              </div>
            ))}
          </div>

          {/* ── SECTION 2: Profit & Loss ── */}
          <div className="mb-2 text-xs font-bold text-gray-400 uppercase tracking-widest">Profit & Loss</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {[
              { label: "Today's P&L", p: pl.today },
              { label: "This Month's P&L", p: pl.month },
              { label: "This Year's P&L", p: pl.year },
            ].map(({ label, p }) => {
              const profit = p?.profit ?? 0
              const revenue = p?.revenue ?? 0
              const cost = p?.cost ?? 0
              const margin = revenue > 0 ? Math.round(profit / revenue * 100) : 0
              const isProfit = profit >= 0
              return (
                <div key={label} className={`rounded-xl p-4 border ${isProfit ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{label}</div>
                  <div className={`text-2xl font-bold flex items-center gap-1 mb-3 ${isProfit ? 'text-green-700' : 'text-red-600'}`}>
                    {isProfit ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                    {isProfit ? '+' : '−'}₹{fmt(Math.abs(profit))}
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-gray-500">Revenue</span><span className="font-semibold">₹{fmt(revenue)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Purchase Cost</span><span className="font-semibold text-red-500">₹{fmt(cost)}</span></div>
                    <div className="flex justify-between pt-1 border-t border-gray-200"><span className="text-gray-500">Margin</span><span className={`font-bold ${isProfit ? 'text-green-700' : 'text-red-600'}`}>{margin}%</span></div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── SECTION 3: Daily/Personal Expenses + Net Take-Home ── */}
          <div className="mb-2 text-xs font-bold text-gray-400 uppercase tracking-widest">Money You Actually Keep</div>
          <div className="mb-6">
            <ExpensesPanel period={period} netProfit={pl[period]?.profit ?? pl.month?.profit ?? 0} />
          </div>

          {/* ── SECTION 4: Invoice-wise Profit/Loss ── */}
          {pl.invoiceWise?.length > 0 && (
            <div className="card overflow-hidden mb-6">
              <div className="px-5 py-4 border-b border-gray-50 section-title mb-0">
                🧾 Profit / Loss Per Invoice
              </div>
              <p className="px-5 pt-2 text-xs text-gray-500">
                Shows exactly how much money was earned on each bill, after the discount given to the customer.
              </p>
              <div className="overflow-x-auto mt-2">
                <table className="w-full text-sm">
                  <thead className="table-header">
                    <tr>
                      <th className="px-3 py-3 text-left">Invoice</th>
                      <th className="px-3 py-3 text-left">Customer</th>
                      <th className="px-3 py-3 text-center">Items</th>
                      <th className="px-3 py-3 text-left">Date</th>
                      <th className="px-3 py-3 text-right">Revenue (You Got)</th>
                      <th className="px-3 py-3 text-right">Cost (You Paid)</th>
                      <th className="px-3 py-3 text-right">Profit / Loss</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pl.invoiceWise.map(iv => (
                      <tr key={iv.id} className={`border-t border-gray-50 hover:bg-gray-50 ${iv.profit < 0 ? 'bg-red-50/30' : ''}`}>
                        <td className="px-3 py-2.5"><span className="badge-blue">{iv.invoice_number}</span></td>
                        <td className="px-3 py-2.5 font-medium">{iv.customer_name || 'Walk-in'}</td>
                        <td className="px-3 py-2.5 text-center text-xs text-gray-400">{iv.item_count}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-400">{iv.sale_date?.split('T')[0]}</td>
                        <td className="px-3 py-2.5 text-right">₹{fmt(iv.revenue)}</td>
                        <td className="px-3 py-2.5 text-right text-red-500">₹{fmt(iv.cost)}</td>
                        <td className={`px-3 py-2.5 text-right font-bold ${iv.profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {iv.profit >= 0 ? '+' : '−'}₹{fmt(Math.abs(iv.profit))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── SECTION 5: Product-wise P&L ── */}
          {pl.products?.length > 0 && (
            <div className="card overflow-hidden mb-6">
              <div className="px-5 py-4 border-b border-gray-50 section-title mb-0">📦 Product-wise Profit & Loss</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="table-header">
                    <tr>
                      <th className="px-3 py-3 text-left">#</th>
                      <th className="px-3 py-3 text-left">Brand / Article</th>
                      <th className="px-3 py-3 text-center">Size</th>
                      <th className="px-3 py-3 text-center">Units Sold</th>
                      <th className="px-3 py-3 text-right">Revenue</th>
                      <th className="px-3 py-3 text-right">Purchase Cost</th>
                      <th className="px-3 py-3 text-right">Profit / Loss</th>
                      <th className="px-3 py-3 text-center">Margin</th>
                      <th className="px-3 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pl.products.map((p, i) => {
                      const margin = p.revenue > 0 ? Math.round(p.profit / p.revenue * 100) : 0
                      return (
                        <tr key={i} className={`border-t border-gray-50 hover:bg-gray-50 ${p.profit < 0 ? 'bg-red-50/30' : ''}`}>
                          <td className="px-3 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                          <td className="px-3 py-2.5">
                            <span className="font-semibold">{p.brand}</span>
                            <span className="badge-blue ml-1.5">{p.article_number}</span>
                            <span className="text-gray-400 text-xs ml-1">({p.color})</span>
                          </td>
                          <td className="px-3 py-2.5 text-center">{p.size}</td>
                          <td className="px-3 py-2.5 text-center font-bold">{p.units_sold}</td>
                          <td className="px-3 py-2.5 text-right">₹{fmt(p.revenue)}</td>
                          <td className="px-3 py-2.5 text-right text-red-500">₹{fmt(p.cost)}</td>
                          <td className={`px-3 py-2.5 text-right font-bold ${p.profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                            {p.profit >= 0 ? '+' : '−'}₹{fmt(Math.abs(p.profit))}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={margin >= 30 ? 'badge-green' : margin >= 15 ? 'badge-amber' : 'badge-red'}>{margin}%</span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={p.profit >= 0 ? 'badge-green' : 'badge-red'}>{p.profit >= 0 ? '▲ Profit' : '▼ Loss'}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── SECTION 6: Inventory ── */}
          <div className="mb-2 text-xs font-bold text-gray-400 uppercase tracking-widest">Inventory</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              ['Total Stock Units', data?.totalStock ?? 0, 'units'],
              ['Inventory Value', `₹${fmt(data?.inventoryValue ?? 0)}`, 'purchase cost'],
              ['Product Variants', data?.productCount ?? 0, 'SKUs'],
              ['Low Stock Items', data?.lowStockCount ?? 0, 'need reorder'],
            ].map(([l, v, sub]) => (
              <div key={l} className="stat-card">
                <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">{l}</div>
                <div className="text-xl font-bold text-blue-900">{v}</div>
                <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
              </div>
            ))}
          </div>

          {/* ── SECTION 7: Monthly Chart ── */}
          {monthly.length > 0 && (
            <div className="card p-5 mb-6">
              <div className="section-title">📅 Monthly Revenue vs Profit — Last 12 Months</div>
              <div className="flex items-end gap-1.5 mt-2" style={{ height: '120px' }}>
                {monthly.map(m => {
                  const revPct = Math.round((m.revenue / maxMonthly) * 100)
                  const profPct = m.revenue > 0 ? Math.round((Math.max(m.profit, 0) / maxMonthly) * 100) : 0
                  return (
                    <div key={m.month} className="flex flex-col items-center gap-0.5 flex-1 min-w-0 h-full justify-end">
                      <div className="text-blue-900 truncate" style={{ fontSize: '9px', fontWeight: 600 }}>
                        {m.revenue > 0 ? `₹${Math.round(m.revenue / 1000)}k` : ''}
                      </div>
                      <div className="w-full relative flex flex-col justify-end" style={{ height: '80px' }}>
                        <div className="w-full bg-blue-200 rounded-t-sm" style={{ height: `${Math.max(revPct * 0.8, 2)}px` }} title={`Revenue ₹${fmt(m.revenue)}`} />
                        <div className="absolute bottom-0 w-full bg-green-500 rounded-t-sm opacity-70" style={{ height: `${Math.max(profPct * 0.8, 0)}px` }} title={`Profit ₹${fmt(m.profit)}`} />
                      </div>
                      <div className="text-gray-400 truncate w-full text-center" style={{ fontSize: '9px' }}>{m.month}</div>
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-4 mt-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-200 rounded" /> Revenue</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded opacity-70" /> Profit</span>
              </div>
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Brand Revenue + Top Products + Invoice History */}
            <div className="lg:col-span-2 space-y-5">
              <div className="card p-5">
                <div className="section-title">🏷️ Revenue by Brand</div>
                {!data?.brandRevenue?.length ? (
                  <p className="text-sm text-gray-400 py-4 text-center">No sales for this period.</p>
                ) : data.brandRevenue.map(b => (
                  <div key={b.brand} className="mb-3 last:mb-0">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{b.brand}</span>
                      <span className="font-bold text-blue-900">₹{fmt(b.revenue)}</span>
                    </div>
                    <div className="bg-gray-100 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${Math.round(b.revenue / maxRevenue * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {topProducts.length > 0 && (
                <div className="card p-5">
                  <div className="section-title">🔥 Top Selling Products</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="table-header">
                        <tr>
                          <th className="px-3 py-2 text-left">#</th>
                          <th className="px-3 py-2 text-left">Product</th>
                          <th className="px-3 py-2 text-center">Size</th>
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
                            <td className="px-3 py-2.5 text-center">{p.size}</td>
                            <td className="px-3 py-2.5 text-center font-bold">{p.units_sold}</td>
                            <td className="px-3 py-2.5 text-right font-bold text-blue-900">₹{fmt(p.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Invoice History — now with Profit column */}
              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                  <div className="section-title mb-0">🧾 Invoice History</div>
                  <button onClick={exportCSV} className="btn-secondary btn-sm flex items-center gap-1"><Download size={12} /> CSV</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="table-header">
                      <tr>
                        {['Invoice', 'Customer', 'Items', 'Date', 'Payment', 'Amount', 'Profit'].map(h => (
                          <th key={h} className="px-3 py-3 text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {!sales.length && (
                        <tr><td colSpan="7" className="text-center py-8 text-gray-400">No sales for this period.</td></tr>
                      )}
                      {sales.map(s => {
                        const ivPL = invoiceProfitMap[s.id]
                        return (
                          <tr key={s.id} className="hover:bg-gray-50 border-t border-gray-50">
                            <td className="table-cell"><span className="badge-blue">{s.invoice_number}</span></td>
                            <td className="table-cell font-medium">{s.customer_name || 'Walk-in'}</td>
                            <td className="table-cell text-xs text-gray-400">{s.item_count} item(s)</td>
                            <td className="table-cell text-xs text-gray-400">{s.sale_date?.split('T')[0]}</td>
                            <td className="table-cell">
                              <span className={s.payment_mode === 'Cash' ? 'badge-green' : s.payment_mode === 'UPI' ? 'badge-blue' : 'badge-amber'}>
                                {s.payment_mode}
                              </span>
                            </td>
                            <td className="table-cell font-bold text-blue-900">₹{fmt(s.total_amount)}</td>
                            <td className="table-cell">
                              {ivPL ? (
                                <span className={`font-bold ${ivPL.profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                                  {ivPL.profit >= 0 ? '+' : '−'}₹{fmt(Math.abs(ivPL.profit))}
                                </span>
                              ) : <span className="text-gray-300">—</span>}
                            </td>
                          </tr>
                        )
                      })}
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
                ) : data.paymentBreakdown.map(p => (
                  <div key={p.payment_mode} className="flex justify-between items-center mb-3 last:mb-0 pb-3 border-b border-gray-50 last:border-0">
                    <div>
                      <div className="text-sm font-medium">{p.payment_mode}</div>
                      <div className="text-xs text-gray-400">{p.count} bills</div>
                    </div>
                    <div className="font-bold text-blue-900 text-sm">₹{fmt(p.revenue)}</div>
                  </div>
                ))}
              </div>

              <div className="card p-5">
                <div className="section-title">📦 Stock by Category</div>
                {!data?.categoryBreakdown?.length ? (
                  <p className="text-sm text-gray-400">No stock.</p>
                ) : data.categoryBreakdown.map(c => {
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
                })}
              </div>

              <div className="card p-5">
                <div className="section-title">⚠️ Low Stock Alert</div>
                {!data?.lowStockItems?.length ? (
                  <div className="text-sm text-green-700 flex items-center gap-1.5">✅ All items well-stocked.</div>
                ) : data.lowStockItems.map(s => (
                  <div key={s.id} className="mb-3 last:mb-0 pb-2 border-b border-gray-50 last:border-0">
                    <div className="font-semibold text-sm">{s.brand} <span className="badge-blue ml-1">{s.article_number}</span></div>
                    <div className="text-xs text-gray-400 mt-0.5">Size {s.size} · <strong className="text-red-600">{s.quantity}</strong> left</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
