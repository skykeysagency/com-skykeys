-- Add meeting_link column to appointments table
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS meeting_link text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS google_event_id text;