CREATE TABLE IF NOT EXISTS leads (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  course TEXT NOT NULL CHECK (
    course IN (
      'UI/UX Design Mastery',
      'Full-Stack Web Development',
      'Filmmaking & Video Editing'
    )
  ),
  agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS leads_phone_idx ON leads (phone);
CREATE INDEX IF NOT EXISTS leads_course_idx ON leads (course);

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS call_records (
  id BIGSERIAL PRIMARY KEY,
  snapserve_call_id TEXT,
  agent_id TEXT,
  agent_name TEXT,
  phone TEXT,
  student_name TEXT,
  course TEXT,
  duration INTEGER NOT NULL DEFAULT 0,
  summary TEXT,
  success_evaluation TEXT,
  recording_url TEXT,
  transcript TEXT,
  status TEXT NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

ALTER TABLE call_records ADD COLUMN IF NOT EXISTS student_name TEXT;
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS course TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS call_records_snapserve_id_idx
ON call_records (snapserve_call_id)
WHERE snapserve_call_id IS NOT NULL AND snapserve_call_id <> '';

CREATE INDEX IF NOT EXISTS call_records_phone_idx ON call_records (phone);
CREATE INDEX IF NOT EXISTS call_records_created_at_idx ON call_records (created_at DESC);

CREATE TABLE IF NOT EXISTS snapserve_webhooks (
  id BIGSERIAL PRIMARY KEY,
  webhook_id TEXT,
  event_type TEXT,
  call_id TEXT,
  phone TEXT,
  payload TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS snapserve_webhooks_call_id_idx ON snapserve_webhooks (call_id);
