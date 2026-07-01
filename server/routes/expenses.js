import { Router } from 'express'
import pool from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

// GET /api/expenses — list expenses with period filter
router.get('/', async (req, res) => {
  try {
    const { period = 'today' } = req.query
    let dateFilter = ''
    if (period === 'today') dateFilter = `WHERE expense_date = CURRENT_DATE`
    else if (period === 'week')  dateFilter = `WHERE expense_date >= CURRENT_DATE - INTERVAL '7 days'`
    else if (period === 'month') dateFilter = `WHERE expense_date >= DATE_TRUNC('month', CURRENT_DATE)`
    else if (period === 'year')  dateFilter = `WHERE expense_date >= DATE_TRUNC('year', CURRENT_DATE)`

    const { rows } = await pool.query(
      `SELECT * FROM daily_expenses ${dateFilter} ORDER BY expense_date DESC, created_at DESC`
    )
    const total = rows.reduce((a, r) => a + parseFloat(r.amount), 0)
    res.json({ expenses: rows, total })
  } catch (err) {
    console.error('Expenses GET error:', err)
    res.status(500).json({ error: 'Failed to load expenses.' })
  }
})

// POST /api/expenses — add a new expense entry
router.post('/', async (req, res) => {
  try {
    const { amount, reason, expense_date } = req.body
    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Please enter a valid amount.' })
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Please enter a reason for this expense.' })
    }

    const { rows } = await pool.query(
      `INSERT INTO daily_expenses (expense_date, amount, reason)
       VALUES ($1, $2, $3) RETURNING *`,
      [expense_date || new Date().toISOString().split('T')[0], parseFloat(amount), reason.trim()]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error('Expenses POST error:', err)
    res.status(500).json({ error: 'Failed to add expense.' })
  }
})

// DELETE /api/expenses/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM daily_expenses WHERE id=$1 RETURNING id', [req.params.id])
    if (!rows.length) return res.status(404).json({ error: 'Expense not found.' })
    res.json({ message: 'Expense removed.' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete expense.' })
  }
})

export default router
