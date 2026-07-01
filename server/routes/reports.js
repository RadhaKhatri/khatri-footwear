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
function expensePeriodFilter(period) {
  switch (period) {
    case 'today': return `WHERE expense_date = CURRENT_DATE`
    case 'week':  return `WHERE expense_date >= CURRENT_DATE - INTERVAL '7 days'`
    case 'month': return `WHERE expense_date >= DATE_TRUNC('month', CURRENT_DATE)`
    case 'year':  return `WHERE expense_date >= DATE_TRUNC('year', CURRENT_DATE)`
    default:      return `WHERE expense_date >= DATE_TRUNC('month', CURRENT_DATE)`
  }
}

/*
  ╔══════════════════════════════════════════════════════════════════╗
  ║  PROFIT & LOSS LOGIC                                              ║
  ║                                                                   ║
  ║  Revenue  = sales.total_amount  (actual money received,           ║
  ║             after discount and tax — NOT the listed price)        ║
  ║  Cost     = sale_items.purchase_price × quantity                  ║
  ║             (captured from product cost at billing time)          ║
  ║  Profit   = Revenue − Cost              (shop trading profit)     ║
  ║  Net Take-Home = Profit − Owner's Personal/Daily Expenses         ║
  ║             (money owner actually keeps after spending some       ║
  ║              of the day's earnings on personal/business needs)   ║
  ╚══════════════════════════════════════════════════════════════════╝
*/

function plQuery(whereClause) {
  return `
    SELECT
      COALESCE(SUM(s.total_amount), 0)                              AS actual_revenue,
      COALESCE(SUM(si.purchase_price * si.quantity), 0)             AS total_cost,
      COALESCE(SUM(s.total_amount) - SUM(si.purchase_price * si.quantity), 0) AS gross_profit
    FROM sales s
    JOIN sale_items si ON si.sale_id = s.id
    WHERE 1=1 ${whereClause}
  `
}

function productPLQuery(whereClause) {
  return `
    SELECT
      si.brand, si.article_number, si.size, si.color,
      SUM(si.quantity) AS units_sold,
      COALESCE(SUM(
        CASE WHEN s.subtotal_amount > 0
             THEN (si.total_price / s.subtotal_amount) * s.total_amount
             ELSE si.total_price END
      ), 0) AS actual_revenue,
      COALESCE(SUM(si.purchase_price * si.quantity), 0) AS total_cost,
      COALESCE(SUM(
        CASE WHEN s.subtotal_amount > 0
             THEN (si.total_price / s.subtotal_amount) * s.total_amount
             ELSE si.total_price END
      ) - SUM(si.purchase_price * si.quantity), 0) AS gross_profit
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE 1=1 ${whereClause}
    GROUP BY si.brand, si.article_number, si.size, si.color
    ORDER BY gross_profit DESC
    LIMIT 15
  `
}

// Invoice-wise profit — each invoice's actual revenue, cost, and profit
function invoiceWisePLQuery(whereClause) {
  return `
    SELECT
      s.id,
      s.invoice_number,
      s.customer_name,
      s.customer_phone,
      s.payment_mode,
      s.sale_date,
      s.total_amount                                       AS revenue,
      COALESCE(SUM(si.purchase_price * si.quantity), 0)     AS cost,
      s.total_amount - COALESCE(SUM(si.purchase_price * si.quantity), 0) AS profit,
      COUNT(si.id)                                          AS item_count
    FROM sales s
    LEFT JOIN sale_items si ON si.sale_id = s.id
    WHERE 1=1 ${whereClause}
    GROUP BY s.id, s.invoice_number, s.customer_name, s.customer_phone, s.payment_mode, s.sale_date, s.total_amount
    ORDER BY s.created_at DESC
  `
}

// GET /api/reports/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const { period = 'month' } = req.query
    const pf      = periodFilter('s.sale_date', period)
    const pfToday = `AND s.sale_date = CURRENT_DATE`
    const pfMonth = `AND s.sale_date >= DATE_TRUNC('month', CURRENT_DATE)`
    const pfYear  = `AND s.sale_date >= DATE_TRUNC('year', CURRENT_DATE)`

    const stockRes = await pool.query(
      `SELECT
         COALESCE(SUM(quantity), 0)                   AS total_stock,
         COUNT(*)                                       AS product_count,
         COALESCE(SUM(quantity * purchase_price), 0)   AS inventory_value
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
      `SELECT si.brand,
              COALESCE(SUM(
                CASE WHEN s.subtotal_amount > 0
                     THEN (si.total_price / s.subtotal_amount) * s.total_amount
                     ELSE si.total_price END
              ), 0) AS revenue
       FROM sale_items si JOIN sales s ON s.id = si.sale_id
       WHERE 1=1 ${pf}
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

    const [plPeriod, plToday, plMonth, plYear, plProducts, invoiceWise] = await Promise.all([
      pool.query(plQuery(pf)),
      pool.query(plQuery(pfToday)),
      pool.query(plQuery(pfMonth)),
      pool.query(plQuery(pfYear)),
      pool.query(productPLQuery(pf)),
      pool.query(invoiceWisePLQuery(pf)),
    ])

    // ── Daily / personal expenses ──────────────────────────────────────────
    const [expPeriod, expToday, expMonth, expYear] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(amount),0) AS total FROM daily_expenses ${expensePeriodFilter(period)}`),
      pool.query(`SELECT COALESCE(SUM(amount),0) AS total FROM daily_expenses WHERE expense_date = CURRENT_DATE`),
      pool.query(`SELECT COALESCE(SUM(amount),0) AS total FROM daily_expenses WHERE expense_date >= DATE_TRUNC('month', CURRENT_DATE)`),
      pool.query(`SELECT COALESCE(SUM(amount),0) AS total FROM daily_expenses WHERE expense_date >= DATE_TRUNC('year', CURRENT_DATE)`),
    ])

    const sk = stockRes.rows[0]
    const rv = revenueRes.rows[0]
    const td = todayRes.rows[0]
    const mn = monthRes.rows[0]

    const mapPL = (r, expRow) => {
      const profit = parseFloat(r.gross_profit)
      const expenses = parseFloat(expRow.total)
      return {
        revenue:        parseFloat(r.actual_revenue),
        cost:           parseFloat(r.total_cost),
        profit,
        expenses,
        netTakeHome:    profit - expenses,
      }
    }

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
      paymentBreakdown:  payRes.rows.map(r => ({
        payment_mode: r.payment_mode, revenue: parseFloat(r.revenue), count: parseInt(r.count),
      })),
      recentSales: recentRes.rows,
      pl: {
        period:   mapPL(plPeriod.rows[0], expPeriod.rows[0]),
        today:    mapPL(plToday.rows[0],  expToday.rows[0]),
        month:    mapPL(plMonth.rows[0],  expMonth.rows[0]),
        year:     mapPL(plYear.rows[0],   expYear.rows[0]),
        products: plProducts.rows.map(r => ({
          brand: r.brand, article_number: r.article_number, size: r.size, color: r.color,
          units_sold: parseInt(r.units_sold),
          revenue: parseFloat(r.actual_revenue), cost: parseFloat(r.total_cost), profit: parseFloat(r.gross_profit),
        })),
        invoiceWise: invoiceWise.rows.map(r => ({
          id: r.id, invoice_number: r.invoice_number,
          customer_name: r.customer_name, customer_phone: r.customer_phone,
          payment_mode: r.payment_mode, sale_date: r.sale_date,
          item_count: parseInt(r.item_count),
          revenue: parseFloat(r.revenue), cost: parseFloat(r.cost), profit: parseFloat(r.profit),
        })),
      },
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
      `SELECT
         TO_CHAR(s.sale_date, 'Mon YY')          AS month,
         DATE_TRUNC('month', s.sale_date)         AS month_start,
         COALESCE(SUM(s.total_amount), 0)         AS revenue,
         COALESCE(SUM(si.purchase_price * si.quantity), 0) AS cost,
         COUNT(DISTINCT s.id)                     AS invoices
       FROM sales s
       LEFT JOIN sale_items si ON si.sale_id = s.id
       WHERE s.sale_date >= CURRENT_DATE - INTERVAL '12 months'
       GROUP BY month_start, TO_CHAR(s.sale_date, 'Mon YY')
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
      `SELECT
         si.brand, si.article_number, si.color, si.size,
         SUM(si.quantity) AS units_sold,
         COALESCE(SUM(
           CASE WHEN s.subtotal_amount > 0
                THEN (si.total_price / s.subtotal_amount) * s.total_amount
                ELSE si.total_price END
         ), 0) AS revenue
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
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
