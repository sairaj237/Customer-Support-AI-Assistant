# Customer Support AI Assistant

This is a Customer Support AI Assistant built as a technical challenge. It handles incoming customer support messages, classifies them, attempts to answer them using an AI knowledge base, and escalates to a human agent when necessary.

## Architecture

- **Frontend:** Next.js (App Router) + React + Tailwind CSS
- **Backend:** Next.js API Routes (`/api/chat`)
- **Database:** Supabase (PostgreSQL)
- **Triage/Classification:** TypeSafe AI Jev model via OpenRouter Decisions API (`~typesafe/jev-latest`)
- **AI/LLM:** OpenRouter (`openrouter/auto:free`) via `ai` SDK for response generation
- **Automation:** n8n Webhook for escalation events

## Setup Instructions

### 1. Supabase Setup
1. Create a new Supabase project.
2. Go to the SQL Editor in your Supabase dashboard.
3. Run `supabase/migrations/00001_initial_schema.sql` to create the base tables.
4. Run `supabase/migrations/00002_jev_triage.sql` to add triage columns to `escalations` and create the `ticket_triage` table.

Alternatively, use the Supabase CLI: `npx supabase db push`

### 2. n8n Setup

n8n handles everything that happens *after* a ticket is escalated. When the chat route decides a ticket needs a human, it fires a webhook to n8n carrying the full triage payload (department, urgency score, sentiment score, escalation probability). n8n then takes over — routing to the right Slack channel, creating a Jira ticket, sending an email alert, or any other downstream action — without the Next.js app needing to know about any of it.

1. Open your n8n instance.
2. Click "Import from File" and select `n8n-escalation-workflow.json` from this repository.
3. Activate the workflow.
4. Open the Webhook node and copy the **Test URL** or **Production URL**.

### 3. Application Setup
1. Clone this repository.
2. Run `npm install` in the root directory.
3. Create a `.env.local` file based on `.env.example` (or configure the following variables):
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   OPENROUTER_API_KEY=your_openrouter_api_key
   N8N_WEBHOOK_URL=your_n8n_webhook_url
   ```
4. Run the development server: `npm run dev`
5. Open [http://localhost:3000](http://localhost:3000) to view the application.

## How it works

1. User message → saved to Supabase
2. `classifyTicket()` calls Jev with 4 questions in one request: department, urgency (1–5), sentiment (0–2), escalation probability
3. `shouldEscalate()` checks: `escalationProbability >= 0.7` OR `urgencyScore >= 4` OR `sentimentScore >= 1.5`
4. **Escalation path:** updates conversation status, inserts enriched escalation record, fires n8n webhook
5. **Normal path:** generates AI response, persists triage result to `ticket_triage` (non-blocking)

If the Jev API is down, a safe fallback is used (`department: general`, urgency 3, sentiment 1, escalation 0.5) — all below escalation thresholds.