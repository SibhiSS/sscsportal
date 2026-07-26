-- Migration: Create candidate_notes table for collaborative committee discussions & @mentions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.candidate_notes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE NOT NULL,
    author_email TEXT NOT NULL,
    author_name TEXT NOT NULL,
    content TEXT NOT NULL,
    mentions TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.candidate_notes ENABLE ROW LEVEL SECURITY;

-- Allow All Access for authorized committee members (matching existing RLS pattern in schema.sql)
DROP POLICY IF EXISTS "Allow All Access on candidate_notes" ON public.candidate_notes;
CREATE POLICY "Allow All Access on candidate_notes" ON public.candidate_notes
    FOR ALL USING (true);

-- Index for fast lookup by application
CREATE INDEX IF NOT EXISTS idx_candidate_notes_application_id ON public.candidate_notes(application_id);
CREATE INDEX IF NOT EXISTS idx_candidate_notes_created_at ON public.candidate_notes(created_at ASC);
