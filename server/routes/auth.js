import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import pool from '../db.js'

const router = Router()

// Check if first-run setup is needed
router.get('/setup-status', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT COUNT(*) FROM users')
    res.json({ setupRequired: parseInt(rows[0].count) === 0 })
  } catch {
    res.json({ setupRequired: true })
  }
})

// First-run setup: create owner account + shop settings
router.post('/setup', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT COUNT(*) FROM users')
    if (parseInt(rows[0].count) > 0) {
      return res.status(400).json({ error: 'Setup already completed. Please log in.' })
    }

    const { username, password, shopName, ownerName, phone, address, gstin } = req.body
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' })
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' })

    const passwordHash = await bcrypt.hash(password, 12)
    await pool.query(
      'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)',
      [username.trim().toLowerCase(), passwordHash, 'owner']
    )

    // Update shop settings
    await pool.query(
      `UPDATE shop_settings SET shop_name=$1, owner_name=$2, phone=$3, address=$4, gstin=$5 WHERE id=1`,
      [shopName || 'Khatri Footwear', ownerName || 'Bhavarlal Khatri', phone || '', address || '', gstin || '']
    )

    res.json({ message: 'Setup complete. You can now log in.' })
  } catch (err) {
    console.error('Setup error:', err)
    res.status(500).json({ error: 'Setup failed. Please try again.' })
  }
})

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' })

    const { rows } = await pool.query('SELECT * FROM users WHERE username=$1', [username.trim().toLowerCase()])
    if (!rows.length) return res.status(401).json({ error: 'Invalid username or password.' })

    const user = rows[0]
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Invalid username or password.' })

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    )

    res.json({ token, user: { id: user.id, username: user.username, role: user.role } })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Login failed. Please try again.' })
  }
})

// Get current user
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Not authenticated.' })
    const token = authHeader.slice(7)
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const { rows } = await pool.query('SELECT id, username, role FROM users WHERE id=$1', [decoded.id])
    if (!rows.length) return res.status(401).json({ error: 'User not found.' })
    res.json(rows[0])
  } catch {
    res.status(401).json({ error: 'Session expired.' })
  }
})

export default router
