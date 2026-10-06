ALTER TABLE audit_logs ADD COLUMN entity_label TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_action_time
ON audit_logs(entity, action, occurred_at DESC);
