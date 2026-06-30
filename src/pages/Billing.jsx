import React, { useState, useRef, useEffect } from 'react'
import api from '../utils/api'
import { Search, Plus, Minus, Trash2, Printer, Download, Share2 } from 'lucide-react'

const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Credit', 'Cheque']

// ─── Pure function: build a printable HTML string for the invoice ─────────────
function buildInvoiceHTML(inv, shop) {
  const rows = (inv.items || []).map(item =>
    `<tr>
      <td>${escHtml(item.brand)} ${escHtml(item.article_number)} <span style="color:#718096">(${escHtml(item.color)})</span></td>
      <td style="text-align:center">${escHtml(String(item.size))}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:right">₹${fmt(item.unit_price)}</td>
      <td style="text-align:right;font-weight:600">₹${fmt(item.unit_price * item.quantity)}</td>
    </tr>`
  ).join('')

  const discRow  = +inv.discount_amount > 0
    ? `<tr><td colspan="2" style="text-align:right;color:#e53e3e">Discount</td><td style="text-align:right;color:#e53e3e">−₹${fmt(inv.discount_amount)}</td></tr>` : ''
  const taxRow   = +inv.tax_amount > 0
    ? `<tr><td colspan="2" style="text-align:right;color:#718096">GST / Tax</td><td style="text-align:right">₹${fmt(inv.tax_amount)}</td></tr>` : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Invoice ${inv.invoice_number} — ${shop.shop_name || 'Khatri Footwear'}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1a202c;background:#fff;padding:32px;max-width:680px;margin:auto}
  .header{text-align:center;border-bottom:3px solid #1a365d;padding-bottom:16px;margin-bottom:18px}
  .header h1{font-size:22px;font-weight:700;color:#1a365d;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px}
  .header p{color:#718096;font-size:12px;line-height:1.6}
  .meta{display:flex;justify-content:space-between;margin-bottom:18px;gap:16px}
  .meta-left{flex:1}.meta-right{text-align:right}
  .inv-no{font-size:15px;font-weight:700;color:#1a365d}
  .inv-sub{font-size:12px;color:#718096;margin-top:3px;line-height:1.6}
  .cust-name{font-weight:600;font-size:14px}
  table{width:100%;border-collapse:collapse;margin-bottom:16px}
  thead tr{background:#1a365d;color:#fff}
  thead th{padding:9px 10px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px}
  thead th:not(:first-child){text-align:center}
  thead th:last-child,thead th:nth-child(4){text-align:right}
  tbody tr:nth-child(even){background:#f7fafc}
  tbody td{padding:9px 10px;border-bottom:1px solid #e2e8f0;vertical-align:middle;font-size:13px}
  .totals-table{width:260px;margin-left:auto;margin-bottom:18px;border-collapse:collapse}
  .totals-table td{padding:5px 8px;font-size:13px}
  .totals-table .grand td{font-size:15px;font-weight:700;color:#1a365d;border-top:2px solid #1a365d;padding-top:8px}
  .footer{display:flex;justify-content:space-between;border-top:1px solid #e2e8f0;padding-top:12px;font-size:11px;color:#718096;margin-top:4px}
  .badge{display:inline-block;background:#ebf8ff;color:#2b6cb0;font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px;margin-left:6px}
  @media print{body{padding:16px}button{display:none}}
</style>
</head>
<body>
  <div class="header">
    <h1>${escHtml(shop.shop_name || 'Khatri Footwear')}</h1>
    <p>${escHtml(shop.owner_name || 'Bhavarlal Khatri')}</p>
    <p>${escHtml(shop.address || 'Solapur, Maharashtra')}</p>
    ${shop.phone ? `<p>📞 ${escHtml(shop.phone)}</p>` : ''}
    ${shop.gstin ? `<p>GSTIN: ${escHtml(shop.gstin)}</p>` : ''}
  </div>

  <div class="meta">
    <div class="meta-left">
      <div class="inv-no">Invoice: <span style="color:#2b6cb0">${inv.invoice_number}</span></div>
      <div class="inv-sub">
        Date: ${inv.sale_date?.split('T')[0] || new Date().toISOString().split('T')[0]}<br/>
        Payment: ${inv.payment_mode}
      </div>
    </div>
    <div class="meta-right">
      <div class="cust-name">${escHtml(inv.customer_name || 'Walk-in Customer')}</div>
      ${inv.customer_phone ? `<div style="color:#718096;font-size:12px;margin-top:3px">${escHtml(inv.customer_phone)}</div>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Product</th>
        <th style="text-align:center">Size</th>
        <th style="text-align:center">Qty</th>
        <th style="text-align:right">Rate (₹)</th>
        <th style="text-align:right">Amount (₹)</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <table class="totals-table">
    <tr><td style="color:#718096">Subtotal</td><td style="text-align:right">₹${fmt(inv.subtotal_amount)}</td></tr>
    ${discRow}
    ${taxRow}
    <tr class="grand"><td>Total Payable</td><td style="text-align:right">₹${fmt(inv.total_amount)}</td></tr>
  </table>

  <div class="footer">
    <span>Thank you for shopping at ${escHtml(shop.shop_name || 'Khatri Footwear')}! 🙏</span>
    <span>Exchange within 7 days with bill</span>
  </div>
</body>
</html>`
}

function fmt(n) { return Number(n || 0).toLocaleString('en-IN') }
function escHtml(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

// ─── Download as PDF using browser print-to-PDF in a dedicated window ─────────
function downloadInvoicePDF(inv, shop) {
  const html  = buildInvoiceHTML(inv, shop)
  const title = `Invoice-${inv.invoice_number}`
  const win   = window.open('', '_blank', 'width=800,height=900,scrollbars=yes')
  if (!win) { alert('Please allow pop-ups for this site to download the PDF.'); return }
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.document.title = title
  // Give browser time to render fonts/styles, then trigger print dialog (Save as PDF)
  setTimeout(() => {
    try { win.focus(); win.print() } catch (e) {}
  }, 700)
}

// ─── Print invoice in a clean window (no surrounding UI) ─────────────────────
function printInvoice(inv, shop) {
  const html = buildInvoiceHTML(inv, shop)
  const win  = window.open('', '_blank', 'width=800,height=900')
  if (!win) { window.print(); return }
  win.document.open()
  win.document.write(html)
  win.document.close()
  setTimeout(() => { win.focus(); win.print(); win.close() }, 600)
}

// ─── WhatsApp: open invoice HTML as data URL so receiver can screenshot ───────
function shareWhatsApp(inv, shop) {
  // Build a summary text message (WhatsApp can't receive files from web)
  const items = (inv.items || []).map(i =>
    `• ${i.brand} ${i.article_number} (${i.color}) Sz:${i.size} ×${i.quantity} = ₹${fmt(i.unit_price * i.quantity)}`
  ).join('\n')

  const msg = [
    `*${shop.shop_name || 'Khatri Footwear'}*`,
    shop.owner_name ? shop.owner_name : '',
    shop.address    ? shop.address    : '',
    shop.phone      ? `📞 ${shop.phone}` : '',
    '',
    `*Invoice: ${inv.invoice_number}*`,
    `Date: ${inv.sale_date?.split('T')[0] || ''}`,
    `Customer: ${inv.customer_name || 'Walk-in Customer'}`,
    `Payment: ${inv.payment_mode}`,
    '',
    items,
    '',
    `Subtotal : ₹${fmt(inv.subtotal_amount)}`,
    +inv.discount_amount > 0 ? `Discount : −₹${fmt(inv.discount_amount)}` : '',
    +inv.tax_amount > 0      ? `GST/Tax  : ₹${fmt(inv.tax_amount)}`        : '',
    `*Total   : ₹${fmt(inv.total_amount)}*`,
    '',
    '_Thank you for shopping with us! 🙏_',
    '_Exchange within 7 days with bill_',
  ].filter(l => l !== null && l !== undefined).join('\n')

  const phone = inv.customer_phone
    ? '91' + String(inv.customer_phone).replace(/\D/g, '').slice(-10)
    : ''

  window.open(
    `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,
    '_blank'
  )
}

// ─── Main Billing Component ───────────────────────────────────────────────────
export default function Billing() {
  const [query,       setQuery]       = useState('')
  const [results,     setResults]     = useState([])
  const [cart,        setCart]        = useState([])
  const [customer,    setCustomer]    = useState({ name: '', phone: '' })
  const [discount,    setDiscount]    = useState(0)
  const [taxPct,      setTaxPct]      = useState(0)
  const [payment,     setPayment]     = useState('Cash')
  const [generating,  setGenerating]  = useState(false)
  const [invoice,     setInvoice]     = useState(null)
  const [shopSettings,setShopSettings]= useState({})
  const invoiceRef = useRef(null)

  useEffect(() => {
    api.get('/api/shop-settings').then(r => setShopSettings(r.data)).catch(() => {})
  }, [])

  // Product search
  const search = async q => {
    setQuery(q)
    if (!q.trim()) { setResults([]); return }
    try {
      const r = await api.get('/api/products', { params: { search: q, limit: 12 } })
      setResults(r.data.items.filter(s => s.quantity > 0))
    } catch {}
  }

  const addToCart = item => {
    setResults([]); setQuery('')
    setCart(prev => {
      const idx = prev.findIndex(c => c.id === item.id)
      if (idx > -1) {
        if (prev[idx].qty >= item.quantity) return prev
        return prev.map((c, i) => i === idx ? { ...c, qty: c.qty + 1 } : c)
      }
      return [...prev, {
        id:    item.id,
        brand: item.brand,
        article_number: item.article_number,
        size:  item.size,
        color: item.color,
        qty:   1,
        price: Number(item.selling_price),
        stock: item.quantity,
      }]
    })
  }

  const updateQty = (id, delta) =>
    setCart(prev =>
      prev.map(c => c.id === id ? { ...c, qty: Math.max(1, c.qty + delta) } : c)
          .filter(c => c.qty > 0)
    )
  const removeFromCart = id => setCart(prev => prev.filter(c => c.id !== id))
  const updatePrice    = (id, price) =>
    setCart(prev => prev.map(c => c.id === id ? { ...c, price: Number(price) || c.price } : c))

  // Totals
  const subtotal    = cart.reduce((a, c) => a + c.price * c.qty, 0)
  const discountAmt = Math.min(Number(discount) || 0, subtotal)
  const afterDisc   = subtotal - discountAmt
  const taxAmt      = Math.round(afterDisc * (Number(taxPct) || 0) / 100)
  const total       = afterDisc + taxAmt

  // Generate invoice
  const generateInvoice = async () => {
    if (!cart.length) { alert('Add at least one product to the cart.'); return }
    setGenerating(true)
    try {
      const r = await api.post('/api/sales', {
        customer_name:   customer.name || 'Walk-in Customer',
        customer_phone:  customer.phone,
        payment_mode:    payment,
        discount_amount: discountAmt,
        tax_amount:      taxAmt,
        items: cart.map(c => ({
          product_id: c.id,
          quantity:   c.qty,
          unit_price: c.price,
        })),
      })
      setInvoice(r.data)
      setCart([]); setCustomer({ name: '', phone: '' })
      setDiscount(0); setTaxPct(0)
      setTimeout(() => invoiceRef.current?.scrollIntoView({ behavior: 'smooth' }), 150)
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to generate invoice.')
    }
    setGenerating(false)
  }

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-bold text-blue-900">Billing & Invoice</h2>
        <p className="text-sm text-gray-500">Search products, build the cart, and generate a professional invoice.</p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* LEFT — Search + Cart */}
        <div className="lg:col-span-3 space-y-4">
          {/* Search */}
          <div className="card p-5">
            <div className="section-title">🔍 Add Products</div>
            <div className="relative">
              <div className="flex items-center gap-2 border-2 border-blue-200 rounded-lg px-3 py-2 focus-within:border-blue-500 transition-colors bg-white">
                <Search size={16} className="text-gray-400 flex-shrink-0" />
                <input
                  className="flex-1 outline-none text-sm bg-transparent"
                  placeholder="Search brand, article, size, colour…"
                  value={query}
                  onChange={e => search(e.target.value)}
                  autoFocus
                />
              </div>
              {results.length > 0 && (
                <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white rounded-xl border border-gray-100 shadow-lg max-h-64 overflow-y-auto">
                  {results.map(s => (
                    <button
                      key={s.id}
                      onClick={() => addToCart(s)}
                      className="flex items-center justify-between w-full px-4 py-3 hover:bg-blue-50 transition-colors text-left border-b border-gray-50 last:border-0"
                    >
                      <div>
                        <span className="font-semibold text-sm">{s.brand}</span>
                        <span className="badge-blue ml-2">{s.article_number}</span>
                        <div className="text-xs text-gray-400 mt-0.5">
                          Size {s.size} · {s.color} · {s.quantity} in stock
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="font-bold text-blue-900">₹{fmt(s.selling_price)}</div>
                        <div className="text-xs text-green-600 mt-0.5">+ Add</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Cart */}
          <div className="card p-5">
            <div className="section-title">
              🛒 Cart
              {cart.length > 0 && (
                <span className="badge-blue ml-2">{cart.length} item{cart.length > 1 ? 's' : ''}</span>
              )}
            </div>
            {!cart.length ? (
              <div className="text-center py-8 text-gray-400">
                <div className="text-3xl mb-2">🛒</div>
                <div className="text-sm">Cart is empty — search and add products above</div>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.id} className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">
                      {item.brand} <span className="text-gray-500 font-normal">{item.article_number}</span>
                    </div>
                    <div className="text-xs text-gray-400">Size {item.size} · {item.color}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50">
                      <Minus size={12} />
                    </button>
                    <span className="w-6 text-center text-sm font-bold">{item.qty}</span>
                    <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50" disabled={item.qty >= item.stock}>
                      <Plus size={12} />
                    </button>
                  </div>
                  <div className="w-28 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-gray-400 text-xs">₹</span>
                      <input
                        type="number"
                        className="text-sm font-semibold text-right border-0 outline-none w-20 bg-transparent"
                        value={item.price}
                        onChange={e => updatePrice(item.id, e.target.value)}
                        min="0"
                      />
                    </div>
                    <div className="text-xs text-gray-400">×{item.qty} = ₹{fmt(item.price * item.qty)}</div>
                  </div>
                  <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600 p-1 ml-1">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT — Customer + Summary */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5">
            <div className="section-title">👤 Customer Details</div>
            <div className="space-y-3">
              <div>
                <label className="label">Customer Name</label>
                <input className="input-field" placeholder="Walk-in Customer" value={customer.name} onChange={e => setCustomer(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Mobile Number</label>
                <input className="input-field" type="tel" placeholder="For WhatsApp invoice" value={customer.phone} onChange={e => setCustomer(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div>
                <label className="label">Discount (₹)</label>
                <input className="input-field" type="number" min="0" value={discount} onChange={e => setDiscount(e.target.value)} />
              </div>
              <div>
                <label className="label">Tax / GST (%)</label>
                <input className="input-field" type="number" min="0" max="100" step="0.5" value={taxPct} onChange={e => setTaxPct(e.target.value)} />
              </div>
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
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span>₹{fmt(subtotal)}</span>
              </div>
              {discountAmt > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Discount</span><span>−₹{fmt(discountAmt)}</span>
                </div>
              )}
              {taxAmt > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Tax ({taxPct}%)</span><span>₹{fmt(taxAmt)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-3 border-t border-gray-100 text-blue-900">
                <span>Total Payable</span><span>₹{fmt(total)}</span>
              </div>
            </div>
            <button
              onClick={generateInvoice}
              disabled={generating || !cart.length}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-50"
            >
              {generating
                ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : '🧾'}
              {generating ? 'Generating…' : 'Generate Invoice'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Invoice Output ── */}
      {invoice && (
        <div ref={invoiceRef} className="mt-8 max-w-2xl">
          {/* Action buttons */}
          <div className="flex gap-3 mb-4 flex-wrap no-print">
            <button
              onClick={() => printInvoice(invoice, shopSettings)}
              className="btn-secondary flex items-center gap-2"
            >
              <Printer size={15} /> Print
            </button>
            <button
              onClick={() => downloadInvoicePDF(invoice, shopSettings)}
              className="btn-primary flex items-center gap-2"
            >
              <Download size={15} /> Download PDF
            </button>
            <button
              onClick={() => shareWhatsApp(invoice, shopSettings)}
              className="btn-success flex items-center gap-2"
            >
              <Share2 size={15} /> Share on WhatsApp
            </button>
            <button onClick={() => setInvoice(null)} className="btn-secondary">
              New Bill
            </button>
          </div>

          {/* Invoice preview card */}
          <div className="card p-8">
            {/* Shop header */}
            <div className="text-center pb-5 mb-5 border-b-2 border-blue-900">
              <h2 className="text-2xl font-bold text-blue-900 uppercase tracking-wider">
                {shopSettings.shop_name || 'Khatri Footwear'}
              </h2>
              <p className="text-gray-500 text-sm mt-1">{shopSettings.owner_name || 'Bhavarlal Khatri'}</p>
              {shopSettings.address && <p className="text-gray-400 text-xs mt-0.5">{shopSettings.address}</p>}
              {shopSettings.phone   && <p className="text-gray-400 text-xs">📞 {shopSettings.phone}</p>}
              {shopSettings.gstin   && <p className="text-gray-400 text-xs">GSTIN: {shopSettings.gstin}</p>}
            </div>

            {/* Invoice meta */}
            <div className="flex justify-between mb-5 text-sm">
              <div>
                <div className="font-bold text-gray-700">
                  Invoice: <span className="text-blue-900">{invoice.invoice_number}</span>
                </div>
                <div className="text-gray-400 text-xs mt-0.5">
                  Date: {invoice.sale_date?.split('T')[0]}<br />
                  Payment: {invoice.payment_mode}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{invoice.customer_name}</div>
                {invoice.customer_phone && (
                  <div className="text-gray-400 text-xs mt-0.5">{invoice.customer_phone}</div>
                )}
              </div>
            </div>

            {/* Items table */}
            <table className="w-full text-sm mb-5 border-collapse">
              <thead>
                <tr className="bg-blue-900 text-white">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide">Product</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide">Size</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide">Qty</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide">Rate</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(invoice.items || []).map((item, i) => (
                  <tr key={i} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
                    <td className="px-3 py-2.5 border-b border-gray-100">
                      {item.brand} {item.article_number}
                      <span className="text-gray-400"> ({item.color})</span>
                    </td>
                    <td className="px-3 py-2.5 text-center border-b border-gray-100">{item.size}</td>
                    <td className="px-3 py-2.5 text-center border-b border-gray-100">{item.quantity}</td>
                    <td className="px-3 py-2.5 text-right border-b border-gray-100">₹{fmt(item.unit_price)}</td>
                    <td className="px-3 py-2.5 text-right border-b border-gray-100 font-semibold">
                      ₹{fmt(item.unit_price * item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="ml-auto max-w-xs space-y-1.5 text-sm mb-5">
              <div className="flex justify-between">
                <span className="text-gray-400">Subtotal</span>
                <span>₹{fmt(invoice.subtotal_amount)}</span>
              </div>
              {Number(invoice.discount_amount) > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Discount</span><span>−₹{fmt(invoice.discount_amount)}</span>
                </div>
              )}
              {Number(invoice.tax_amount) > 0 && (
                <div className="flex justify-between text-gray-400">
                  <span>GST / Tax</span><span>₹{fmt(invoice.tax_amount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-2 border-t-2 border-blue-900 text-blue-900 mt-2">
                <span>Total</span><span>₹{fmt(invoice.total_amount)}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 pt-4 flex justify-between text-xs text-gray-400">
              <span>Thank you for shopping at {shopSettings.shop_name || 'Khatri Footwear'}! 🙏</span>
              <span>Exchange within 7 days with bill</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
