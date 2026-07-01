import React, { useState, useRef, useEffect } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import api from '../utils/api'
import { Search, Plus, Minus, Trash2, Printer, Download, Share2 } from 'lucide-react'

const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Credit', 'Cheque']

function fmt(n) { return Number(n || 0).toLocaleString('en-IN') }

// ─── Build a real PDF document using jsPDF (proper alignment, no browser quirks) ──
function buildInvoicePDF(inv, shop) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 40
  let y = 50

  // ── Shop header ──────────────────────────────────────────────────────────
  doc.setTextColor(26, 54, 93) // brand blue
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text((shop.shop_name || 'Khatri Footwear').toUpperCase(), pageWidth / 2, y, { align: 'center' })
  y += 20

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(113, 128, 150) // gray
  if (shop.owner_name) { doc.text(shop.owner_name, pageWidth / 2, y, { align: 'center' }); y += 14 }
  if (shop.address)    { doc.text(shop.address, pageWidth / 2, y, { align: 'center' }); y += 14 }
  if (shop.phone)      { doc.text(`Phone: ${shop.phone}`, pageWidth / 2, y, { align: 'center' }); y += 14 }
  if (shop.gstin)      { doc.text(`GSTIN: ${shop.gstin}`, pageWidth / 2, y, { align: 'center' }); y += 14 }

  y += 6
  doc.setDrawColor(26, 54, 93)
  doc.setLineWidth(1.5)
  doc.line(margin, y, pageWidth - margin, y)
  y += 24

  // ── Invoice meta (left) and customer (right) ─────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(26, 54, 93)
  doc.text(`Invoice: ${inv.invoice_number}`, margin, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(113, 128, 150)
  doc.text(`Date: ${inv.sale_date?.split('T')[0] || new Date().toISOString().split('T')[0]}`, margin, y + 15)
  doc.text(`Payment Mode: ${inv.payment_mode}`, margin, y + 29)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(26, 32, 44)
  doc.text(inv.customer_name || 'Walk-in Customer', pageWidth - margin, y, { align: 'right' })
  if (inv.customer_phone) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(113, 128, 150)
    doc.text(inv.customer_phone, pageWidth - margin, y + 15, { align: 'right' })
  }

  y += 40

  // ── Items table ───────────────────────────────────────────────────────────
  const tableRows = (inv.items || []).map(item => [
    `${item.brand} ${item.article_number} (${item.color})`,
    String(item.size),
    String(item.quantity),
    `Rs.${fmt(item.unit_price)}`,
    `Rs.${fmt(item.unit_price * item.quantity)}`,
  ])

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Product', 'Size', 'Qty', 'Rate', 'Amount']],
    body: tableRows,
    theme: 'striped',
    headStyles: {
      fillColor: [26, 54, 93],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
    },
    bodyStyles: { fontSize: 10, textColor: [26, 32, 44] },
    columnStyles: {
      0: { halign: 'left',  cellWidth: 'auto' },
      1: { halign: 'center', cellWidth: 50 },
      2: { halign: 'center', cellWidth: 40 },
      3: { halign: 'right',  cellWidth: 70 },
      4: { halign: 'right',  cellWidth: 80, fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: [247, 250, 252] },
  })

  let finalY = doc.lastAutoTable.finalY + 18

  // ── Totals box (right-aligned, properly aligned columns) ─────────────────
  const totalsX = pageWidth - margin - 200
  const totalsW = 200
  const lineH = 18

  const totalLines = [
    { label: 'Subtotal', value: `Rs.${fmt(inv.subtotal_amount)}`, color: [113, 128, 150] },
  ]
  if (+inv.discount_amount > 0) {
    totalLines.push({ label: 'Discount', value: `-Rs.${fmt(inv.discount_amount)}`, color: [229, 62, 62] })
  }
  if (+inv.tax_amount > 0) {
    totalLines.push({ label: 'GST / Tax', value: `Rs.${fmt(inv.tax_amount)}`, color: [113, 128, 150] })
  }

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  totalLines.forEach(line => {
    doc.setTextColor(...line.color)
    doc.text(line.label, totalsX, finalY)
    doc.text(line.value, totalsX + totalsW, finalY, { align: 'right' })
    finalY += lineH
  })

  // Grand total — separated by a line, bold, larger
  doc.setDrawColor(26, 54, 93)
  doc.setLineWidth(1.2)
  doc.line(totalsX, finalY - 4, totalsX + totalsW, finalY - 4)
  finalY += 12
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(26, 54, 93)
  doc.text('Total Payable', totalsX, finalY)
  doc.text(`Rs.${fmt(inv.total_amount)}`, totalsX + totalsW, finalY, { align: 'right' })

  finalY += 40

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.5)
  doc.line(margin, finalY, pageWidth - margin, finalY)
  finalY += 16
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(113, 128, 150)
  doc.text(`Thank you for shopping at ${shop.shop_name || 'Khatri Footwear'}!`, margin, finalY)
  doc.text('Exchange within 7 days with bill', pageWidth - margin, finalY, { align: 'right' })

  return doc
}

// ─── Download PDF directly to device ──────────────────────────────────────────
function downloadInvoicePDF(inv, shop) {
  const doc = buildInvoicePDF(inv, shop)
  doc.save(`Invoice-${inv.invoice_number}.pdf`)
}

// ─── Print using the browser print dialog on the same PDF ────────────────────
function printInvoicePDF(inv, shop) {
  const doc = buildInvoicePDF(inv, shop)
  doc.autoPrint()
  const blobUrl = doc.output('bloburl')
  window.open(blobUrl, '_blank')
}

// ─── Share PDF via WhatsApp (Web Share API where supported, else text fallback) ──
async function shareWhatsAppPDF(inv, shop) {
  const doc = buildInvoicePDF(inv, shop)
  const fileName = `Invoice-${inv.invoice_number}.pdf`
  const blob = doc.output('blob')
  const file = new File([blob], fileName, { type: 'application/pdf' })

  // Try native share sheet first (works on most Android/Chrome — lets user pick WhatsApp)
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `Invoice ${inv.invoice_number}`,
        text: `Invoice ${inv.invoice_number} from ${shop.shop_name || 'Khatri Footwear'}`,
      })
      return
    } catch (err) {
      // user cancelled share sheet — fall through to text fallback
      if (err?.name === 'AbortError') return
    }
  }

  // Fallback: download the PDF + open WhatsApp with a text summary
  // (wa.me cannot accept file attachments directly from a website — this is a WhatsApp/browser limitation)
  doc.save(fileName)

  const items = (inv.items || []).map(i =>
    `• ${i.brand} ${i.article_number} (${i.color}) Sz:${i.size} ×${i.quantity} = ₹${fmt(i.unit_price * i.quantity)}`
  ).join('\n')

  const msg = [
    `*${shop.shop_name || 'Khatri Footwear'}*`,
    shop.owner_name || '',
    shop.address || '',
    shop.phone ? `📞 ${shop.phone}` : '',
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
    +inv.tax_amount > 0 ? `GST/Tax  : ₹${fmt(inv.tax_amount)}` : '',
    `*Total   : ₹${fmt(inv.total_amount)}*`,
    '',
    '📎 PDF invoice downloaded — please attach it to this chat manually.',
    '_Thank you for shopping with us! 🙏_',
  ].filter(Boolean).join('\n')

  const phone = inv.customer_phone
    ? '91' + String(inv.customer_phone).replace(/\D/g, '').slice(-10)
    : ''
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
}

// ─── Main Billing Component ───────────────────────────────────────────────────
export default function Billing() {
  const [query,        setQuery]        = useState('')
  const [results,      setResults]      = useState([])
  const [cart,         setCart]         = useState([])
  const [customer,     setCustomer]     = useState({ name: '', phone: '' })
  const [discount,     setDiscount]     = useState(0)
  const [taxPct,       setTaxPct]       = useState(0)
  const [payment,      setPayment]      = useState('Cash')
  const [generating,   setGenerating]   = useState(false)
  const [invoice,      setInvoice]      = useState(null)
  const [shopSettings, setShopSettings] = useState({})
  const [sharing,      setSharing]      = useState(false)
  const invoiceRef = useRef(null)

  useEffect(() => {
    api.get('/api/shop-settings').then(r => setShopSettings(r.data)).catch(() => {})
  }, [])

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
        id: item.id, brand: item.brand, article_number: item.article_number,
        size: item.size, color: item.color, qty: 1,
        price: Number(item.selling_price), stock: item.quantity,
      }]
    })
  }

  const updateQty = (id, delta) =>
    setCart(prev => prev.map(c => c.id === id ? { ...c, qty: Math.max(1, c.qty + delta) } : c).filter(c => c.qty > 0))
  const removeFromCart = id => setCart(prev => prev.filter(c => c.id !== id))
  const updatePrice = (id, price) =>
    setCart(prev => prev.map(c => c.id === id ? { ...c, price: Number(price) || c.price } : c))

  const subtotal    = cart.reduce((a, c) => a + c.price * c.qty, 0)
  const discountAmt = Math.min(Number(discount) || 0, subtotal)
  const afterDisc    = subtotal - discountAmt
  const taxAmt       = Math.round(afterDisc * (Number(taxPct) || 0) / 100)
  const total         = afterDisc + taxAmt

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
        items: cart.map(c => ({ product_id: c.id, quantity: c.qty, unit_price: c.price })),
      })
      setInvoice(r.data)
      setCart([]); setCustomer({ name: '', phone: '' }); setDiscount(0); setTaxPct(0)
      setTimeout(() => invoiceRef.current?.scrollIntoView({ behavior: 'smooth' }), 150)
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to generate invoice.')
    }
    setGenerating(false)
  }

  const handleShare = async () => {
    setSharing(true)
    try { await shareWhatsAppPDF(invoice, shopSettings) }
    finally { setSharing(false) }
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
          <div className="card p-5">
            <div className="section-title">🔍 Add Products</div>
            <div className="relative">
              <div className="flex items-center gap-2 border-2 border-blue-200 rounded-lg px-3 py-2 focus-within:border-blue-500 transition-colors bg-white">
                <Search size={16} className="text-gray-400 flex-shrink-0" />
                <input className="flex-1 outline-none text-sm bg-transparent" placeholder="Search brand, article, size, colour…" value={query} onChange={e => search(e.target.value)} autoFocus />
              </div>
              {results.length > 0 && (
                <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white rounded-xl border border-gray-100 shadow-lg max-h-64 overflow-y-auto">
                  {results.map(s => (
                    <button key={s.id} onClick={() => addToCart(s)} className="flex items-center justify-between w-full px-4 py-3 hover:bg-blue-50 transition-colors text-left border-b border-gray-50 last:border-0">
                      <div>
                        <span className="font-semibold text-sm">{s.brand}</span>
                        <span className="badge-blue ml-2">{s.article_number}</span>
                        <div className="text-xs text-gray-400 mt-0.5">Size {s.size} · {s.color} · {s.quantity} in stock</div>
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

          <div className="card p-5">
            <div className="section-title">
              🛒 Cart {cart.length > 0 && <span className="badge-blue ml-2">{cart.length} item{cart.length > 1 ? 's' : ''}</span>}
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
                    <div className="font-semibold text-sm truncate">{item.brand} <span className="text-gray-500 font-normal">{item.article_number}</span></div>
                    <div className="text-xs text-gray-400">Size {item.size} · {item.color}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50"><Minus size={12} /></button>
                    <span className="w-6 text-center text-sm font-bold">{item.qty}</span>
                    <button onClick={() => updateQty(item.id, 1)} disabled={item.qty >= item.stock} className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 disabled:opacity-30"><Plus size={12} /></button>
                  </div>
                  <div className="w-28 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-gray-400 text-xs">₹</span>
                      <input type="number" className="text-sm font-semibold text-right border-0 outline-none w-20 bg-transparent" value={item.price} onChange={e => updatePrice(item.id, e.target.value)} min="0" />
                    </div>
                    <div className="text-xs text-gray-400">×{item.qty} = ₹{fmt(item.price * item.qty)}</div>
                  </div>
                  <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600 p-1 ml-1"><Trash2 size={14} /></button>
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
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>₹{fmt(subtotal)}</span></div>
              {discountAmt > 0 && <div className="flex justify-between text-red-600"><span>Discount</span><span>−₹{fmt(discountAmt)}</span></div>}
              {taxAmt > 0 && <div className="flex justify-between text-gray-500"><span>Tax ({taxPct}%)</span><span>₹{fmt(taxAmt)}</span></div>}
              <div className="flex justify-between font-bold text-base pt-3 border-t border-gray-100 text-blue-900">
                <span>Total Payable</span><span>₹{fmt(total)}</span>
              </div>
            </div>
            <button onClick={generateInvoice} disabled={generating || !cart.length} className="btn-primary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-50">
              {generating ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '🧾'}
              {generating ? 'Generating…' : 'Generate Invoice'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Invoice Output ── */}
      {invoice && (
        <div ref={invoiceRef} className="mt-8 max-w-2xl">
          <div className="flex gap-3 mb-4 flex-wrap no-print">
            <button onClick={() => printInvoicePDF(invoice, shopSettings)} className="btn-secondary flex items-center gap-2">
              <Printer size={15} /> Print
            </button>
            <button onClick={() => downloadInvoicePDF(invoice, shopSettings)} className="btn-primary flex items-center gap-2">
              <Download size={15} /> Download PDF
            </button>
            <button onClick={handleShare} disabled={sharing} className="btn-success flex items-center gap-2">
              {sharing ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Share2 size={15} />}
              {sharing ? 'Preparing…' : 'Share PDF on WhatsApp'}
            </button>
            <button onClick={() => setInvoice(null)} className="btn-secondary">New Bill</button>
          </div>

          {/* On-screen invoice preview (matches the PDF layout) */}
          <div className="card p-8">
            <div className="text-center pb-5 mb-5 border-b-2 border-blue-900">
              <h2 className="text-2xl font-bold text-blue-900 uppercase tracking-wider">{shopSettings.shop_name || 'Khatri Footwear'}</h2>
              <p className="text-gray-500 text-sm mt-1">{shopSettings.owner_name || 'Bhavarlal Khatri'}</p>
              {shopSettings.address && <p className="text-gray-400 text-xs mt-0.5">{shopSettings.address}</p>}
              {shopSettings.phone   && <p className="text-gray-400 text-xs">📞 {shopSettings.phone}</p>}
              {shopSettings.gstin   && <p className="text-gray-400 text-xs">GSTIN: {shopSettings.gstin}</p>}
            </div>

            <div className="flex justify-between mb-5 text-sm">
              <div>
                <div className="font-bold text-gray-700">Invoice: <span className="text-blue-900">{invoice.invoice_number}</span></div>
                <div className="text-gray-400 text-xs mt-0.5">
                  Date: {invoice.sale_date?.split('T')[0]}<br />
                  Payment: {invoice.payment_mode}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{invoice.customer_name}</div>
                {invoice.customer_phone && <div className="text-gray-400 text-xs mt-0.5">{invoice.customer_phone}</div>}
              </div>
            </div>

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
                    <td className="px-3 py-2.5 border-b border-gray-100">{item.brand} {item.article_number} <span className="text-gray-400">({item.color})</span></td>
                    <td className="px-3 py-2.5 text-center border-b border-gray-100">{item.size}</td>
                    <td className="px-3 py-2.5 text-center border-b border-gray-100">{item.quantity}</td>
                    <td className="px-3 py-2.5 text-right border-b border-gray-100">₹{fmt(item.unit_price)}</td>
                    <td className="px-3 py-2.5 text-right border-b border-gray-100 font-semibold">₹{fmt(item.unit_price * item.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <table className="ml-auto" style={{ width: '260px' }}>
              <tbody>
                <tr><td className="text-gray-400 py-1 text-sm">Subtotal</td><td className="text-right py-1 text-sm">₹{fmt(invoice.subtotal_amount)}</td></tr>
                {Number(invoice.discount_amount) > 0 && (
                  <tr><td className="text-red-600 py-1 text-sm">Discount</td><td className="text-right py-1 text-sm text-red-600">−₹{fmt(invoice.discount_amount)}</td></tr>
                )}
                {Number(invoice.tax_amount) > 0 && (
                  <tr><td className="text-gray-400 py-1 text-sm">GST / Tax</td><td className="text-right py-1 text-sm">₹{fmt(invoice.tax_amount)}</td></tr>
                )}
                <tr className="border-t-2 border-blue-900">
                  <td className="font-bold text-blue-900 pt-2 text-base">Total</td>
                  <td className="text-right font-bold text-blue-900 pt-2 text-base">₹{fmt(invoice.total_amount)}</td>
                </tr>
              </tbody>
            </table>

            <div className="border-t border-gray-100 pt-4 mt-5 flex justify-between text-xs text-gray-400">
              <span>Thank you for shopping at {shopSettings.shop_name || 'Khatri Footwear'}! 🙏</span>
             
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
