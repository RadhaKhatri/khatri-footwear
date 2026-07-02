import { Router } from 'express'
import multer from 'multer'
import { v2 as cloudinary } from 'cloudinary'
import pool from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg','image/png','image/webp','image/jpg','application/pdf']
    ok.includes(file.mimetype) ? cb(null, true) : cb(new Error('Only JPG, PNG, PDF allowed.'))
  },
})

async function uploadImage(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'khatri-footwear/vendor-bills', resource_type: 'auto', public_id: `bill-${Date.now()}` },
      (err, result) => err ? reject(err) : resolve(result)
    )
    stream.end(buffer)
  })
}

// ── Helper: compute running totals for a purchase ──────────────────────────────
// total_paid  = initial paid_amount + sum of all vendor_payments
// remaining   = total_amount - total_paid
async function getPurchaseWithTotals(id, client = pool) {
  const { rows } = await client.query(
    `SELECT
       vp.*,
       v.name AS vendor_name,
       v.phone AS vendor_phone,
       COALESCE(SUM(pay.amount), 0) AS extra_paid,
       vp.paid_amount + COALESCE(SUM(pay.amount), 0) AS total_paid,
       vp.total_amount - vp.paid_amount - COALESCE(SUM(pay.amount), 0) AS remaining
     FROM vendor_purchases vp
     JOIN vendors v ON v.id = vp.vendor_id
     LEFT JOIN vendor_payments pay ON pay.purchase_id = vp.id
     WHERE vp.id = $1
     GROUP BY vp.id, v.name, v.phone`,
    [id]
  )
  return rows[0] || null
}

// ════════════════════════════════════════════════════════════════════════════════
// VENDOR CRUD
// ════════════════════════════════════════════════════════════════════════════════

// GET /api/vendor-purchases/vendors — list all vendors
router.get('/vendors', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT v.*,
              COUNT(vp.id)                             AS purchase_count,
              COALESCE(SUM(vp.total_amount), 0)        AS total_purchased,
              COALESCE(SUM(vp.paid_amount)
                + (SELECT COALESCE(SUM(pay.amount),0)
                   FROM vendor_payments pay
                   JOIN vendor_purchases vp2 ON vp2.id = pay.purchase_id
                   WHERE vp2.vendor_id = v.id), 0)     AS total_paid,
              COALESCE(SUM(vp.total_amount), 0)
                - COALESCE(SUM(vp.paid_amount)
                + (SELECT COALESCE(SUM(pay.amount),0)
                   FROM vendor_payments pay
                   JOIN vendor_purchases vp2 ON vp2.id = pay.purchase_id
                   WHERE vp2.vendor_id = v.id), 0)     AS total_remaining
       FROM vendors v
       LEFT JOIN vendor_purchases vp ON vp.vendor_id = v.id
       GROUP BY v.id
       ORDER BY total_remaining DESC, v.name ASC`
    )
    res.json(rows)
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Failed to fetch vendors.' })
  }
})

// POST /api/vendor-purchases/vendors — add vendor
router.post('/vendors', async (req, res) => {
  try {
    const { name, phone, address } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Vendor name is required.' })
    const { rows } = await pool.query(
      `INSERT INTO vendors (name, phone, address) VALUES ($1,$2,$3) RETURNING *`,
      [name.trim(), phone?.trim() || '', address?.trim() || '']
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Failed to add vendor.' })
  }
})

// PATCH /api/vendor-purchases/vendors/:id — edit vendor
router.patch('/vendors/:id', async (req, res) => {
  try {
    const { name, phone, address } = req.body
    const { rows } = await pool.query(
      `UPDATE vendors SET name=COALESCE($1,name), phone=COALESCE($2,phone), address=COALESCE($3,address)
       WHERE id=$4 RETURNING *`,
      [name, phone, address, req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Vendor not found.' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Failed to update vendor.' })
  }
})

// DELETE /api/vendor-purchases/vendors/:id
router.delete('/vendors/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM vendors WHERE id=$1', [req.params.id])
    res.json({ message: 'Vendor deleted.' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete vendor.' })
  }
})

// ════════════════════════════════════════════════════════════════════════════════
// PURCHASE LEDGER
// ════════════════════════════════════════════════════════════════════════════════

// GET /api/vendor-purchases — all purchases with payment totals, daily summary
router.get('/', async (req, res) => {
  try {
    const { vendor_id, date } = req.query

    let where = 'WHERE 1=1'
    const params = []
    if (vendor_id) { params.push(vendor_id); where += ` AND vp.vendor_id = $${params.length}` }
    if (date)       { params.push(date);      where += ` AND vp.purchase_date = $${params.length}` }

    const { rows } = await pool.query(
      `SELECT
         vp.*,
         v.name                                     AS vendor_name,
         v.phone                                    AS vendor_phone,
         COALESCE(SUM(pay.amount), 0)               AS extra_paid,
         vp.paid_amount + COALESCE(SUM(pay.amount), 0) AS total_paid,
         vp.total_amount - vp.paid_amount - COALESCE(SUM(pay.amount), 0) AS remaining
       FROM vendor_purchases vp
       JOIN vendors v ON v.id = vp.vendor_id
       LEFT JOIN vendor_payments pay ON pay.purchase_id = vp.id
       ${where}
       GROUP BY vp.id, v.name, v.phone
       ORDER BY vp.purchase_date DESC, vp.created_at DESC`,
      params
    )

    // Today's summary
    const todayRes = await pool.query(
      `SELECT
         COALESCE(SUM(vp.total_amount), 0)              AS today_total,
         COALESCE(SUM(vp.paid_amount)
           + COALESCE((SELECT SUM(pay.amount) FROM vendor_payments pay
                       JOIN vendor_purchases vp2 ON vp2.id=pay.purchase_id
                       WHERE vp2.purchase_date=CURRENT_DATE AND pay.payment_date=CURRENT_DATE), 0), 0) AS today_paid
       FROM vendor_purchases vp
       WHERE vp.purchase_date = CURRENT_DATE`
    )

    // Grand totals (all time)
    const grandRes = await pool.query(
      `SELECT
         COALESCE(SUM(vp.total_amount), 0)   AS grand_total,
         COALESCE(SUM(vp.paid_amount)
           + (SELECT COALESCE(SUM(pay.amount),0) FROM vendor_payments pay), 0) AS grand_paid,
         COALESCE(SUM(vp.total_amount), 0)
           - COALESCE(SUM(vp.paid_amount)
           + (SELECT COALESCE(SUM(pay.amount),0) FROM vendor_payments pay), 0) AS grand_remaining
       FROM vendor_purchases vp`
    )

    const t = todayRes.rows[0]
    const g = grandRes.rows[0]

    res.json({
      purchases: rows,
      summary: {
        today_total:     parseFloat(t.today_total),
        today_paid:      parseFloat(t.today_paid),
        today_remaining: parseFloat(t.today_total) - parseFloat(t.today_paid),
        grand_total:     parseFloat(g.grand_total),
        grand_paid:      parseFloat(g.grand_paid),
        grand_remaining: parseFloat(g.grand_remaining),
      },
    })
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Failed to fetch purchases.' })
  }
})

// POST /api/vendor-purchases — add a new purchase entry (with optional bill image)
router.post('/', upload.single('bill_image'), async (req, res) => {
  try {
    const { vendor_id, purchase_date, total_amount, paid_amount = 0, notes } = req.body
    if (!vendor_id)     return res.status(400).json({ error: 'Vendor is required.' })
    if (!total_amount || parseFloat(total_amount) <= 0)
      return res.status(400).json({ error: 'Total amount must be greater than 0.' })

    const paid = Math.min(parseFloat(paid_amount) || 0, parseFloat(total_amount))

    // Upload bill image to Cloudinary if provided
    let imageUrl = null, imagePublicId = null
    if (req.file) {
      try {
        const result = await uploadImage(req.file.buffer)
        imageUrl      = result.secure_url
        imagePublicId = result.public_id
      } catch (e) {
        console.error('Image upload error:', e.message)
        // Don't fail the whole request — just save without image
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO vendor_purchases
         (vendor_id, purchase_date, total_amount, paid_amount, notes, bill_image_url, bill_image_public_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        parseInt(vendor_id),
        purchase_date || new Date().toISOString().split('T')[0],
        parseFloat(total_amount),
        paid,
        notes?.trim() || '',
        imageUrl,
        imagePublicId,
      ]
    )

    const purchase = await getPurchaseWithTotals(rows[0].id)
    res.status(201).json(purchase)
  } catch (err) {
    console.error(err); res.status(500).json({ error: err.message || 'Failed to add purchase.' })
  }
})

// PATCH /api/vendor-purchases/:id/image — attach or replace bill image
router.patch('/:id/image', upload.single('bill_image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded.' })

    // Delete old image from Cloudinary if exists
    const existing = await pool.query('SELECT bill_image_public_id FROM vendor_purchases WHERE id=$1', [req.params.id])
    if (existing.rows[0]?.bill_image_public_id) {
      try { await cloudinary.uploader.destroy(existing.rows[0].bill_image_public_id) } catch {}
    }

    const result = await uploadImage(req.file.buffer)
    await pool.query(
      `UPDATE vendor_purchases SET bill_image_url=$1, bill_image_public_id=$2, updated_at=NOW() WHERE id=$3`,
      [result.secure_url, result.public_id, req.params.id]
    )
    const purchase = await getPurchaseWithTotals(req.params.id)
    res.json(purchase)
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Failed to upload image.' })
  }
})

// DELETE /api/vendor-purchases/:id
router.delete('/:id', async (req, res) => {
  try {
    // Delete Cloudinary image if exists
    const { rows } = await pool.query('SELECT bill_image_public_id FROM vendor_purchases WHERE id=$1', [req.params.id])
    if (rows[0]?.bill_image_public_id) {
      try { await cloudinary.uploader.destroy(rows[0].bill_image_public_id) } catch {}
    }
    await pool.query('DELETE FROM vendor_purchases WHERE id=$1', [req.params.id])
    res.json({ message: 'Purchase deleted.' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete purchase.' })
  }
})

// ════════════════════════════════════════════════════════════════════════════════
// PAYMENTS against a purchase
// ════════════════════════════════════════════════════════════════════════════════

// GET /api/vendor-purchases/:id/payments — list all payments for a purchase
router.get('/:id/payments', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM vendor_payments WHERE purchase_id=$1 ORDER BY payment_date ASC, created_at ASC`,
      [req.params.id]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payments.' })
  }
})

// POST /api/vendor-purchases/:id/payments — add a payment against a purchase
router.post('/:id/payments', async (req, res) => {
  try {
    const { amount, payment_date, note } = req.body
    if (!amount || parseFloat(amount) <= 0)
      return res.status(400).json({ error: 'Please enter a valid payment amount.' })

    // Guard: don't allow paying more than remaining
    const purchase = await getPurchaseWithTotals(req.params.id)
    if (!purchase) return res.status(404).json({ error: 'Purchase not found.' })
    if (parseFloat(amount) > parseFloat(purchase.remaining)) {
      return res.status(400).json({
        error: `Payment ₹${amount} exceeds remaining amount ₹${purchase.remaining}.`
      })
    }

    await pool.query(
      `INSERT INTO vendor_payments (purchase_id, payment_date, amount, note) VALUES ($1,$2,$3,$4)`,
      [req.params.id, payment_date || new Date().toISOString().split('T')[0], parseFloat(amount), note?.trim() || '']
    )

    // Return updated purchase with new totals
    const updated = await getPurchaseWithTotals(req.params.id)
    res.status(201).json(updated)
  } catch (err) {
    console.error(err); res.status(500).json({ error: err.message || 'Failed to add payment.' })
  }
})

// DELETE /api/vendor-purchases/payments/:paymentId
router.delete('/payments/:paymentId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM vendor_payments WHERE id=$1 RETURNING purchase_id',
      [req.params.paymentId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Payment not found.' })
    const updated = await getPurchaseWithTotals(rows[0].purchase_id)
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete payment.' })
  }
})

export default router
