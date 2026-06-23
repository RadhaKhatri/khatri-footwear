import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

// POST /api/voice/process
router.post('/process', async (req, res) => {
  try {
    const { transcript } = req.body
    if (!transcript || !transcript.trim()) {
      return res.status(400).json({ error: 'Transcript is empty.' })
    }
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' })
    }

    // Use fetch directly — avoids SDK version mismatch issues on Render
    const prompt = `You are an expert assistant for an Indian footwear retail shop called Khatri Footwear.
The shopkeeper has spoken the following text to add new stock items.
Extract all stock items mentioned and return ONLY a valid JSON array. No markdown, no explanation, no code block.

Each item must have these exact keys:
- brand: string (e.g. "Bata", "Liberty", "Sparx", "Nike", "Khadim", "Paragon")
- article_number: string (article/model code if mentioned, else "AUTO-001")
- category: string (one of: "Men", "Women", "Kids", "Sports", "Casual", "Formal")
- size: string (UK shoe size e.g. "7", "8", "9")
- color: string (colour if mentioned, else "Assorted")
- quantity: number (number of pairs)
- purchase_price: number (purchase price in INR, number only)
- selling_price: number (MRP in INR; if not mentioned use purchase_price * 1.5)
- vendor: string (vendor name if mentioned, else "")
- purchase_date: string ("${new Date().toISOString().split('T')[0]}")

Hindi/English rules:
- "kala"=Black, "safed"=White, "lal"=Red, "neela"=Blue, "peela"=Yellow, "hara"=Green
- "ek"=1,"do"=2,"teen"=3,"char"=4,"paanch"=5,"chhe"=6,"saat"=7,"aath"=8,"nau"=9,"das"=10,"baara"=12,"pandrah"=15,"bees"=20
- "rupaye","rupees","rs","₹" all mean INR price
- "size aath" = size 8, "size das" = size 10
- Return [] if no valid stock items found

Transcript: "${transcript.trim().replace(/"/g, "'")}"
`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
        })
      }
    )

    if (!response.ok) {
      const errText = await response.text()
      console.error('Gemini API error:', errText)
      return res.status(500).json({ error: 'Gemini API call failed. Check your GEMINI_API_KEY on Render.' })
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
    const clean = text.replace(/```json|```/g, '').trim()

    let items
    try {
      items = JSON.parse(clean)
      if (!Array.isArray(items)) items = [items]
    } catch {
      return res.status(422).json({
        error: 'Could not parse AI response. Please speak more clearly or use manual entry.',
        raw: clean
      })
    }

    if (!items.length) {
      return res.status(422).json({ error: 'No stock items found. Please mention brand, size, quantity and price.' })
    }

    res.json(items)
  } catch (err) {
    console.error('Voice processing error:', err.message)
    res.status(500).json({ error: `Voice processing failed: ${err.message}` })
  }
})

export default router
