ALTER TABLE public.user_reports
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS ai_violation boolean,
  ADD COLUMN IF NOT EXISTS ai_category text,
  ADD COLUMN IF NOT EXISTS handled_at timestamptz;

CREATE INDEX IF NOT EXISTS user_reports_status_created_idx
  ON public.user_reports (status, created_at DESC);