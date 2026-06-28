import { Router } from 'express'
import bcrypt from 'bcryptjs'
import pool from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

// GET /api/shop-settings
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM shop_settings WHERE id = 1')
    if (!rows.length) return res.status(404).json({ error: 'Shop settings not found.' })
    // Never send the password hash to the frontend
    const { report_password_hash, ...safe } = rows[0]
    safe.has_report_password = !!report_password_hash
    res.json(safe)
  } catch (err) {
    console.error('Shop settings GET error:', err)
    res.status(500).json({ error: 'Failed to load shop settings.' })
  }
})

// PATCH /api/shop-settings — update shop info and optionally set report password
router.patch('/', async (req, res) => {
  try {
    const {
      shop_name, owner_name, address, phone, gstin,
      invoice_prefix, default_tax_pct,
      report_password  // new plain-text report password from settings form
    } = req.body

    let passwordUpdate = ''
    const params = [shop_name, owner_name, address, phone, gstin, invoice_prefix, default_tax_pct]

    if (report_password && report_password.trim().length >= 4) {
      const hash = await bcrypt.hash(report_password.trim(), 12)
      params.push(hash)
      passwordUpdate = `, report_password_hash = $${params.length}`
    }

    const { rows } = await pool.query(
      `UPDATE shop_settings SET
        shop_name       = COALESCE($1, shop_name),
        owner_name      = COALESCE($2, owner_name),
        address         = COALESCE($3, address),
        phone           = COALESCE($4, phone),
        gstin           = COALESCE($5, gstin),
        invoice_prefix  = COALESCE($6, invoice_prefix),
        default_tax_pct = COALESCE($7, default_tax_pct)
        ${passwordUpdate},
        updated_at      = NOW()
       WHERE id = 1
       RETURNING *`,
      params
    )

    if (!rows.length) return res.status(404).json({ error: 'Shop settings not found.' })
    const { report_password_hash, ...safe } = rows[0]
    safe.has_report_password = !!report_password_hash
    res.json(safe)
  } catch (err) {
    console.error('Shop settings PATCH error:', err)
    res.status(500).json({ error: 'Failed to update shop settings.' })
  }
})

// POST /api/shop-settings/verify-report-password
// Frontend calls this to unlock the Reports page
router.post('/verify-report-password', async (req, res) => {
  try {
    const { password } = req.body
    if (!password) return res.status(400).json({ error: 'Password is required.' })

    const { rows } = await pool.query('SELECT report_password_hash FROM shop_settings WHERE id = 1')
    if (!rows.length) return res.status(404).json({ error: 'Settings not found.' })

    const hash = rows[0].report_password_hash
    if (!hash) {
      // No report password set — allow access
      return res.json({ verified: true, message: 'No report password configured.' })
    }

    const valid = await bcrypt.compare(password, hash)
    if (!valid) return res.status(401).json({ error: 'Incorrect report password.' })

    res.json({ verified: true })
  } catch (err) {
    console.error('Report password verify error:', err)
    res.status(500).json({ error: 'Verification failed.' })
  }
})

export default router
