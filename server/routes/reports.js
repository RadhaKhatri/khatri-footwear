import { Router } from 'express'
import pool from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

function periodFilter(col, period) {
  switch (period) {
    case 'today': return `AND ${col} = CURRENT_DATE`
    case 'week':  return `AND ${col} >= CURRENT_DATE - INTERVAL '7 days'`
    case 'month': return `AND ${col} >= DATE_TRUNC('month', CURRENT_DATE)`
    case 'year':  return `AND ${col} >= DATE_TRUNC('year', CURRENT_DATE)`
    default:      return `AND ${col} >= DATE_TRUNC('month', CURRENT_DATE)`
  }
}

// GET /api/reports/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const { period = 'month' } = req.query
    const pf = periodFilter('s.sale_date', period)

    const stockRes = await pool.query(
      `SELECT COALESCE(SUM(quantity), 0) AS total_stock,
              COUNT(*) AS product_count,
              COALESCE(SUM(quantity * purchase_price), 0) AS inventory_value
       FROM products`
    )
    const lowRes = await pool.query(
      `SELECT id, brand, article_number, size, color, quantity, low_stock_threshold
       FROM products WHERE quantity <= low_stock_threshold ORDER BY quantity ASC LIMIT 10`
    )
    const revenueRes = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS period_revenue, COUNT(*) AS period_invoices
       FROM sales s WHERE 1=1 ${pf}`
    )
    const todayRes = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS today_revenue, COUNT(*) AS today_invoices
       FROM sales WHERE sale_date = CURRENT_DATE`
    )
    const monthRes = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS month_revenue, COUNT(*) AS month_invoices
       FROM sales WHERE sale_date >= DATE_TRUNC('month', CURRENT_DATE)`
    )
    const unitsRes = await pool.query(
      `SELECT COALESCE(SUM(si.quantity), 0) AS units_sold
       FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE 1=1 ${pf}`
    )
    const brandRes = await pool.query(
      `SELECT si.brand, COALESCE(SUM(si.total_price), 0) AS revenue
       FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE 1=1 ${pf}
       GROUP BY si.brand ORDER BY revenue DESC LIMIT 10`
    )
    const payRes = await pool.query(
      `SELECT payment_mode, COALESCE(SUM(total_amount), 0) AS revenue, COUNT(*) AS count
       FROM sales s WHERE 1=1 ${pf} GROUP BY payment_mode ORDER BY revenue DESC`
    )
    const recentRes = await pool.query(
      `SELECT id, invoice_number, customer_name, customer_phone, total_amount, payment_mode, sale_date
       FROM sales ORDER BY created_at DESC LIMIT 5`
    )
    const catRes = await pool.query(
      `SELECT category, SUM(quantity) AS total_qty FROM products GROUP BY category ORDER BY total_qty DESC`
    )

    // ── PROFIT & LOSS ─────────────────────────────────────────────────────────
    // Revenue minus cost of goods sold (purchase_price × qty sold per item)
    const plRes = await pool.query(
      `SELECT
         COALESCE(SUM(si.total_price), 0)                         AS total_revenue,
         COALESCE(SUM(si.quantity * COALESCE(p.purchase_price, 0)), 0) AS total_cost,
         COALESCE(SUM(si.total_price - si.quantity * COALESCE(p.purchase_price, 0)), 0) AS gross_profit
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       LEFT JOIN products p ON p.id = si.product_id
       WHERE 1=1 ${pf}`
    )
    // Today P&L
    const plTodayRes = await pool.query(
      `SELECT
         COALESCE(SUM(si.total_price), 0) AS total_revenue,
         COALESCE(SUM(si.quantity * COALESCE(p.purchase_price, 0)), 0) AS total_cost,
         COALESCE(SUM(si.total_price - si.quantity * COALESCE(p.purchase_price, 0)), 0) AS gross_profit
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       LEFT JOIN products p ON p.id = si.product_id
       WHERE s.sale_date = CURRENT_DATE`
    )
    // Month P&L
    const plMonthRes = await pool.query(
      `SELECT
         COALESCE(SUM(si.total_price), 0) AS total_revenue,
         COALESCE(SUM(si.quantity * COALESCE(p.purchase_price, 0)), 0) AS total_cost,
         COALESCE(SUM(si.total_price - si.quantity * COALESCE(p.purchase_price, 0)), 0) AS gross_profit
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       LEFT JOIN products p ON p.id = si.product_id
       WHERE s.sale_date >= DATE_TRUNC('month', CURRENT_DATE)`
    )
    // Year P&L
    const plYearRes = await pool.query(
      `SELECT
         COALESCE(SUM(si.total_price), 0) AS total_revenue,
         COALESCE(SUM(si.quantity * COALESCE(p.purchase_price, 0)), 0) AS total_cost,
         COALESCE(SUM(si.total_price - si.quantity * COALESCE(p.purchase_price, 0)), 0) AS gross_profit
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       LEFT JOIN products p ON p.id = si.product_id
       WHERE s.sale_date >= DATE_TRUNC('year', CURRENT_DATE)`
    )
    // Product-wise profit
    const productPLRes = await pool.query(
      `SELECT si.brand, si.article_number, si.size, si.color,
              SUM(si.quantity) AS units_sold,
              SUM(si.total_price) AS revenue,
              SUM(si.quantity * COALESCE(p.purchase_price, 0)) AS cost,
              SUM(si.total_price - si.quantity * COALESCE(p.purchase_price, 0)) AS profit
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       LEFT JOIN products p ON p.id = si.product_id
       WHERE 1=1 ${pf}
       GROUP BY si.brand, si.article_number, si.size, si.color
       ORDER BY profit DESC
       LIMIT 10`
    )

    const pl    = plRes.rows[0]
    const plT   = plTodayRes.rows[0]
    const plM   = plMonthRes.rows[0]
    const plY   = plYearRes.rows[0]
    const sk    = stockRes.rows[0]
    const rv    = revenueRes.rows[0]
    const td    = todayRes.rows[0]
    const mn    = monthRes.rows[0]

    res.json({
      totalStock:        parseInt(sk.total_stock),
      productCount:      parseInt(sk.product_count),
      inventoryValue:    parseFloat(sk.inventory_value),
      lowStockCount:     lowRes.rows.length,
      lowStockItems:     lowRes.rows,
      categoryBreakdown: catRes.rows,
      periodRevenue:     parseFloat(rv.period_revenue),
      periodInvoices:    parseInt(rv.period_invoices),
      unitsSold:         parseInt(unitsRes.rows[0].units_sold),
      todayRevenue:      parseFloat(td.today_revenue),
      todayInvoices:     parseInt(td.today_invoices),
      monthRevenue:      parseFloat(mn.month_revenue),
      monthInvoices:     parseInt(mn.month_invoices),
      brandRevenue:      brandRes.rows.map(r => ({ brand: r.brand, revenue: parseFloat(r.revenue) })),
      paymentBreakdown:  payRes.rows.map(r => ({ payment_mode: r.payment_mode, revenue: parseFloat(r.revenue), count: parseInt(r.count) })),
      recentSales:       recentRes.rows,
      // Profit & Loss
      pl: {
        period:   { revenue: parseFloat(pl.total_revenue), cost: parseFloat(pl.total_cost), profit: parseFloat(pl.gross_profit) },
        today:    { revenue: parseFloat(plT.total_revenue), cost: parseFloat(plT.total_cost), profit: parseFloat(plT.gross_profit) },
        month:    { revenue: parseFloat(plM.total_revenue), cost: parseFloat(plM.total_cost), profit: parseFloat(plM.gross_profit) },
        year:     { revenue: parseFloat(plY.total_revenue), cost: parseFloat(plY.total_cost), profit: parseFloat(plY.gross_profit) },
        products: productPLRes.rows.map(r => ({
          brand: r.brand, article_number: r.article_number, size: r.size, color: r.color,
          units_sold: parseInt(r.units_sold),
          revenue: parseFloat(r.revenue), cost: parseFloat(r.cost), profit: parseFloat(r.profit)
        }))
      }
    })
  } catch (err) {
    console.error('Dashboard error:', err)
    res.status(500).json({ error: 'Failed to load dashboard data.' })
  }
})

// GET /api/reports/monthly
router.get('/monthly', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT TO_CHAR(sale_date, 'Mon YY') AS month,
              DATE_TRUNC('month', sale_date) AS month_start,
              COALESCE(SUM(s.total_amount), 0) AS revenue,
              COALESCE(SUM(si.quantity * COALESCE(p.purchase_price,0)), 0) AS cost,
              COUNT(DISTINCT s.id) AS invoices
       FROM sales s
       LEFT JOIN sale_items si ON si.sale_id = s.id
       LEFT JOIN products p ON p.id = si.product_id
       WHERE sale_date >= CURRENT_DATE - INTERVAL '12 months'
       GROUP BY month_start, TO_CHAR(sale_date, 'Mon YY')
       ORDER BY month_start ASC`
    )
    res.json(rows.map(r => ({
      month:    r.month,
      revenue:  parseFloat(r.revenue),
      cost:     parseFloat(r.cost),
      profit:   parseFloat(r.revenue) - parseFloat(r.cost),
      invoices: parseInt(r.invoices),
    })))
  } catch (err) {
    res.status(500).json({ error: 'Failed to load monthly report.' })
  }
})

// GET /api/reports/top-products
router.get('/top-products', async (req, res) => {
  try {
    const { limit = 10 } = req.query
    const { rows } = await pool.query(
      `SELECT si.brand, si.article_number, si.color, si.size,
              SUM(si.quantity) AS units_sold, SUM(si.total_price) AS revenue
       FROM sale_items si
       GROUP BY si.brand, si.article_number, si.color, si.size
       ORDER BY units_sold DESC LIMIT $1`,
      [parseInt(limit)]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Failed to load top products.' })
  }
})

export default router
