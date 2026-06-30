import { Router } from 'express'
import pool from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

async function nextInvoiceNumber(client) {
  const { rows } = await client.query(
    `UPDATE shop_settings SET invoice_counter = invoice_counter + 1
     WHERE id = 1 RETURNING invoice_prefix, invoice_counter`
  )
  const { invoice_prefix, invoice_counter } = rows[0]
  return `${invoice_prefix}-${String(invoice_counter).padStart(4, '0')}`
}

// POST /api/sales — create a new sale
router.post('/', async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const {
      customer_name = 'Walk-in Customer',
      customer_phone = '',
      payment_mode = 'Cash',
      discount_amount = 0,
      tax_amount = 0,
      items = []
    } = req.body

    if (!items.length) return res.status(400).json({ error: 'Cart is empty.' })

    // Fetch products and validate stock
    const lineItems = []
    for (const item of items) {
      const { rows } = await client.query(
        'SELECT * FROM products WHERE id=$1 FOR UPDATE',
        [item.product_id]
      )
      if (!rows.length) throw new Error(`Product ID ${item.product_id} not found.`)
      const product = rows[0]
      if (product.quantity < item.quantity) {
        throw new Error(
          `Insufficient stock for ${product.brand} ${product.article_number}. Available: ${product.quantity}`
        )
      }
      lineItems.push({
        product,
        quantity:       item.quantity,
        unit_price:     parseFloat(item.unit_price) || parseFloat(product.selling_price),
        purchase_price: parseFloat(product.purchase_price) || 0,   // ← capture cost at sale time
      })
    }

    // ── Totals ──────────────────────────────────────────────────────────────
    const subtotal  = lineItems.reduce((a, i) => a + i.unit_price * i.quantity, 0)
    const discAmt   = Math.min(parseFloat(discount_amount) || 0, subtotal)
    const taxAmt    = parseFloat(tax_amount) || 0
    // actual_total = the real money the owner receives
    const actualTotal = subtotal - discAmt + taxAmt

    // ── Distribute discount proportionally across line items ─────────────────
    // This lets us compute per-product actual revenue for P&L
    // actual_item_revenue = unit_price * qty - proportional_discount
    // proportional_discount for item = (item_subtotal / subtotal) * discAmt
    lineItems.forEach(i => {
      const itemSubtotal      = i.unit_price * i.quantity
      const proportionalDisc  = subtotal > 0 ? (itemSubtotal / subtotal) * discAmt : 0
      // actual revenue this item contributed (after discount, excl. tax)
      i.actual_revenue = itemSubtotal - proportionalDisc
      // profit on this item = actual_revenue - purchase_cost
      i.item_profit    = i.actual_revenue - i.purchase_price * i.quantity
    })

    // ── Create invoice ───────────────────────────────────────────────────────
    const invoiceNumber = await nextInvoiceNumber(client)
    const { rows: saleRows } = await client.query(
      `INSERT INTO sales
        (invoice_number, customer_name, customer_phone,
         subtotal_amount, discount_amount, tax_amount, total_amount,
         payment_mode, sale_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_DATE)
       RETURNING *`,
      [
        invoiceNumber, customer_name, customer_phone,
        subtotal.toFixed(2), discAmt.toFixed(2), taxAmt.toFixed(2), actualTotal.toFixed(2),
        payment_mode,
      ]
    )
    const sale = saleRows[0]

    // ── Insert line items + deduct stock ─────────────────────────────────────
    const saleItemRows = []
    for (const item of lineItems) {
      const { rows: itemRows } = await client.query(
        `INSERT INTO sale_items
          (sale_id, product_id, brand, article_number, size, color,
           quantity, unit_price, total_price, purchase_price)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [
          sale.id, item.product.id,
          item.product.brand, item.product.article_number,
          item.product.size,  item.product.color,
          item.quantity,
          item.unit_price.toFixed(2),
          (item.unit_price * item.quantity).toFixed(2),
          item.purchase_price.toFixed(2),                // ← stored cost
        ]
      )
      saleItemRows.push(itemRows[0])

      // Deduct stock
      await client.query(
        'UPDATE products SET quantity = quantity - $1, updated_at = NOW() WHERE id = $2',
        [item.quantity, item.product.id]
      )

      // Audit log
      await client.query(
        `INSERT INTO stock_movements
          (product_id, movement_type, quantity, reference_type, reference_id, note)
         VALUES ($1,'out',$2,'sale',$3,$4)`,
        [item.product.id, item.quantity, sale.id, `Invoice ${invoiceNumber}`]
      )
    }

    await client.query('COMMIT')
    res.status(201).json({ ...sale, items: saleItemRows })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Sale error:', err)
    res.status(400).json({ error: err.message || 'Failed to create invoice.' })
  } finally {
    client.release()
  }
})

// GET /api/sales — list with period filter
router.get('/', async (req, res) => {
  try {
    const { period = 'month', limit = 100 } = req.query
    let dateFilter = ''
    if (period === 'today') dateFilter = `AND s.sale_date = CURRENT_DATE`
    else if (period === 'week')  dateFilter = `AND s.sale_date >= CURRENT_DATE - INTERVAL '7 days'`
    else if (period === 'month') dateFilter = `AND s.sale_date >= DATE_TRUNC('month', CURRENT_DATE)`
    else if (period === 'year')  dateFilter = `AND s.sale_date >= DATE_TRUNC('year', CURRENT_DATE)`

    const { rows } = await pool.query(
      `SELECT s.*, COUNT(si.id) AS item_count
       FROM sales s
       LEFT JOIN sale_items si ON si.sale_id = s.id
       WHERE 1=1 ${dateFilter}
       GROUP BY s.id
       ORDER BY s.created_at DESC
       LIMIT $1`,
      [parseInt(limit)]
    )
    res.json({ sales: rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch sales.' })
  }
})

// GET /api/sales/invoice/:number
router.get('/invoice/:number', async (req, res) => {
  try {
    const { rows: saleRows } = await pool.query(
      'SELECT * FROM sales WHERE invoice_number=$1',
      [req.params.number]
    )
    if (!saleRows.length) return res.status(404).json({ error: 'Invoice not found.' })
    const { rows: items } = await pool.query(
      'SELECT * FROM sale_items WHERE sale_id=$1',
      [saleRows[0].id]
    )
    res.json({ ...saleRows[0], items })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invoice.' })
  }
})

export default router
