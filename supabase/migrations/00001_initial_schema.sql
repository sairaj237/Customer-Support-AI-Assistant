-- Conversations Table
CREATE TABLE public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT NOT NULL DEFAULT 'open', -- 'open', 'escalated', 'closed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Messages Table
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- 'user' or 'assistant'
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Escalations Table
CREATE TABLE public.escalations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    classified_category TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Basic RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalations ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access for demo purposes
CREATE POLICY "Allow anonymous select on conversations" ON public.conversations FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert on conversations" ON public.conversations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update on conversations" ON public.conversations FOR UPDATE USING (true);

CREATE POLICY "Allow anonymous select on messages" ON public.messages FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert on messages" ON public.messages FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous select on escalations" ON public.escalations FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert on escalations" ON public.escalations FOR INSERT WITH CHECK (true);
