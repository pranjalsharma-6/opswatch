# OpsWatch — AI-Powered DevOps Incident Dashboard

> Paste raw server logs. Get instant AI triage. Track incidents to resolution.

![OpsWatch Dashboard](https://opswatch-kcgi.vercel.app/og.png)

**Live Demo → [opswatch-kcgi.vercel.app](https://opswatch-kcgi.vercel.app)**

---

## What is OpsWatch?

OpsWatch is a real-time DevOps incident triage dashboard that uses AI to analyze raw server logs and automatically classify severity, identify root cause, and suggest fixes — in under 3 seconds.

Instead of an on-call engineer spending 30 minutes reading through hundreds of log lines at 2am, OpsWatch gives them structured, actionable triage instantly.

---

## The Problem

When production systems fail, engineers face this workflow:

1. Alert fires — often at 2amnpm run dev
2. Engineer manually reads hundreds of log lines
3. Spends 20-30 minutes diagnosing the issue
4. Searches docs and Stack Overflow for a fix
5. Finally resolves it — sometimes hours later

**Every minute of downtime costs money.** OpsWatch compresses that 30-minute process into 3 seconds.

---

## Features

**AI Triage Engine**
Paste raw server logs and get back structured analysis — severity classification, plain-English root cause, business impact, and numbered remediation steps — powered by Groq's LLaMA 3.3 70B model.

**Incident Lifecycle Management**
Every incident is tracked with a full status lifecycle — Open → In Progress → Resolved. One click cycles the status. All changes persist in PostgreSQL in real time.

**Real-time Dashboard**
Live stat cards show counts of Critical, Warning, Info, and Resolved incidents. Cards glow with color-coded severity when incidents exist.

**Smart Filtering and Search**
Filter incidents by severity or status. Full-text search across titles, components, and root causes instantly.

**Log Input Panel**
Paste raw logs directly or upload a `.log` or `.txt` file. Pre-built sample scenarios cover the most common production failure patterns.

**Detail Drawer**
Click any incident row to expand a full detail view with root cause, business impact, fix steps, and the original log snippet.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| AI Model | Groq API — LLaMA 3.3 70B |
| Database | Supabase (PostgreSQL) |
| Deployment | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) account (free)
- A [Groq](https://console.groq.com) API key (free)

### 1. Clone the repository

```bash
git clone https://github.com/pranjalsharma-6/opswatch.git
cd opswatch
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up Supabase

Go to your Supabase project → SQL Editor and run:

```sql
create table incidents (
  id           uuid primary key default gen_random_uuid(),
  incident_no  text not null,
  severity     text check (severity in ('critical', 'warning', 'info')),
  title        text not null,
  root_cause   text,
  impact       text,
  fix          text,
  component    text,
  status       text default 'open' check (status in ('open', 'in-progress', 'resolved')),
  log_snippet  text,
  created_at   timestamptz default now()
);

alter table incidents enable row level security;
create policy "Allow all" on incidents for all using (true);
```

### 4. Configure environment variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
GROQ_API_KEY=your_groq_api_key_here
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## How It Works
Engineer pastes raw server logs
↓
Frontend sends logs to /api/triage
↓
Next.js API route calls Groq LLaMA 3.3 70B
↓
AI returns structured JSON:
severity, title, root_cause,
impact, fix, component
↓
Incident saved to Supabase PostgreSQL
↓
Dashboard updates in real time
— stat cards, incident table, filters
↓
Engineer cycles status:
Open → In Progress → Resolved

---

## Sample Log Scenarios

OpsWatch handles all common production failure patterns:

| Scenario | Severity | Example |
|---|---|---|
| Kubernetes OOM Kill | Critical | Container exceeded memory limit, CrashLoopBackOff |
| Database Connection Exhaustion | Critical | PostgreSQL max_connections exceeded |
| Redis Cache Failure | Critical | CLUSTERDOWN, circuit breaker open |
| 502 Bad Gateway | Warning | Nginx upstream timeout, ImagePullBackOff |
| Disk Space Critical | Warning | /var/log at 100%, MySQL write failures |
| Auto-scaling Event | Info | HPA scale-out triggered by traffic spike |

---

## Project Structure
opswatch/
├── app/
│   ├── api/
│   │   ├── triage/
│   │   │   └── route.ts        # AI triage endpoint
│   │   └── incidents/
│   │       └── route.ts        # Incident CRUD
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                # Main dashboard
├── components/
│   ├── StatCards.tsx           # Live incident counters
│   ├── LogInputPanel.tsx       # Log input + AI result
│   ├── IncidentTable.tsx       # Incident list + filters
│   └── IncidentDrawer.tsx      # Expanded incident detail
└── lib/
├── supabase.ts             # Supabase client
└── types.ts                # TypeScript interfaces

---

## Deployment

This project is deployed on Vercel. To deploy your own instance:

1. Push the repository to GitHub
2. Import the project on [Vercel](https://vercel.com)
3. Add the three environment variables in Vercel dashboard
4. Deploy

---

## What I'd Build Next

- **Slack integration** — auto-notify team when critical incidents are created or resolved
- **Mean Time to Resolution (MTTR) metrics** — track incident resolution performance over time
- **Pattern detection** — AI identifies recurring incidents and flags systemic issues
- **Multi-user support** — assign incidents to specific engineers
- **Webhook support** — auto-ingest logs from Datadog, PagerDuty, or Grafana alerts

---

## Author

**Pranjal Sharma**
B.Tech Electronics and Computer Science — KIIT University

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-blue)](https://linkedin.com/in/your-linkedin)
[![GitHub](https://img.shields.io/badge/GitHub-Follow-black)](https://github.com/pranjalsharma-6)

---

## License

MIT License — feel free to use this project as inspiration or a starting point.