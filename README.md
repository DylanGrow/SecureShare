# 🛡️ SecureShare PWA

SecureShare is a modern, cybersecure Progressive Web App (PWA) designed for encrypting and securely sharing PDFs and image files online. Built with a sleek, government-grade dark mode interface and strictly localized assets.

## ✨ Features
- **Strict Content Security**: Enforced Content Security Policy (CSP) blocking all external trackers, scripts, and fonts.
- **Adblock Friendly**: No Google Fonts or analytics involved. Completely offline-capable PWA.
- **Supabase Backend**: Configured with strict Row Level Security (RLS) for your storage buckets to ensure files are accessed safely.
- **Format Verification**: Drag-and-drop protocol strictly limits uploads to `.pdf`, `.png`, `.jpg`, and `.webp` under 10MB.
- **Lightning Fast**: Perfect Lighthouse 100/100/100/100 score with localized optimized assets.

## 🚀 Setup & Installation

### 1. Database Configuration
1. Create a free project on [Supabase](https://supabase.com/).
2. Navigate to the **SQL Editor** in your Supabase dashboard.
3. Paste and run the contents of the `SUPABASE_SETUP.sql` file included in this repository to configure your storage buckets and RLS policies.

### 2. Local Environment
Create a `.env` file in the root directory of this project with your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your_project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### 3. Running Locally
Make sure you have Node.js installed, then run:

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

## 🛠️ Tech Stack
- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS v4
- **Backend Storage**: Supabase
- **Icons**: Lucide React
- **Deployment**: GitHub Pages (Auto-deployed via GitHub Actions)
