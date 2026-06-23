import { Router } from 'express'
import multer from 'multer'
import { v2 as cloudinary } from 'cloudinary'
import { GoogleGenerativeAI } from '@google/generative-ai'
import pool from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Multer - store in memory, then upload to Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf']
    if (allowed.includes(file.mimetype)) cb(null, true)
    else cb(new Error('Only JPG, PNG, WEBP, and PDF files are allowed.'))
  }
})

// Upload to Cloudinary helper
async function uploadToCloudinary(buffer, filename, mimetype) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'khatri-footwear/vendor-bills', resource_type: 'auto', public_id: `bill-${Date.now()}` },
      (err, result) => { if (err) reject(err); else resolve(result) }
    )
    uploadStream.end(buffer)
  })
}

// Extract stock data from image using Gemini
async function extractWithGemini(imageBuffer, mimeType) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const prompt = `You are an expert at reading Indian footwear shop vendor bills and invoices.
Analyze this bill image and extract ALL stock items listed.
Return ONLY a valid JSON array. No markdown, no explanation, just the JSON array.

Each item in the array must have these exact keys:
- brand: string (shoe brand name, e.g. "Bata", "Liberty", "Sparx")
- article_number: string (article/model code)
- category: string (must be one of: "Men", "Women", "Kids", "Sports", "Casual", "Formal")
- size: string (shoe size, e.g. "7", "8", "9-10")
- color: string (colour description)
- quantity: number (quantity purchased)
- purchase_price: number (price paid per pair in INR, numeric only)
- selling_price: number (if shown; otherwise estimate as purchase_price * 1.5)
- vendor: string (supplier/company name from the bill header)

If a field is not visible, use reasonable defaults:
- category: guess from brand/style (default "Men")
- color: "Assorted" if not shown
- selling_price: purchase_price * 1.5 if not shown

Return [] if no footwear items found.`

  const imagePart = {
    inlineData: { data: imageBuffer.toString('base64'), mimeType }
  }

  const result = await model.generateContent([prompt, imagePart])
  const text = result.response.text()
  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}

// POST /api/vendor-bills/upload
router.post('/upload', upload.single('bill'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' })

    // Upload to Cloudinary
    const cloudResult = await uploadToCloudinary(req.file.buffer, req.file.originalname, req.file.mimetype)

    // Extract with Gemini AI
    let items = []
    let extractError = null
    try {
      items = await extractWithGemini(req.file.buffer, req.file.mimetype)
      if (!Array.isArray(items)) items = []
    } catch (err) {
      console.error('Gemini extraction error:', err)
      extractError = 'AI extraction failed. Please fill in the details manually.'
    }

    // Save bill record
    const vendorName = items[0]?.vendor || 'Unknown Vendor'
    const { rows } = await pool.query(
      `INSERT INTO vendor_bills (vendor_name, cloudinary_url, cloudinary_public_id, original_filename, extracted_items)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [vendorName, cloudResult.secure_url, cloudResult.public_id, req.file.originalname, JSON.stringify(items)]
    )

    res.json({
      bill: rows[0],
      items,
      cloudinaryUrl: cloudResult.secure_url,
      warning: extractError
    })
  } catch (err) {
    console.error('Vendor bill upload error:', err)
    res.status(500).json({ error: err.message || 'Upload failed.' })
  }
})

// GET /api/vendor-bills — list all uploaded bills
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM vendor_bills ORDER BY created_at DESC LIMIT 50')
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bills.' })
  }
})

export default router
