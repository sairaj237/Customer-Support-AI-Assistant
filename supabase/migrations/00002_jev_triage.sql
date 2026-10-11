-- Migration: jev_triage
-- Extends the escalations table with triage signal columns and creates
-- the ticket_triage table for persisting non-escalated triage results.

-- ─── Extend escalations table ───────────────────────────────────────────────

ALTER TABLE public.escalations
  ADD COLUMN IF NOT EXISTS urgency_score          NUMERIC,
  ADD COLUMN IF NOT EXISTS sentiment_score        NUMERIC,
  ADD COLUMN IF NOT EXISTS escalation_probability NUMERIC,
  ADD COLUMN IF NOT EXISTS department             TEXT,
  ADD COLUMN IF NOT EXISTS used_fallback          BOOLEAN DEFAULT false;

-- ─── ticket_triage table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ticket_triage (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id        UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  department             TEXT NOT NULL,
  urgency_score          NUMERIC NOT NULL,
  sentiment_score        NUMERIC NOT NULL,
  escalation_probability NUMERIC NOT NULL,
  used_fallback          BOOLEAN NOT NULL DEFAULT false,
  created_at             TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.ticket_triage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous select on ticket_triage"
  ON public.ticket_triage FOR SELECT USING (true);

CREATE POLICY "Allow anonymous insert on ticket_triage"
  ON public.ticket_triage FOR INSERT WITH CHECK (true);
