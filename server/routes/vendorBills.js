import { Router } from 'express'
import multer from 'multer'
import { v2 as cloudinary } from 'cloudinary'
import pool from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf']
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Only JPG, PNG, WEBP, PDF allowed.'))
  }
})

async function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'khatri-footwear/vendor-bills', resource_type: 'auto', public_id: `bill-${Date.now()}` },
      (err, result) => err ? reject(err) : resolve(result)
    )
    stream.end(buffer)
  })
}

async function extractWithGemini(imageBuffer, mimeType) {
  // Use fetch directly to avoid SDK version issues on Render
  const base64 = imageBuffer.toString('base64')

  const prompt = `You are an expert at reading Indian footwear shop vendor bills and invoices.
Analyze this bill image and extract ALL footwear stock items listed.
Return ONLY a valid JSON array. No markdown, no explanation, just raw JSON.

Each item must have these exact keys:
- brand: string (shoe brand e.g. "Bata", "Liberty", "Paragon", "Sparx")
- article_number: string (article/model code from the bill)
- category: string (one of: "Men", "Women", "Kids", "Sports", "Casual", "Formal")
- size: string (shoe size e.g. "7", "8", "9")
- color: string ("Assorted" if not shown)
- quantity: number (qty purchased)
- purchase_price: number (price paid per pair in INR, number only)
- selling_price: number (MRP if shown; else purchase_price * 1.5)
- vendor: string (supplier company name from bill header)

Return [] if no footwear items found.`

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64 } }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
      })
    }
  )

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Gemini API error: ${errText}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}

// POST /api/vendor-bills/upload
router.post('/upload', upload.single('bill'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' })
    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured.' })

    // Upload to Cloudinary
    const cloudResult = await uploadToCloudinary(req.file.buffer)

    // Extract with Gemini
    let items = []
    let extractError = null
    try {
      items = await extractWithGemini(req.file.buffer, req.file.mimetype)
      if (!Array.isArray(items)) items = []
    } catch (err) {
      console.error('Gemini extraction error:', err.message)
      extractError = `AI extraction failed: ${err.message}. Please fill in the details manually.`
    }

    const vendorName = items[0]?.vendor || 'Unknown Vendor'
    const { rows } = await pool.query(
      `INSERT INTO vendor_bills (vendor_name, cloudinary_url, cloudinary_public_id, original_filename, extracted_items)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [vendorName, cloudResult.secure_url, cloudResult.public_id, req.file.originalname, JSON.stringify(items)]
    )

    res.json({ bill: rows[0], items, cloudinaryUrl: cloudResult.secure_url, warning: extractError })
  } catch (err) {
    console.error('Vendor bill upload error:', err.message)
    res.status(500).json({ error: err.message || 'Upload failed.' })
  }
})

// GET /api/vendor-bills
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM vendor_bills ORDER BY created_at DESC LIMIT 50')
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bills.' })
  }
})

export default router
