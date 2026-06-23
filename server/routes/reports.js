import { Router } from 'express'
import pool from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

// Build date filter SQL based on period
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
    const pfStock = periodFilter('sale_date', period)

    // Total stock units & product count
    const stockRes = await pool.query(
      `SELECT COALESCE(SUM(quantity), 0) AS total_stock,
              COUNT(*) AS product_count,
              COALESCE(SUM(quantity * purchase_price), 0) AS inventory_value
       FROM products`
    )

    // Low stock items
    const lowRes = await pool.query(
      `SELECT id, brand, article_number, size, color, quantity, low_stock_threshold
       FROM products
       WHERE quantity <= low_stock_threshold
       ORDER BY quantity ASC
       LIMIT 10`
    )

    // Period revenue & invoice count
    const revenueRes = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS period_revenue,
              COUNT(*) AS period_invoices
       FROM sales s
       WHERE 1=1 ${pf}`
    )

    // Today revenue & invoices
    const todayRes = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS today_revenue,
              COUNT(*) AS today_invoices
       FROM sales
       WHERE sale_date = CURRENT_DATE`
    )

    // Month revenue
    const monthRes = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS month_revenue,
              COUNT(*) AS month_invoices
       FROM sales
       WHERE sale_date >= DATE_TRUNC('month', CURRENT_DATE)`
    )

    // Units sold in period
    const unitsRes = await pool.query(
      `SELECT COALESCE(SUM(si.quantity), 0) AS units_sold
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE 1=1 ${pf}`
    )

    // Brand revenue in period
    const brandRes = await pool.query(
      `SELECT si.brand, COALESCE(SUM(si.total_price), 0) AS revenue
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE 1=1 ${pf}
       GROUP BY si.brand
       ORDER BY revenue DESC
       LIMIT 10`
    )

    // Payment mode breakdown in period
    const payRes = await pool.query(
      `SELECT payment_mode,
              COALESCE(SUM(total_amount), 0) AS revenue,
              COUNT(*) AS count
       FROM sales s
       WHERE 1=1 ${pf}
       GROUP BY payment_mode
       ORDER BY revenue DESC`
    )

    // Recent sales (always last 5 regardless of period)
    const recentRes = await pool.query(
      `SELECT id, invoice_number, customer_name, customer_phone,
              total_amount, payment_mode, sale_date
       FROM sales
       ORDER BY created_at DESC
       LIMIT 5`
    )

    // Category breakdown (stock)
    const catRes = await pool.query(
      `SELECT category, SUM(quantity) AS total_qty
       FROM products
       GROUP BY category
       ORDER BY total_qty DESC`
    )

    const s = stockRes.rows[0]
    const r = revenueRes.rows[0]
    const t = todayRes.rows[0]
    const m = monthRes.rows[0]

    res.json({
      // Stock
      totalStock:        parseInt(s.total_stock),
      productCount:      parseInt(s.product_count),
      inventoryValue:    parseFloat(s.inventory_value),
      lowStockCount:     lowRes.rows.length,
      lowStockItems:     lowRes.rows,
      categoryBreakdown: catRes.rows,
      // Period
      periodRevenue:     parseFloat(r.period_revenue),
      periodInvoices:    parseInt(r.period_invoices),
      unitsSold:         parseInt(unitsRes.rows[0].units_sold),
      // Today
      todayRevenue:      parseFloat(t.today_revenue),
      todayInvoices:     parseInt(t.today_invoices),
      // Month
      monthRevenue:      parseFloat(m.month_revenue),
      monthInvoices:     parseInt(m.month_invoices),
      // Charts
      brandRevenue:      brandRes.rows.map(r => ({ brand: r.brand, revenue: parseFloat(r.revenue) })),
      paymentBreakdown:  payRes.rows.map(r => ({ payment_mode: r.payment_mode, revenue: parseFloat(r.revenue), count: parseInt(r.count) })),
      // Recent
      recentSales:       recentRes.rows,
    })
  } catch (err) {
    console.error('Dashboard error:', err)
    res.status(500).json({ error: 'Failed to load dashboard data.' })
  }
})

// GET /api/reports/monthly — monthly revenue for last 12 months (for chart)
router.get('/monthly', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT TO_CHAR(sale_date, 'Mon YY') AS month,
              DATE_TRUNC('month', sale_date) AS month_start,
              COALESCE(SUM(total_amount), 0) AS revenue,
              COUNT(*) AS invoices,
              COALESCE(SUM(si.qty), 0) AS units
       FROM sales s
       LEFT JOIN (
         SELECT sale_id, SUM(quantity) AS qty FROM sale_items GROUP BY sale_id
       ) si ON si.sale_id = s.id
       WHERE sale_date >= CURRENT_DATE - INTERVAL '12 months'
       GROUP BY month_start, TO_CHAR(sale_date, 'Mon YY')
       ORDER BY month_start ASC`
    )
    res.json(rows.map(r => ({
      month:    r.month,
      revenue:  parseFloat(r.revenue),
      invoices: parseInt(r.invoices),
      units:    parseInt(r.units),
    })))
  } catch (err) {
    console.error('Monthly report error:', err)
    res.status(500).json({ error: 'Failed to load monthly report.' })
  }
})

// GET /api/reports/top-products — top selling products
router.get('/top-products', async (req, res) => {
  try {
    const { limit = 10 } = req.query
    const { rows } = await pool.query(
      `SELECT si.brand, si.article_number, si.color, si.size,
              SUM(si.quantity) AS units_sold,
              SUM(si.total_price) AS revenue
       FROM sale_items si
       GROUP BY si.brand, si.article_number, si.color, si.size
       ORDER BY units_sold DESC
       LIMIT $1`,
      [parseInt(limit)]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Failed to load top products.' })
  }
})

export default router
