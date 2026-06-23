import React, { useState, useRef } from 'react'
import api from '../utils/api'
import { Search, Plus, Minus, Trash2, Printer, Share2 } from 'lucide-react'

const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Credit', 'Cheque']

export default function Billing() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [cart, setCart] = useState([])
  const [customer, setCustomer] = useState({ name: '', phone: '' })
  const [discount, setDiscount] = useState(0)
  const [taxPct, setTaxPct] = useState(0)
  const [payment, setPayment] = useState('Cash')
  const [generating, setGenerating] = useState(false)
  const [invoice, setInvoice] = useState(null)
  const invoiceRef = useRef(null)

  const search = async q => {
    setQuery(q)
    if (!q.trim()) { setResults([]); return }
    try {
      const r = await api.get('/api/products', { params: { search: q, limit: 10 } })
      setResults(r.data.items.filter(s => s.quantity > 0))
    } catch {}
  }

  const addToCart = item => {
    setResults([]); setQuery('')
    setCart(prev => {
      const idx = prev.findIndex(c => c.id === item.id)
      if (idx > -1) {
        const updated = [...prev]
        if (updated[idx].qty < item.quantity) updated[idx] = { ...updated[idx], qty: updated[idx].qty + 1 }
        return updated
      }
      return [...prev, { ...item, qty: 1, price: Number(item.selling_price) }]
    })
  }

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(c => c.id === id ? { ...c, qty: Math.max(1, c.qty + delta) } : c).filter(c => c.qty > 0))
  }
  const removeFromCart = id => setCart(prev => prev.filter(c => c.id !== id))
  const updatePrice = (id, price) => setCart(prev => prev.map(c => c.id === id ? { ...c, price: Number(price) || c.price } : c))

  const subtotal = cart.reduce((a, c) => a + c.price * c.qty, 0)
  const discountAmt = Math.min(Number(discount) || 0, subtotal)
  const afterDisc = subtotal - discountAmt
  const taxAmt = Math.round(afterDisc * (Number(taxPct) || 0) / 100)
  const total = afterDisc + taxAmt

  const generateInvoice = async () => {
    if (!cart.length) { alert('Add at least one product to the cart.'); return }
    setGenerating(true)
    try {
      const r = await api.post('/api/sales', {
        customer_name: customer.name || 'Walk-in Customer',
        customer_phone: customer.phone,
        payment_mode: payment,
        discount_amount: discountAmt,
        tax_amount: taxAmt,
        items: cart.map(c => ({ product_id: c.id, quantity: c.qty, unit_price: c.price }))
      })
      setInvoice(r.data)
      setCart([]); setCustomer({ name: '', phone: '' }); setDiscount(0); setTaxPct(0)
      setTimeout(() => invoiceRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch (e) { alert(e.response?.data?.error || 'Failed to generate invoice.') }
    setGenerating(false)
  }

  const printInvoice = () => window.print()

  const shareWhatsApp = () => {
    if (!invoice) return
    const msg = encodeURIComponent(
      `*Khatri Footwear*\nProp. Bhavarlal Khatri\n\nInvoice: ${invoice.invoice_number}\nCustomer: ${invoice.customer_name}\nDate: ${invoice.sale_date?.split('T')[0]}\n\nItems:\n${invoice.items?.map(i => `• ${i.brand} ${i.article_number} Size:${i.size} ×${i.quantity} = ₹${(i.unit_price * i.quantity).toLocaleString('en-IN')}`).join('\n')}\n\nTotal: ₹${Number(invoice.total_amount).toLocaleString('en-IN')}\nPayment: ${invoice.payment_mode}\n\nThank you for shopping with us! 🙏`
    )
    window.open(`https://wa.me/${invoice.customer_phone ? invoice.customer_phone : ''}?text=${msg}`, '_blank')
  }

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-bold text-blue-900">Billing & Invoice</h2>
        <p className="text-sm text-gray-500">Search products, build the cart, and generate a professional invoice.</p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* LEFT: Search + Cart */}
        <div className="lg:col-span-3 space-y-4">
          {/* Search */}
          <div className="card p-5">
            <div className="section-title">🔍 Add Products</div>
            <div className="relative">
              <div className="flex items-center gap-2 bg-white border-2 border-blue-200 rounded-lg px-3 py-2 focus-within:border-blue-500 transition-colors">
                <Search size={16} className="text-gray-400 flex-shrink-0" />
                <input
                  className="flex-1 outline-none text-sm bg-transparent"
                  placeholder="Search brand, article number, size, colour..."
                  value={query}
                  onChange={e => search(e.target.value)}
                  autoFocus
                />
              </div>
              {results.length > 0 && (
                <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white rounded-xl border border-gray-100 shadow-lg max-h-64 overflow-y-auto">
                  {results.map(s => (
                    <button key={s.id} onClick={() => addToCart(s)} className="flex items-center justify-between w-full px-4 py-3 hover:bg-blue-50 transition-colors text-left border-b border-gray-50 last:border-0">
                      <div>
                        <span className="font-semibold text-sm text-gray-800">{s.brand}</span>
                        <span className="badge-blue ml-2">{s.article_number}</span>
                        <div className="text-xs text-gray-400 mt-0.5">Size {s.size} · {s.color} · {s.quantity} in stock</div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="font-bold text-blue-900">₹{Number(s.selling_price).toLocaleString('en-IN')}</div>
                        <div className="text-xs text-green-600">+ Add</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Cart */}
          <div className="card p-5">
            <div className="section-title">🛒 Cart
              {cart.length > 0 && <span className="badge-blue ml-1">{cart.length} item{cart.length > 1 ? 's' : ''}</span>}
            </div>
            {!cart.length
              ? <div className="text-center py-8 text-gray-400"><div className="text-3xl mb-2">🛒</div><div className="text-sm">Cart is empty — search and add products above</div></div>
              : <>
                  {cart.map(item => (
                    <div key={item.id} className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-gray-800 truncate">{item.brand} <span className="text-gray-500 font-normal">{item.article_number}</span></div>
                        <div className="text-xs text-gray-400">Size {item.size} · {item.color}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50"><Minus size={12} /></button>
                        <span className="w-6 text-center text-sm font-bold">{item.qty}</span>
                        <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50"><Plus size={12} /></button>
                      </div>
                      <div className="w-24 text-right">
                        <input type="number" className="text-sm font-semibold text-right border-0 outline-none w-full" value={item.price} onChange={e => updatePrice(item.id, e.target.value)} />
                        <div className="text-xs text-gray-400">× {item.qty} = ₹{(item.price * item.qty).toLocaleString('en-IN')}</div>
                      </div>
                      <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </>
            }
          </div>
        </div>

        {/* RIGHT: Customer + Summary */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5">
            <div className="section-title">👤 Customer Details</div>
            <div className="space-y-3">
              <div><label className="label">Customer Name</label><input className="input-field" placeholder="Walk-in Customer" value={customer.name} onChange={e => setCustomer(p => ({ ...p, name: e.target.value }))} /></div>
              <div><label className="label">Mobile Number</label><input className="input-field" type="tel" placeholder="For WhatsApp invoice" value={customer.phone} onChange={e => setCustomer(p => ({ ...p, phone: e.target.value }))} /></div>
              <div><label className="label">Discount (₹)</label><input className="input-field" type="number" min="0" value={discount} onChange={e => setDiscount(e.target.value)} /></div>
              <div><label className="label">Tax / GST (%)</label><input className="input-field" type="number" min="0" max="100" step="0.5" value={taxPct} onChange={e => setTaxPct(e.target.value)} /></div>
              <div>
                <label className="label">Payment Mode</label>
                <div className="flex gap-2 flex-wrap mt-1">
                  {PAYMENT_MODES.map(m => (
                    <button key={m} onClick={() => setPayment(m)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${payment === m ? 'bg-blue-900 text-white border-blue-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="section-title">💰 Bill Summary</div>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="font-medium">₹{subtotal.toLocaleString('en-IN')}</span></div>
              {discountAmt > 0 && <div className="flex justify-between text-red-600"><span>Discount</span><span>−₹{discountAmt.toLocaleString('en-IN')}</span></div>}
              {taxAmt > 0 && <div className="flex justify-between text-gray-500"><span>Tax ({taxPct}%)</span><span>₹{taxAmt.toLocaleString('en-IN')}</span></div>}
              <div className="flex justify-between text-base font-bold pt-3 border-t border-gray-100 text-blue-900">
                <span>Total Payable</span><span>₹{total.toLocaleString('en-IN')}</span>
              </div>
            </div>
            <button onClick={generateInvoice} disabled={generating || !cart.length}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-50">
              {generating ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '🧾'}
              {generating ? 'Generating...' : 'Generate Invoice'}
            </button>
          </div>
        </div>
      </div>

      {/* Invoice Output */}
      {invoice && (
        <div ref={invoiceRef} className="mt-8">
          <div className="flex gap-3 mb-4 no-print">
            <button onClick={printInvoice} className="btn-secondary flex items-center gap-2"><Printer size={15} /> Print Invoice</button>
            <button onClick={shareWhatsApp} className="btn-success flex items-center gap-2"><Share2 size={15} /> Share on WhatsApp</button>
            <button onClick={() => setInvoice(null)} className="btn-secondary">New Bill</button>
          </div>
          <div className="card p-8 max-w-2xl" id="printable">
            {/* Shop Header */}
            <div className="text-center pb-5 mb-5 border-b-2 border-blue-900">
              <h2 className="text-2xl font-bold text-blue-900 uppercase tracking-wide">Khatri Footwear</h2>
              <p className="text-gray-500 text-sm mt-1">Prop. Bhavarlal Khatri</p>
              <p className="text-gray-400 text-xs mt-0.5">Main Market, Solapur, Maharashtra</p>
              <p className="text-gray-400 text-xs">📞 Contact your shop number · GST No: as applicable</p>
            </div>

            {/* Invoice Meta */}
            <div className="flex justify-between mb-5 text-sm">
              <div>
                <div className="font-bold text-gray-700">Invoice: <span className="text-blue-900">{invoice.invoice_number}</span></div>
                <div className="text-gray-400 text-xs mt-0.5">Date: {invoice.sale_date?.split('T')[0]}</div>
                <div className="text-gray-400 text-xs">Payment: {invoice.payment_mode}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-gray-700">{invoice.customer_name}</div>
                {invoice.customer_phone && <div className="text-gray-400 text-xs mt-0.5">{invoice.customer_phone}</div>}
              </div>
            </div>

            {/* Items Table */}
            <table className="w-full text-sm mb-5 border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Product</th>
                  <th className="px-3 py-2 text-center text-xs font-bold text-gray-500 uppercase">Size</th>
                  <th className="px-3 py-2 text-center text-xs font-bold text-gray-500 uppercase">Qty</th>
                  <th className="px-3 py-2 text-right text-xs font-bold text-gray-500 uppercase">Rate</th>
                  <th className="px-3 py-2 text-right text-xs font-bold text-gray-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items?.map((item, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-2.5">{item.brand} {item.article_number} <span className="text-gray-400">({item.color})</span></td>
                    <td className="px-3 py-2.5 text-center">{item.size}</td>
                    <td className="px-3 py-2.5 text-center">{item.quantity}</td>
                    <td className="px-3 py-2.5 text-right">₹{Number(item.unit_price).toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2.5 text-right font-semibold">₹{(item.unit_price * item.quantity).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="ml-auto max-w-xs space-y-1.5 text-sm mb-5">
              <div className="flex justify-between"><span className="text-gray-400">Subtotal</span><span>₹{Number(invoice.subtotal_amount).toLocaleString('en-IN')}</span></div>
              {Number(invoice.discount_amount) > 0 && <div className="flex justify-between text-red-600"><span>Discount</span><span>−₹{Number(invoice.discount_amount).toLocaleString('en-IN')}</span></div>}
              {Number(invoice.tax_amount) > 0 && <div className="flex justify-between text-gray-400"><span>Tax / GST</span><span>₹{Number(invoice.tax_amount).toLocaleString('en-IN')}</span></div>}
              <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200 text-blue-900">
                <span>Total</span><span>₹{Number(invoice.total_amount).toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4 flex justify-between text-xs text-gray-400">
              <span>Thank you for shopping at Khatri Footwear!</span>
              <span>Exchange within 7 days with bill</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
