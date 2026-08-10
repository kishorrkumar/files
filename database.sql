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

CREATE TABLE IF NOT EXISTS snapserve_meeting_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_id VARCHAR(20) UNIQUE NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(24) NOT NULL,
  email VARCHAR(254) NOT NULL,
  interest VARCHAR(40) NOT NULL,
  attend VARCHAR(40) NOT NULL,
  lead_status VARCHAR(20) NOT NULL DEFAULT 'new',
  call_status VARCHAR(20) NOT NULL DEFAULT 'not_called',
  call_attempts INTEGER NOT NULL DEFAULT 0,
  assigned_agent_id TEXT,
  last_call_id TEXT,
  last_called_at TIMESTAMPTZ,
  call_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS snapserve_meeting_leads_created_idx
ON snapserve_meeting_leads (created_at DESC);

CREATE INDEX IF NOT EXISTS snapserve_meeting_leads_call_status_idx
ON snapserve_meeting_leads (call_status);
