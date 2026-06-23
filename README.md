# 👟 Khatri Footwear — Management System

**Prop. Bhavarlal Khatri | Solapur, Maharashtra**

A complete, production-ready retail management system for Khatri Footwear.

---

## ✅ Features

- **Dashboard** — Live stats, low-stock alerts, recent sales, category breakdown
- **Add Stock** — 3 ways: Manual form · 🎤 Voice entry · 📸 Vendor bill image upload
- **Stock List** — Search, filter, edit, delete, export CSV, margin tracking
- **Vendor Bills** — Upload photos/PDFs → AI extracts all items automatically
- **Billing** — Product search, cart, discount, tax, invoice generation
- **Invoice Sharing** — Print or send via WhatsApp
- **Reports** — Daily / Weekly / Monthly / Yearly revenue, brand analysis, top products
- **Shop Settings** — Shop info, invoice prefix, default tax

---

## 🏗️ Tech Stack

| Layer | Technology | Free Hosting |
|---|---|---|
| Frontend | React 18 + Vite + Tailwind CSS | Vercel |
| Backend | Node.js + Express | Render |
| Database | PostgreSQL | Neon |
| File Storage | Cloudinary | Cloudinary Free |
| AI (Voice+Image) | Google Gemini 1.5 Flash | Google AI Studio Free |

---

## 🚀 FREE HOSTING GUIDE — Step by Step

### STEP 1 — Set up the Database (Neon)

1. Go to **https://neon.tech** → Sign up free
2. Click **New Project** → Name it `khatri-footwear` → Create
3. Click **SQL Editor** in the left sidebar
4. Open `server/sql/schema.sql` from this project
5. Paste the entire contents into the SQL editor → Click **Run**
6. You should see all tables created successfully
7. Go to **Dashboard** → copy the **Connection String** (starts with `postgresql://`)
   - It looks like: `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`

8. **Save this** — you need it in Step 3

---

### STEP 2 — Set up Cloudinary (File Storage)

1. Go to **https://cloudinary.com** → Sign up free
2. After login, go to **Dashboard**
3. Note down these 3 values:
   - **Cloud Name** (e.g. `dxxxxx`)  
   - **API Key** (e.g. `123456789012345`)
   - **API Secret** (e.g. `abcdefghij...`)
4. **Save these** — you need them in Step 3

---

### STEP 3 — Deploy Backend on Render

1. Go to **https://render.com** → Sign up free with GitHub
2. Push this project to GitHub first (see Git setup below)
3. Click **New** → **Web Service**
4. Connect your GitHub repository
5. Set these settings:
   - **Name**: `khatri-footwear-api`
   - **Root Directory**: `server`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
6. Click **Environment** tab → Add these variables:

```
NODE_ENV          = production
PORT              = 5000
DATABASE_URL      = postgresql://... (from Neon Step 1)
JWT_SECRET        = (generate: go to https://generate-secret.vercel.app/64)
CORS_ORIGIN       = https://khatri-footwear.vercel.app (update after Step 4)
CLOUDINARY_CLOUD_NAME = (from Step 2)
CLOUDINARY_API_KEY    = (from Step 2)
CLOUDINARY_API_SECRET = (from Step 2)
GEMINI_API_KEY        = (from Step below)
```

7. Click **Create Web Service**
8. Wait for deployment (2–3 minutes) → copy your Render URL:
   `https://khatri-footwear-api.onrender.com`

---

### STEP 4 — Get Gemini API Key (Free AI)

1. Go to **https://aistudio.google.com/app/apikey**
2. Click **Create API Key** → Copy it
3. Go back to Render → Environment → add:
   `GEMINI_API_KEY = AIza...your-key...`
4. Redeploy the service

---

### STEP 5 — Deploy Frontend on Vercel

1. Go to **https://vercel.com** → Sign up free with GitHub
2. Click **Add New Project** → Import your GitHub repository
3. Set these settings:
   - **Framework**: Vite
   - **Root Directory**: `.` (leave as is)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Click **Environment Variables** → Add:
   ```
   VITE_API_BASE_URL = https://khatri-footwear-api.onrender.com
   ```
   (Use your actual Render URL from Step 3)
5. Click **Deploy**
6. Your app will be live at: `https://khatri-footwear.vercel.app`

---

### STEP 6 — Update CORS on Render

1. Go to Render → Your service → Environment
2. Update `CORS_ORIGIN` to your actual Vercel URL:
   ```
   CORS_ORIGIN = https://khatri-footwear.vercel.app
   ```
3. Redeploy

---

### STEP 7 — First Login Setup

1. Open your Vercel URL in Chrome or Edge
2. You will see a **Setup page** (only shown once)
3. Fill in:
   - Shop name, owner name, address, phone, GSTIN
   - Create your login username and password
4. Click **Complete Setup**
5. Log in with your new credentials
6. 🎉 Your app is live!

---

## 💻 Local Development

### Prerequisites
- Node.js 18+ installed
- A Neon database (or local PostgreSQL)

### Setup

```bash
# 1. Clone / extract this project
cd khatri-footwear

# 2. Install frontend dependencies
npm install

# 3. Install backend dependencies
cd server
npm install
cd ..

# 4. Create environment files
cp .env.example .env
cp server/.env.example server/.env

# 5. Edit server/.env with your values
# DATABASE_URL, JWT_SECRET, CLOUDINARY_*, GEMINI_API_KEY

# 6. Run database schema
# Paste server/sql/schema.sql into your Neon SQL editor

# 7. Start backend (terminal 1)
cd server
npm run dev

# 8. Start frontend (terminal 2)
npm run dev

# App runs at: http://localhost:5173
```

---

## 📁 Project Structure

```
khatri-footwear/
├── src/                          # React frontend
│   ├── App.jsx                   # Routes
│   ├── main.jsx                  # Entry point
│   ├── index.css                 # Tailwind + custom styles
│   ├── components/
│   │   ├── Layout.jsx            # Sidebar + topbar
│   │   └── Loader.jsx            # Loading spinner
│   ├── context/
│   │   └── AuthContext.jsx       # Auth state
│   ├── pages/
│   │   ├── Login.jsx             # Login screen
│   │   ├── Setup.jsx             # First-run setup
│   │   ├── Dashboard.jsx         # Home dashboard
│   │   ├── AddStock.jsx          # Add stock (3 methods)
│   │   ├── StockList.jsx         # Stock inventory table
│   │   ├── VendorBills.jsx       # Bill upload + AI extract
│   │   ├── Billing.jsx           # POS billing + invoice
│   │   ├── Reports.jsx           # Sales reports
│   │   └── ShopSettings.jsx      # Shop configuration
│   └── utils/
│       └── api.js                # Axios instance
├── server/                       # Node.js backend
│   ├── index.js                  # Express app entry
│   ├── db.js                     # PostgreSQL pool
│   ├── middleware/
│   │   └── auth.js               # JWT middleware
│   ├── routes/
│   │   ├── auth.js               # Login, setup, me
│   │   ├── products.js           # Stock CRUD
│   │   ├── sales.js              # Billing & invoices
│   │   ├── vendorBills.js        # File upload + AI
│   │   ├── voice.js              # Voice → structured data
│   │   ├── reports.js            # Analytics queries
│   │   └── shopSettings.js       # Shop config
│   ├── sql/
│   │   └── schema.sql            # Database tables
│   ├── .env.example              # Backend env template
│   └── package.json
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── vercel.json                   # Vercel SPA routing
├── .env.example                  # Frontend env template
├── .gitignore
└── README.md
```

---

## 🔑 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | /health | Server health check |
| GET | /api/auth/setup-status | Is first-run setup needed? |
| POST | /api/auth/setup | Create owner account |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Current user |
| GET | /api/products | List stock (search, filter, page) |
| POST | /api/products | Add stock item |
| PATCH | /api/products/:id | Update stock item |
| DELETE | /api/products/:id | Delete stock item |
| POST | /api/sales | Create invoice (deducts stock) |
| GET | /api/sales | List sales by period |
| GET | /api/sales/invoice/:number | Single invoice with items |
| POST | /api/vendor-bills/upload | Upload bill + AI extract |
| GET | /api/vendor-bills | Bill upload history |
| POST | /api/voice/process | Voice transcript → stock data |
| GET | /api/reports/dashboard | All dashboard stats |
| GET | /api/reports/monthly | 12-month revenue chart data |
| GET | /api/reports/top-products | Top selling products |
| GET | /api/shop-settings | Get shop info |
| PATCH | /api/shop-settings | Update shop info |

---

## 🛠️ Push to GitHub

```bash
cd khatri-footwear

# Initialize git
git init
git add .
git commit -m "Initial commit: Khatri Footwear Management System"

# Create repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/khatri-footwear.git
git branch -M main
git push -u origin main
```

---

## 📞 Support

This application is built specifically for **Khatri Footwear, Ramanandnagar**.
For any issues, check:
1. Render logs (Dashboard → Logs tab)
2. Browser console (F12 → Console tab)
3. Neon dashboard for database queries

---

*Built with ❤️ for Bhavarlal Khatri Ji*
