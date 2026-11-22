# Namma-Urimai (நம் உரிமை)
### Plain-Language Indian Government Welfare Scheme Navigator

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Next.js 14](https://img.shields.io/badge/Next.js-14.2-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-teal)](https://tailwindcss.com/)
[![Verified Schemes](https://img.shields.io/badge/Verified%20Schemes-5%2C200%2B-green)](https://www.myscheme.gov.in)

> **"Every welfare scheme you qualify for. In simple words."**  
> An empathetic, zero-friction civic intelligence platform designed to bridge the gap between Indian government welfare policies and the citizens who need them most.

---

## 🌟 Overview & Mission

Navigating government welfare schemes in India is traditionally plagued by bureaucratic jargon, complex eligibility criteria, fragmented department portals, and aggressive middleman fees. 

**Namma-Urimai (Our Rights)** revolutionizes civic access by translating policy language into plain words. Citizens simply describe their real-life situation (e.g., *"I am 68 years old, living alone without family support in Trichy"* or *"Need hernia surgery in Chennai"* or *"First graduate college scholarship"*), and Namma-Urimai immediately pinpoints their exact eligible welfare entitlements from over **5,200+ verified Central and State programs**.

---

## 🚀 Key Features

### 1. Zero Login Friction (100% Open Access)
- **No Sign-In Required**: Citizens can freely search, filter, check off documents, and print application briefs without phone numbers, passwords, OTPs, or accounts.
- **Privacy First**: Sensitive demographic and financial details remain strictly inside the citizen's local browser storage.
- **One-Click Clear**: Easily start fresh anytime with dedicated **"Clear Chat / New Search"** buttons.

### 2. Plain-Language Conversational Navigator
- **Messy Natural Input**: Accepts unstructured descriptions, regional accents, and colloquial terms in English, Tamil (தமிழ்), Hindi (हिन्दी), and Telugu (తెలుగు).
- **Zero-Fail Hybrid Architecture**: Powered by Google Gemini with an instant **deterministic local fallback engine**. Even during upstream API traffic spikes or 503 outages, the system automatically extracts user parameters and delivers instant scheme matches without crashing.

### 3. Contextual Dynamic Narrowing Funnel
Systematically reduces thousands of programs down to **$\le 5$ highest-probability schemes** using a high-impact, 3-step narrowing question hierarchy:
1. **Location & State**: Segregates Central entitlements and filters directly to the citizen's resident state (Tamil Nadu, Karnataka, Maharashtra, etc.).
2. **Economic Bracket / Income**: Narrows schemes based on verified family annual income limits ($< ₹1\text{ Lakh}$, $₹1 - ₹2.5\text{ Lakhs}$, $₹2.5 - ₹5\text{ Lakhs}$, $> ₹5\text{ Lakhs}$).
3. **Domain-Specific Attributes**:
   - **Healthcare**: Ration card tier (Rice Card / PHH, Sugar Card / NPHH, Antyodaya / AAY).
   - **Education**: Academic stage (Class 11-12, Undergraduate, Postgraduate, Polytechnic/Diploma) and reservation category (BC, MBC, SC, ST, First Graduate).
   - **Social Security**: Senior living status (Destitute, Differently Abled, Destitute Widow, Farmer Senior).
   - **Agriculture**: Small/marginal landholding ($< 5\text{ acres}$) vs. large cultivators.

### 4. Transparent Reasoning: "Why You Qualify"
- Every scheme card features clear, understandable bullet points explaining **why** the citizen qualifies.
- The scheme detail view maps citizen parameters against official criteria (Location, Income, Need, Age) with instant status tags (**Matches**, **Check Required**).

### 5. Interactive Checklist & 1-Page A4 Printable Dossier
- **Live Local Tracker**: Citizens check off identity cards and certificates as they gather them.
- **Official 1-Page A4 Printout**: Formatted with print stylesheets to fit cleanly onto an A4 sheet for submission at e-Sevai / CSC centres or Taluk offices.
- **Anti-Exploitation Civic Notices**: Clearly instructs citizens on official government guidelines to avoid unauthorized middlemen fees.

### 6. 24x7 Government Helplines Strip
- One-touch phone dialers (`tel:`) integrated for:
  - **108**: Medical Emergency Ambulance
  - **104**: Health & Telemedicine Helpline
  - **14417**: School Education & Scholarships
  - **181**: Women in Distress Support
  - **1100**: Chief Minister Citizen Grievance Redressal

---

## 🎨 Design Philosophy: Modern Editorial Bento

The visual language follows an organic, editorial civic aesthetic:
- **Warm Civic Palette**: Deep forest green (`#132A1D` / `#1E3A2B`), soft organic sage (`#F0F5F1`, `#D5E3D6`), and warm off-white canvas (`#F8FAF7`).
- **Editorial Typography**: Elegant serif display titles (`Georgia / serif`) paired with high-contrast, clean sans body typography.
- **Bento Hierarchy**: Elevated card containers with smooth `rounded-3xl` corners, subtle borders, and pill tags.

---

## 🏗️ Architecture & Stack

```
                          ┌────────────────────────┐
                          │   Citizen Browser UI   │
                          │ (Next.js 14 App Router)│
                          └───────────┬────────────┘
                                      │
            ┌─────────────────────────┴─────────────────────────┐
            ▼                                                   ▼
┌─────────────────────────┐                         ┌───────────────────────┐
│     /api/chat Route     │                         │   /api/schemes Route  │
│  - Gemini Generative AI │                         │  - Full-Text Search   │
│  - Zero-Fail Local Rule │                         │  - Multi-Param Filter │
│    Fallback Engine      │                         └───────────┬───────────┘
└───────────┬─────────────┘                                     │
            │ Extracted Profile & Search Terms                  │
            └─────────────────────────┬─────────────────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │    Supabase PostgreSQL    │
                        │ 5,200+ Welfare Schemes &  │
                        │ Scheme FAQs Database      │
                        └───────────────────────────┘
```

| Layer | Technologies |
|---|---|
| **Framework** | [Next.js 14](https://nextjs.org/) (App Router, Server Actions, Dynamic Routes) |
| **Language** | [TypeScript 5](https://www.typescriptlang.org/) (Strict typing across API and client) |
| **Styling** | [Tailwind CSS 3.4](https://tailwindcss.com/) with Custom Print Media Styles |
| **Icons** | [Lucide React](https://lucide.dev/) |
| **Database** | [Supabase](https://supabase.com/) PostgreSQL with Full-Text Indexing |
| **AI Processing** | Google Gemini (`gemini-flash-lite-latest` / `gemini-2.0-flash`) with Deterministic Heuristic Fallback |

---

## 📂 Project Structure

```
web/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/route.ts        # Intent parser, profile extractor & zero-fail fallback
│   │   │   └── schemes/route.ts     # Supabase scheme search & filtering endpoint
│   │   ├── schemes/[slug]/page.tsx  # Dynamic scheme detail, checklist & printable dossier
│   │   ├── tracker/page.tsx         # Offline saved schemes tracker & deadline monitor
│   │   ├── globals.css              # Editorial typography, print styles & theme variables
│   │   ├── layout.tsx               # Root layout with font and metadata configuration
│   │   └── page.tsx                 # Main citizen landing page & search orchestrator
│   ├── components/
│   │   ├── ApplicationRoadmap.tsx   # 01, 02, 03, 04 step-by-step submission guide
│   │   ├── ChatInterface.tsx        # Conversational assistant & clear chat controls
│   │   ├── DocumentChecklist.tsx    # Interactive document checkbox tracker
│   │   ├── DynamicChips.tsx         # Prioritized follow-up narrowing chips & custom input
│   │   ├── Header.tsx               # 24x7 helpline dialers, branding & language switcher
│   │   ├── HospitalRoadmap.tsx      # Arogya Mitra & hospital cashless guide
│   │   ├── LocaleProvider.tsx       # Regional language context provider
│   │   ├── PrintDossier.tsx         # 1-Page A4 printable government application record
│   │   ├── SaveSchemeButton.tsx     # Local bookmarking button
│   │   ├── SchemeCard.tsx           # Bento-styled scheme result card
│   │   └── SchemeTabs.tsx           # Accessible tab navigation (Benefits, Qualify, Docs, Steps, FAQs)
│   └── lib/
│       ├── geminiClient.ts          # Google Generative AI SDK client
│       ├── healthSearch.ts          # Multi-query scheme deduplication and merging
│       ├── i18n.ts                  # Multi-language dictionary (en, ta, hi, te)
│       ├── savedSchemes.ts          # LocalStorage utilities & deadline countdown calculations
│       ├── schemeDetail.ts          # Parser for eligibility, requirements, documents & deadlines
│       ├── supabaseClient.ts        # Supabase database client
│       └── types.ts                 # Full TypeScript schemas for schemes, profile & API
└── .env.local                       # Local environment variables (API keys & DB credentials)
```

---

## 🛠️ Getting Started

### Prerequisites
- **Node.js**: v18.18 or higher (v20+ recommended)
- **Package Manager**: `npm`, `pnpm`, or `yarn`

### 1. Clone the Repository
```bash
git clone https://github.com/KSKeerthivasan/Namma-Urimai.git
cd Namma-Urimai/web
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env.local` file in the `web` directory:
```env
# Gemini API Key (from Google AI Studio)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-flash-lite-latest

# Supabase Credentials
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Production Build
```bash
npm run build
npm run start
```

---

## 🧪 Testing & Verification

Run linter and TypeScript verification:
```bash
npm run lint
```

Test the chat intelligence endpoint via terminal:
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Scholarship for college students in Tamil Nadu"}'
```

---

## 🔒 Security, Privacy & Integrity

1. **No Data Harvesting**: No citizen data or location histories are permanently logged or shared with third parties.
2. **Transparent Sourcing**: Every welfare scheme links directly to its verified source listing on `myscheme.gov.in`.
3. **Resilience**: The application features zero single points of failure. In the event of external API outages, heuristic classification ensures seamless discovery without disruption.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE). Built for public good and civic empowerment across India.
