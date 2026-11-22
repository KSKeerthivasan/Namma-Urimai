# PROJECT.md — Namma-Urimai (Our Rights)
**Single Source of Truth & Technical Blueprint**  
*Autonomous Implementation Specification for Engineers & AI Agents*

---

## 1. Project Metadata & Vision

| Attribute | Specification |
| :--- | :--- |
| **Project Codename** | `Namma-Urimai` (Tamil: *Our Rights*) |
| **System Classification** | Plain-Language Indian Welfare Scheme Navigator & Application Tracker |
| **Deployment Target** | Modern Web (Vercel / Cloudflare Pages) + Supabase PostgreSQL |
| **Operating Budget** | **$0 / Month** (100% Free Tiers across Hosting, DB, and AI Inference) |
| **Primary Language Scope** | Pan-India (English base + on-the-fly Tamil, Hindi, Telugu conversational localization) |
| **Target Audience** | Low-income families, daily-wage workers, students, senior citizens, and patients needing critical healthcare |

### The Core Problem
India has hundreds of Central and State government welfare schemes offering health cover, scholarships, pensions, housing, and farm subsidies. Millions of eligible citizens miss out because:
1. Information is fragmented across dozens of unnavigable portals.
2. Eligibility criteria are buried in dense bureaucratic PDF notices.
3. Document requirements are unclear, forcing vulnerable citizens to pay corrupt middlemen for services that are legally free.

### The Solution Contract
A citizen enters **one conversational sentence** describing their situation (typed or spoken). The system:
* Ingests the plain-language prompt without long forms.
* Uses **Gemini Flash-Lite** to extract core entities into structured parameters.
* Dynamically generates **quick-select chips derived from candidate schemes' official cutoffs** for any missing high-gain criteria.
* Queries a synchronized Supabase database (backed by `myscheme.gov.in` data).
* Presents matched schemes with **explainable reasoning** (*"Why you qualify"*).
* Generates a **Personalized Document Checklist** and a **Step-by-Step Application Roadmap** (including exact office desks, fees, and procedures).
* Provides verified government source links and deadline reminders.

---

## 2. System Architecture & Data Flow

```
                                  [ Citizen Client ]
                      (Next.js 14+ / Tailwind CSS / Web Speech API)
                                         │
                         ┌───────────────┴───────────────┐
                         ▼                               ▼
                 /api/chat/extract               /api/schemes/match
               (Gemini Flash-Lite NLU)           (Supabase Postgres Query)
                         │                               ▲
                         │  {age, location, need, lang}  │
                         └───────────────┬───────────────┘
                                         ▼
                     [ Supabase PostgreSQL DB: Namma-Urimai ]
                     ├── public.schemes (4,670+ records, 27 cols)
                     └── public.scheme_faqs (51,436+ records, 5 cols)
                                         ▲
                                         │ Incremental Upsert Sync
                                         │
                       [ Python Scraper & Sync Engine ]
                       ├── schemes.csv (Local master dataset)
                       ├── schemes_faqs.csv (Local master FAQs)
                       └── myscheme.gov.in API (/api/apisetu/...)
```

---

## 3. Database Specification & DDL Contract

Target Supabase Instance: **`Namma-Urimai`** (`xulgafkxcoahclraanoz`) | Database: PostgreSQL 17

```sql
-- 1. Master Schemes Table
CREATE TABLE IF NOT EXISTS public.schemes (
    slug TEXT PRIMARY KEY,
    scheme_name TEXT NOT NULL,
    short_title TEXT,
    level TEXT,                           -- 'Central' | 'State/ UT' | 'State'
    state TEXT,                           -- e.g. 'Tamil Nadu', 'Maharashtra', or NULL for Central
    ministry TEXT,                        -- Nodal Ministry name
    department TEXT,                      -- Nodal Department name
    beneficiary_type TEXT,                -- 'Individual' | 'Infra'
    target_beneficiaries TEXT,            -- Semicolon-separated values
    benefit_type TEXT,                    -- 'Cash' | 'In Kind' | 'Composite'
    categories TEXT,                      -- Semicolon-separated categories
    sub_categories TEXT,                  -- Semicolon-separated sub-categories
    tags TEXT,                            -- Semicolon-separated tags
    brief_description TEXT,
    detailed_description TEXT,            -- Full markdown description
    benefits TEXT,                        -- Bullet lines separated by ' | '
    eligibility TEXT,                     -- Rules separated by '; '
    exclusions TEXT,                      -- Bullet lines separated by ' | '
    application_mode TEXT,                -- 'Online' | 'Offline' | 'Online; Offline'
    application_process TEXT,             -- Steps separated by ' | '
    documents_required TEXT,              -- Documents separated by '; '
    references TEXT,                      -- URLs separated by '; '
    scheme_open_date DATE,
    scheme_close_date DATE,
    dbt_scheme BOOLEAN DEFAULT FALSE,
    faq_count INTEGER DEFAULT 0,
    source_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Search and Filter Indexes
CREATE INDEX IF NOT EXISTS idx_schemes_state ON public.schemes(state);
CREATE INDEX IF NOT EXISTS idx_schemes_level ON public.schemes(level);
CREATE INDEX IF NOT EXISTS idx_schemes_benefit_type ON public.schemes(benefit_type);

-- Full-Text Search GIN Index for Symptoms & Keywords
CREATE INDEX IF NOT EXISTS idx_schemes_fts ON public.schemes 
USING GIN (to_tsvector('english', 
    coalesce(scheme_name, '') || ' ' || 
    coalesce(brief_description, '') || ' ' || 
    coalesce(categories, '') || ' ' || 
    coalesce(tags, '') || ' ' ||
    coalesce(benefits, '')
));

-- 2. Scheme FAQs Table
CREATE TABLE IF NOT EXISTS public.scheme_faqs (
    scheme_slug TEXT NOT NULL REFERENCES public.schemes(slug) ON DELETE CASCADE,
    scheme_name TEXT NOT NULL,
    faq_number INTEGER NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (scheme_slug, faq_number)
);

CREATE INDEX IF NOT EXISTS idx_scheme_faqs_slug ON public.scheme_faqs(scheme_slug);

-- 3. Row Level Security (RLS)
ALTER TABLE public.schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheme_faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public schemes read access" 
ON public.schemes FOR SELECT USING (true);

CREATE POLICY "Public scheme_faqs read access" 
ON public.scheme_faqs FOR SELECT USING (true);
```

---

## 4. Master Datasets & Scraper Specification

### 4.1 Master Local Files (d:\Scrapper)
1. **`schemes.csv`**: 4,670 baseline records, 27 standardized columns.
2. **`schemes_faqs.csv`**: 51,436 baseline question-answer records, 5 columns (`scheme_slug`, `scheme_name`, `faq_number`, `question`, `answer`).

### 4.2 Live Government Portal Extraction Engine
* **Portal Base**: `https://www.myscheme.gov.in`
* **Discovery Endpoint**:  
  `GET https://www.myscheme.gov.in/api/apisetu/search/schemes?lang=en&q=[]&keyword=&sort=&from={offset}&size=100`  
  *Paginates `from=0` to `5200` in 52 requests of size 100 to discover all 5,194 live schemes.*
* **Scheme Detail Endpoint**:  
  `GET https://www.myscheme.gov.in/api/apisetu/schemes?slug={slug}&lang=en`
* **Documents Endpoint**:  
  `GET https://www.myscheme.gov.in/api/apisetu/schemes/{_id}/documents?lang=en`
* **FAQs Endpoint**:  
  `GET https://www.myscheme.gov.in/api/apisetu/schemes/{_id}/faqs?lang=en`

### 4.3 Synchronization Logic (`sync_engine/live_scraper_sync.py`)
1. Create timestamped backups: `schemes_backup_<ts>.csv` and `schemes_faqs_backup_<ts>.csv`.
2. Discover all live slugs and diff against current local keys:
   * **Existing Slugs (`4,670`)**: Re-scraped and updated in-place.
   * **New Slugs (`~524`)**: Fetched and appended as new rows at the bottom of both CSVs.
3. Dual-Sync: Concurrently execute PostgreSQL `UPSERT` on Supabase:
   * `INSERT INTO public.schemes ... ON CONFLICT (slug) DO UPDATE ...`
   * `INSERT INTO public.scheme_faqs ... ON CONFLICT (scheme_slug, faq_number) DO UPDATE ...`
4. Thread concurrency: 5–8 parallel workers with 0.15s polite delays to prevent gateway rate-limits.

---

## 5. Functional Requirements (FR)

### FR-1: Plain-Language Multilingual Intake
* The system MUST accept unformatted natural language sentences via text input or voice mic (Web Speech API).
* The system MUST accept English, Indian regional scripts (Tamil, Hindi, Telugu), and Romanized vernacular (Tanglish / Hinglish).

### FR-2: AI Entity & Intent Extraction (Gemini Flash-Lite)
* The system MUST extract a structured JSON payload from user input:
  ```typescript
  interface ExtractedProfile {
    name?: string;
    age?: number;
    gender?: 'Male' | 'Female' | 'Transgender' | 'All';
    state?: string;
    district?: string;
    community?: 'General' | 'OBC' | 'MBC' | 'SC' | 'ST' | 'PVTG';
    income_annual?: number;
    ration_card?: 'PHH' | 'AAY' | 'NPHH' | 'None';
    occupation?: string;
    medical_need?: string;
    education_need?: string;
    detected_language: string;
  }
  ```
* The system MUST use strict JSON schema mode (`responseSchema`) to guarantee zero parsing errors.

### FR-3: Progressive Clarification with Dynamic Government Chips
* If critical eligibility parameters are missing (e.g. Income ceiling or Ration Card for healthcare schemes), the system MUST NOT display long forms.
* The system MUST ask at most **1 or 2 targeted questions**.
* The quick-select chip options MUST be **dynamically derived from candidate schemes' official cutoffs** in the database (e.g. `[ Below ₹1,20,000 ]`, `[ ₹1,20,000 – ₹5,00,000 ]`, `[ Above ₹5,00,000 ]` or `[ Rice/PHH Card ]`, `[ Sugar Card ]`, `[ No Card ]`).

### FR-4: Hybrid Deterministic & Semantic Matching Engine
* The system MUST filter schemes deterministically via PostgreSQL:
  ```sql
  WHERE (state ILIKE :user_state OR level = 'Central')
  ```
* For specific health conditions, surgeries, or livelihood needs, the system MUST utilize PostgreSQL Full-Text Search (`tsvector @@ plainto_tsquery`) across `scheme_name`, `brief_description`, `categories`, `tags`, and `benefits`.

### FR-5: Transparent Reasoning ("Why You Qualify")
* Every matched scheme card MUST display an explainable checklist:
  * ✔ **Location**: Citizen is a resident of [State/District].
  * ✔ **Condition/Need**: Medical procedure [Procedure Name] is covered under scheme benefits.
  * ✔ **Income / Card**: Income is below the [₹ Limit] ceiling.
  * ✔ **Age Range**: Citizen age [N] satisfies criteria ([Min] to [Max] years).

### FR-6: Personalized Document Checklist
* For every matched scheme, the system MUST categorize documents into:
  1. **Documents You Already Have** (Aadhaar, Smart Ration Card).
  2. **Documents You Need to Obtain** (Doctor's prescription, Income Certificate).
* The checklist MUST specify the exact government portal or physical center (e.g., e-Sevai / MeeSeva / CSC / Taluk Office) and the official fee ceiling (e.g., ₹60, preventing middleman extortion).

### FR-7: Step-by-Step Hospital & Application Roadmap
* The system MUST provide an end-to-end procedural guide:
  * Step 1: Hospital selection (empaneled network hospitals in their district).
  * Step 2: Exact helpdesk to approach (e.g. *"Arogya Mitra / CMCHIS Insurance Kiosk"*).
  * Step 3: Pre-authorization workflow and turnaround time (e.g. 2–24 hours).
  * Step 4: Cashless discharge rules (zero out-of-pocket for bed, surgery, medicines, food).

### FR-8: Deadline & Application Tracking
* Schemes with approaching close dates (`scheme_close_date`) MUST display an urgency badge (*"Closes in N days"*).
* Schemes marked with `dbt_scheme = True` MUST highlight direct bank account transfer.

### FR-9: Verified Government Source Stamp
* Every scheme MUST display:
  * Canonical source link to `https://www.myscheme.gov.in/schemes/{slug}` or official state portal.
  * Verification stamp: *"Verified Active: November 2026"*.

### FR-10: On-the-Fly Regional Language Localization
* If the user selects a regional language (e.g., தமிழ்) or speaks in Tamil, Gemini Flash-Lite MUST translate and present all output cards, checklists, and guides into natural, simple regional phrasing.

---

## 6. Non-Functional Requirements (NFR)

| ID | Requirement | Measurable Threshold |
| :--- | :--- | :--- |
| **NFR-1** | **Inference & Search Latency** | Time-to-first-token < 500ms; database query < 100ms |
| **NFR-2** | **Accessibility (WCAG 2.1 AA)** | 100% mobile responsive, minimum 16px base font, contrast ratio ≥ 4.5:1 |
| **NFR-3** | **Zero Cloud Hosting Cost** | Vercel Hobby + Supabase Free Tier + Google AI Studio Free Quota ($0/mo) |
| **NFR-4** | **Data Integrity** | Atomic file writes with `.bak` rollback; 0 orphaned FAQ records in DB |
| **NFR-5** | **Security & Privacy** | No citizen PII (Aadhaar number, phone) stored in DB without explicit user opt-in |

---

## 7. Acceptance Criteria (Given / When / Then)

### AC-1: Medical Emergency Scenario (Hernia Example)
* **Given** a user inputs: *"I am XXX, 48 years old from Chennai, I need hernia surgery."*
* **When** the entity extractor processes the prompt,
* **Then** it extracts `{age: 48, state: "Tamil Nadu", district: "Chennai", need: "hernia surgery"}` and detects missing income data.
* **And** it displays dynamic chips: `[ Below ₹1,20,000 ]`, `[ ₹1,20,000 - ₹5,00,000 ]`, `[ Above ₹5,00,000 ]` and `[ Rice Card ]`.
* **When** the user taps `[ Below ₹1,20,000 ]` and `[ Rice Card ]`,
* **Then** it returns **Chief Minister's Comprehensive Health Insurance Scheme (CMCHIS)** as the #1 match.
* **And** displays: 100% Cashless surgery up to ₹5,00,000, personalized document checklist, and step-by-step hospital Arogya Mitra instructions.

### AC-2: Multilingual Speech Intake
* **Given** a user speaks via the microphone in Tamil: *"எனக்கு 48 வயசு, சென்னை, ஹெர்னியா அறுவை சிகிச்சை செய்யணும்."*
* **When** the Web Speech API transcribes and submits the text,
* **Then** the engine identifies the exact same criteria as English, queries Supabase, and outputs the response in clear, simple Tamil.

---

## 8. Edge Cases & Resilience (EC)

* **EC-1: Incomplete or Ambiguous Location**: If user says *"from Gandhi Nagar"*, AI prompts: *"Which state and district is your Gandhi Nagar located in?"* with auto-suggest chips.
* **EC-2: Zero Direct Keyword Matches**: If no exact match for a slang symptom, Gemini maps the colloquial term to formal medical categories (e.g. *"chest pain"* ➔ Cardiology packages).
* **EC-3: Offline / Slow Network**: Next.js client renders dynamic chips and cached scheme summaries optimistically; service worker supports offline viewing of generated checklists.
* **EC-4: Portal Scraper Rate Limit (HTTP 429)**: Scraper employs exponential backoff with jitter and resumes from `.cache/` checkpoint without repeating fetched slugs.

---

## 9. Complete Directory Structure

```
d:\Scrapper\
├── PROJECT.md                  # This master specification document
├── schemes.csv                 # Master offline schemes dataset (4,670 rows)
├── schemes_faqs.csv            # Master offline FAQs dataset (51,436 rows)
├── sync_engine/                # Python Database & Scraper Pipeline
│   ├── config.py               # Supabase credentials & rate limit configurations
│   ├── db_migrate.py           # Executes SQL DDL on Supabase via MCP/psycopg
│   ├── db_ingest_baseline.py   # Ingests schemes.csv & schemes_faqs.csv to Supabase
│   └── live_scraper_sync.py    # Incremental scraper syncing portal data
└── web/                        # Modern Next.js 14+ Application
    ├── package.json
    ├── tsconfig.json
    ├── tailwind.config.ts
    ├── .env.local              # Environment variables
    └── src/
        ├── app/
        │   ├── layout.tsx      # Main layout with header & language toggle
        │   ├── page.tsx        # Hero conversational portal
        │   └── api/
        │       ├── chat/route.ts       # Gemini Flash-Lite extraction & localization
        │       └── schemes/route.ts    # Supabase PostgreSQL search & filter
        ├── components/
        │   ├── Header.tsx              # Logo, language selector, helpline badge
        │   ├── ChatInterface.tsx       # Conversational input & Speech mic button
        │   ├── DynamicChips.tsx        # Government cutoff chip selector
        │   ├── SchemeCard.tsx          # Match badge, benefits, & why-you-qualify checklist
        │   ├── DocumentChecklist.tsx   # Interactive printable checklist
        │   └── HospitalRoadmap.tsx     # Step-by-step desk instructions
        └── lib/
            ├── supabaseClient.ts       # Supabase client singleton
            └── geminiClient.ts         # Google Generative AI client singleton
```

---

## 10. Environment Variable Contract (`.env.local`)

```env
# Supabase Configuration (Active Project: Namma-Urimai)
NEXT_PUBLIC_SUPABASE_URL=https://xulgafkxcoahclraanoz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1bGdhZmt4Y29haGNscmFhbm96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUyODI2NDAsImV4cCI6MjExMDg1ODY0MH0.cgFLMYAJtLV_qRIL93jlvpwOK-byHMD28WjbCeTw5QY
SUPABASE_SERVICE_ROLE_KEY=<SUPABASE_SERVICE_KEY_IF_NEEDED>

# Google Gemini API Configuration (Model: Gemini Flash-Lite)
GEMINI_API_KEY=<YOUR_GEMINI_API_KEY>
```

---

## 11. Autonomous Execution Checklist for Engineers & Agents

When authorized to begin, follow this exact sequence:

1. **Phase 1: Database Migration & Schema Creation**
   * Run `python sync_engine/db_migrate.py` to create `public.schemes` and `public.scheme_faqs` with GIN indexes and RLS policies on Supabase.
2. **Phase 2: Baseline Data Ingestion**
   * Run `python sync_engine/db_ingest_baseline.py` to load all 4,670 schemes and 51,436 FAQs into Supabase in 500-record batches.
3. **Phase 3: Scraper Validation & Delta Sync**
   * Run `python sync_engine/live_scraper_sync.py` to discover live portal slugs, append new records, and update existing rows.
4. **Phase 4: Web Application Scaffolding**
   * Initialize `web/` with Next.js 14 (App Router, TypeScript, Tailwind CSS, Lucide React).
   * Implement `/api/chat` using Gemini Flash-Lite with structured JSON schema.
   * Implement `/api/schemes` querying Supabase via PostgreSQL full-text search and filters.
5. **Phase 5: UI Construction & Verification**
   * Build conversational input, dynamic chip toolbar, reasoning checklist, and printable document roadmap.
   * Run verification tests across English, Tamil, and Hindi hernia and scholarship user journeys.

---

## 12. Required Agent Skills Mapping Matrix

Any autonomous agent or engineer executing this project MUST load and utilize the designated skills for each phase:

| Phase / Task | Required Skill | Skill Path | Role in Execution |
| :--- | :--- | :--- | :--- |
| **Phase 1: DB Migration** | `database-designer`<br>`supabase-postgres-best-practices` | `skills/database-designer/SKILL.md`<br>`skills/supabase-postgres-best-practices/SKILL.md` | Establishes PostgreSQL DDL, foreign key cascading, GIN full-text search indexing, and RLS policies. |
| **Phase 2 & 3: Ingestion & Live Scraper** | `universal-scraping-architect` | `skills/universal-scraping-architect/SKILL.md` | Manages Mode 2 (Local Python Extraction Pipeline), paginated API discovery from `myscheme.gov.in`, atomic CSV writes, rate-limiting, and checkpointing. |
| **Phase 4: Fullstack Engine & NLU** | `senior-fullstack`<br>`rag-architect` | `skills/senior-fullstack/SKILL.md`<br>`skills/rag-architect/SKILL.md` | Scaffolds Next.js 14+ App Router, integrates Gemini Flash-Lite for structured JSON extraction and on-the-fly Indic translation, and constructs hybrid SQL + FTS retrieval. |
| **Phase 5: Citizen UI & Accessibility** | `ui-design-system`<br>`senior-frontend` | `skills/ui-design-system/SKILL.md`<br>`skills/senior-frontend/SKILL.md` | Builds high-contrast, WCAG 2.1 AA compliant conversational chat, dynamic government-bracket chips, printable checklists, and Web Speech API mic controls. |
| **Quality & Self-Testing** | `spec-driven-workflow` | `skills/spec-driven-workflow/SKILL.md` | Enforces verification against the Given/When/Then acceptance criteria and edge-case contracts. |

---

## 13. UI/UX Design, Page-by-Page Breakdown & Tooling Specification

### 13.1 Visual Design Tokens & Aesthetic Identity
The UI is styled as a modern, trustworthy, high-accessibility civic platform for Indian citizens:
* **Color Palette**:
  * **Primary (Ashoka Navy)**: `#0F294A` — Headers, primary buttons, authoritative framing.
  * **Secondary (Govt Blue)**: `#1E40AF` — Active states, interactive tabs.
  * **Accent (Saffron Gold)**: `#F59E0B` — Badges, urgency alerts, highlights.
  * **Success (Tamil Forest Green)**: `#10B981` — 100% Eligible badges, verified ticks.
  * **Surface Background**: `#F8FAFC` (Slate-50) with white card containers.
* **Typography**:
  * Clean, highly readable sans-serif fonts: `Inter` / `Noto Sans` (with full glyph support for Tamil, Devanagari, and Telugu scripts).
  * Base font size: 16px desktop / 16px mobile (preventing iOS zoom on focus).
  * High contrast ratios (WCAG 2.1 AA compliant, ≥ 4.5:1 text-to-background).
* **Mobile-First Touch Targets**:
  * Every clickable chip, button, and input has a minimum touch target of **48px × 48px** for easy tapping by senior citizens.

---

### 13.2 Page-by-Page Structural Breakdown

```
[ Root Layout (Persistent Header: Logo + Helpline + Language Selector) ]
  ├── 1. Main Citizen Hub (/)
  │   ├── Hero Conversational Search Card (Mic + Plain-Language Textarea)
  │   ├── Quick-Prompt Starter Pills ("Hernia surgery in Chennai", "Old age pension")
  │   ├── Dynamic Clarification Chip Bar (Appears when high-gain criteria needed)
  │   └── Live Matched Schemes Grid (Cards with "Why You Qualify" checkmarks)
  │
  ├── 2. Scheme Detail & Action Roadmap Modal / Page (/schemes/[slug])
  │   ├── Official Authority Header (Ministry, Department, Last Verified Date)
  │   ├── Tab 1: Benefits & Coverage Summary
  │   ├── Tab 2: Explainable Rule Matching Evidence
  │   ├── Tab 3: Personalized Document Checklist (Interactive checkboxes + Print Button)
  │   ├── Tab 4: Step-by-Step Application & Hospital Desk Protocol
  │   └── Tab 5: Official FAQs (Interactive Accordions from schemes_faqs.csv)
  │
  └── 3. Offline Tracker & Application Storage (/tracker)
      ├── Saved Schemes (Stored in browser LocalStorage without login)
      ├── Approaching Deadline Reminders ("Closes in 5 days")
      └── Official Links & Grievance Helplines (Direct 108 / 104 / CMCHIS numbers)
```

#### Detailed Page Specifications:

#### Page 1: Main Citizen Discovery Hub (`/`)
* **Header**:
  * Brand Logo: **Namma-Urimai** (*நம் உரிமை*) with Indian tricolor motif.
  * Language Switcher: Dropdown / pills `[ English | தமிழ் | हिन्दी | తెలుగు ]`.
  * Emergency Helpline Badge: Toll-free links (`108` Medical Emergency, `104` Health Helpline, `181` Women Helpline).
* **Conversational Hero Input Area**:
  * Multi-line expandable input: *"Tell us your situation in simple words (e.g., 'I am 48 years old from Chennai, need hernia surgery')..."*
  * **Pulsating Voice Mic Button**: Tapping triggers browser Web Speech API. Real-time microphone audio wave animation.
  * **Quick Sample Chips**: Below the input, 3 helpful starter examples for first-time users.
* **The Dynamic Clarification Toolbar**:
  * Renders smoothly with a slide-in animation **only** when missing discriminative parameters.
  * Displays government cutoff chips directly from DB data:
    * E.g., `[ Below ₹1,20,000 ]`, `[ ₹1.2L - ₹5.0L ]`, `[ Above ₹5.0L ]`.
    * E.g., `[ Rice Ration Card ]`, `[ Sugar Card ]`, `[ No Card ]`.
* **Live Matched Schemes Grid**:
  * Shows count: *"Found 3 Welfare Schemes You Qualify For"*.
  * Each card displays:
    * Level badge (`Central Government` / `Tamil Nadu State`).
    * **100% Eligible** green pill badge.
    * Headline benefit: *"Cashless medical treatment up to ₹5,00,000 per family per year"*.
    * 3–4 bulleted **"Why You Qualify"** checklist items with green checkmarks.
    * Primary CTA: **"View Document Checklist & How to Apply →"**.

#### Page 2: Scheme Detail & Roadmap Modal (`/schemes/[slug]`)
* Accessible via deep-link or popover modal.
* Displays verified seal: *"Directly Verified from myscheme.gov.in on Nov 2026"*.
* **5 Interactive Tabs**:
  1. **Benefits**: Plain-language description of financial grants or medical packages covered.
  2. **Why You Qualify**: Rule-by-rule matching against user's extracted profile.
  3. **Document Checklist**:
     * Section A: *Documents You Already Have* (Aadhaar, Ration Card).
     * Section B: *Documents to Obtain* (Doctor prescription, Income certificate) + Nearest e-Sevai / CSC Center locator + Legal fee cap (₹60).
     * **[ Print / Save Checklist (PDF) ]** button for physical hospital visit.
  4. **Step-by-Step Guide**:
     * Step 1: Select network hospital in user's district.
     * Step 2: Walk to "Arogya Mitra / CMCHIS Insurance Helpdesk".
     * Step 3: Present Ration Card + Aadhaar for pre-authorization.
     * Step 4: Cashless admission & discharge.
  5. **FAQs**: Accordion list of official questions and answers drawn directly from `scheme_faqs`.

---

### 13.3 Concrete Outputs Delivered to the Citizen

1. **Conversational Audio & Text Response**: Immediate answer in their chosen language confirming eligibility.
2. **Transparent "Why You Qualify" Breakdown**: Zero black-box rejections; clear legal justifications for every match.
3. **Personalized 1-Page Printable Checklist**: Formatted specifically for physical printing or mobile saving so the citizen carries the exact papers to the government office or hospital.
4. **Official Source Transparency**: Direct canonical links to government portals (preventing scam websites) with the last verified date stamp.
5. **Urgency & Deadline Badges**: Visual indicator of closing dates.

---

### 13.4 Exact Libraries & UI Tools to be Used

| Category | Library / Tool | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Framework** | `next` | `^14.2.0` | React Server Components, App Router, Edge API routes |
| **Language** | `typescript` | `^5.0.0` | Strict type safety for data models and API contracts |
| **Styling** | `tailwindcss` | `^3.4.0` | Utility-first responsive styling and accessibility tokens |
| **Component Primitives**| `@radix-ui/react-*` | Latest | Accessible Dialog, Tabs, Accordion, Popover, Badge |
| **Icons** | `lucide-react` | `^0.350.0` | Clean SVG civic icons (Mic, CheckCircle, FileText, Hospital, etc.) |
| **Speech Recognition** | Browser `Web Speech API` | Native | Zero-cost speech-to-text in English, Tamil (`ta-IN`), Hindi (`hi-IN`) |
| **AI Inference** | `@google/genai` | Latest | Official Gemini Flash-Lite SDK with structured JSON schemas |
| **Database Client** | `@supabase/supabase-js` | `^2.40.0` | PostgreSQL client with full-text search querying |
| **Print / PDF Export** | Native `window.print()` / CSS | Native | Clean, print-styled CSS media query (`@media print`) for 1-page checklists |


