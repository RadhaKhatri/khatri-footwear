import { Router } from 'express'
import pool from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

// GET /api/shop-settings
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM shop_settings WHERE id = 1')
    if (!rows.length) return res.status(404).json({ error: 'Shop settings not found.' })
    res.json(rows[0])
  } catch (err) {
    console.error('Shop settings GET error:', err)
    res.status(500).json({ error: 'Failed to load shop settings.' })
  }
})

// PATCH /api/shop-settings
router.patch('/', async (req, res) => {
  try {
    const {
      shop_name, owner_name, address, phone, gstin,
      invoice_prefix, default_tax_pct
    } = req.body

    const { rows } = await pool.query(
      `UPDATE shop_settings SET
        shop_name       = COALESCE($1, shop_name),
        owner_name      = COALESCE($2, owner_name),
        address         = COALESCE($3, address),
        phone           = COALESCE($4, phone),
        gstin           = COALESCE($5, gstin),
        invoice_prefix  = COALESCE($6, invoice_prefix),
        default_tax_pct = COALESCE($7, default_tax_pct),
        updated_at      = NOW()
       WHERE id = 1
       RETURNING *`,
      [shop_name, owner_name, address, phone, gstin, invoice_prefix, default_tax_pct]
    )

    if (!rows.length) return res.status(404).json({ error: 'Shop settings not found.' })
    res.json(rows[0])
  } catch (err) {
    console.error('Shop settings PATCH error:', err)
    res.status(500).json({ error: 'Failed to update shop settings.' })
  }
})

export default router
