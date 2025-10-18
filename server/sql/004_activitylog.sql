CREATE TABLE IF NOT EXISTS activity_logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    action_type TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_role TEXT NOT NULL,
    details JSONB NOT NULL,
    ip_address TEXT
);
CREATE INDEX idx_activity_logs_timestamp ON activity_logs(timestamp DESC);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_name);
CREATE INDEX idx_activity_logs_action ON activity_logs(action_type);
/*run in query tool*/