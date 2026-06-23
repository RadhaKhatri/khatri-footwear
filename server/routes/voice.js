import { Router } from 'express'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

// POST /api/voice/process
// Takes a speech transcript and extracts structured stock data using Gemini
router.post('/process', async (req, res) => {
  try {
    const { transcript } = req.body
    if (!transcript || !transcript.trim()) {
      return res.status(400).json({ error: 'Transcript is empty.' })
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' })
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `You are an expert assistant for an Indian footwear retail shop called Khatri Footwear.
The shopkeeper has spoken the following text to add new stock items.
Extract all stock items mentioned and return ONLY a valid JSON array. No markdown, no explanation.

Each item must have these exact keys:
- brand: string (e.g. "Bata", "Liberty", "Sparx", "Nike", "Khadim")
- article_number: string (article/model code if mentioned, else generate one like "AUTO-001")
- category: string (one of: "Men", "Women", "Kids", "Sports", "Casual", "Formal") — guess from context
- size: string (UK shoe size, e.g. "7", "8", "9")
- color: string (colour if mentioned, else "Assorted")
- quantity: number (number of pairs)
- purchase_price: number (purchase/buying price in INR, numeric only, no ₹ symbol)
- selling_price: number (selling/MRP price in INR; if not mentioned use purchase_price * 1.5)
- vendor: string (vendor/supplier name if mentioned, else "")
- purchase_date: string (today's date in YYYY-MM-DD if not mentioned: ${new Date().toISOString().split('T')[0]})

Rules:
- If the shopkeeper says "bata article b-2341 size 8 black 12 pairs purchase 450 selling 750" → extract that exactly
- Handle Hindi-English mix naturally: "bata ka article", "size aath", "kala colour", "baara paise", etc.
- "kala" = Black, "safed" = White, "lal" = Red, "peela" = Yellow, "neela" = Blue, "gehra neela" = Dark Blue
- Numbers in Hindi: "ek"=1, "do"=2, "teen"=3, "char"=4, "paanch"=5, "chhe"=6, "saat"=7, "aath"=8, "nau"=9, "das"=10, "baara"=12, "pandrah"=15, "bees"=20
- "rupaye", "rupees", "rs", "₹" all mean INR price
- Return [] if no valid stock items can be identified

Transcript: "${transcript.trim()}"`

    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const clean = text.replace(/```json|```/g, '').trim()

    let items
    try {
      items = JSON.parse(clean)
      if (!Array.isArray(items)) items = [items]
    } catch {
      return res.status(422).json({
        error: 'Could not extract structured data from the transcript. Please try speaking more clearly or use manual entry.',
        raw: clean
      })
    }

    if (!items.length) {
      return res.status(422).json({
        error: 'No stock items found in the transcript. Please mention brand, size, quantity, and price.',
      })
    }

    res.json(items)
  } catch (err) {
    console.error('Voice processing error:', err)
    res.status(500).json({ error: 'Voice processing failed. Please check your Gemini API key.' })
  }
})

export default router
