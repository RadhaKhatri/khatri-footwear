import { Router } from 'express'
import pool from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

// GET /api/products — list with search, filter, pagination
router.get('/', async (req, res) => {
  try {
    const { search, category, page = 1, limit = 15 } = req.query
    const offset = (parseInt(page) - 1) * parseInt(limit)
    const conditions = []
    const params = []

    if (search) {
      params.push(`%${search}%`)
      conditions.push(`(brand ILIKE $${params.length} OR article_number ILIKE $${params.length} OR color ILIKE $${params.length} OR vendor ILIKE $${params.length})`)
    }
    if (category && category !== 'All') {
      params.push(category)
      conditions.push(`category = $${params.length}`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const countRes = await pool.query(`SELECT COUNT(*) FROM products ${where}`, params)
    const total = parseInt(countRes.rows[0].count)

    params.push(parseInt(limit), offset)
    const { rows } = await pool.query(
      `SELECT * FROM products ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )

    res.json({ items: rows, total, page: parseInt(page), limit: parseInt(limit) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch stock.' })
  }
})

// POST /api/products — add new stock item
router.post('/', async (req, res) => {
  try {
    const {
      brand, article_number, category = 'Men', size, color,
      quantity, purchase_price, selling_price, vendor,
      purchase_date, low_stock_threshold = 3, remarks
    } = req.body

    if (!brand || !article_number || !size || !color) {
      return res.status(400).json({ error: 'Brand, article number, size, and colour are required.' })
    }

    const { rows } = await pool.query(
      `INSERT INTO products
        (brand, article_number, category, size, color, quantity, purchase_price, selling_price, vendor, purchase_date, low_stock_threshold, remarks)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [brand, article_number, category, size, color,
       parseInt(quantity) || 0, parseFloat(purchase_price) || 0, parseFloat(selling_price) || 0,
       vendor || '', purchase_date || new Date().toISOString().split('T')[0],
       parseInt(low_stock_threshold) || 3, remarks || '']
    )

    // Log stock movement
    await pool.query(
      `INSERT INTO stock_movements (product_id, movement_type, quantity, reference_type, note)
       VALUES ($1, 'in', $2, 'manual', 'Initial stock entry')`,
      [rows[0].id, parseInt(quantity) || 0]
    )

    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to add stock.' })
  }
})

// PATCH /api/products/:id — update stock item
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const {
      brand, article_number, category, size, color,
      quantity, purchase_price, selling_price, vendor,
      purchase_date, low_stock_threshold, remarks
    } = req.body

    const { rows } = await pool.query(
      `UPDATE products SET
        brand=$1, article_number=$2, category=$3, size=$4, color=$5,
        quantity=$6, purchase_price=$7, selling_price=$8, vendor=$9,
        purchase_date=$10, low_stock_threshold=$11, remarks=$12, updated_at=NOW()
       WHERE id=$13 RETURNING *`,
      [brand, article_number, category, size, color,
       parseInt(quantity) || 0, parseFloat(purchase_price) || 0, parseFloat(selling_price) || 0,
       vendor || '', purchase_date || null, parseInt(low_stock_threshold) || 3, remarks || '',
       parseInt(id)]
    )

    if (!rows.length) return res.status(404).json({ error: 'Product not found.' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update product.' })
  }
})

// DELETE /api/products/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM products WHERE id=$1 RETURNING id', [req.params.id])
    if (!rows.length) return res.status(404).json({ error: 'Product not found.' })
    res.json({ message: 'Product deleted.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to delete product.' })
  }
})

export default router
