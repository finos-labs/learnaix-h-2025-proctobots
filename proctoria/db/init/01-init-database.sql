-- Database initialization script for Proctoria
-- This script creates the necessary tables and indexes

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create proctoring_sessions table
CREATE TABLE IF NOT EXISTS proctoring_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id BIGINT NOT NULL,
    quiz_id BIGINT NOT NULL,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'active',
    risk_score FLOAT DEFAULT 0.0,
    violations_count INTEGER DEFAULT 0,
    identity_verified BOOLEAN DEFAULT FALSE,
    ip_address INET,
    user_agent TEXT,
    browser_fingerprint TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create violations table
CREATE TABLE IF NOT EXISTS violations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES proctoring_sessions(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    description TEXT,
    confidence FLOAT NOT NULL DEFAULT 0.0,
    severity VARCHAR(20) DEFAULT 'medium',
    screenshot_url TEXT,
    metadata JSONB,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed BOOLEAN DEFAULT FALSE,
    action_taken TEXT
);

-- Create session_analytics table
CREATE TABLE IF NOT EXISTS session_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES proctoring_sessions(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB,
    mouse_movements INTEGER DEFAULT 0,
    keystroke_count INTEGER DEFAULT 0,
    focus_loss_count INTEGER DEFAULT 0,
    tab_switches INTEGER DEFAULT 0,
    window_blur_count INTEGER DEFAULT 0,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create identity_verifications table
CREATE TABLE IF NOT EXISTS identity_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES proctoring_sessions(id) ON DELETE CASCADE,
    verification_type VARCHAR(50) NOT NULL,
    reference_image_url TEXT,
    verification_image_url TEXT,
    confidence_score FLOAT,
    verification_result VARCHAR(20),
    failure_reason TEXT,
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    biometric_data JSONB
);

-- Create plagiarism_reports table
CREATE TABLE IF NOT EXISTS plagiarism_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES proctoring_sessions(id) ON DELETE CASCADE,
    submission_id VARCHAR(255),
    language VARCHAR(50),
    similarity_score FLOAT,
    matches_found INTEGER DEFAULT 0,
    report_url TEXT,
    report_data JSONB,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending'
);

-- Create admin_interventions table
CREATE TABLE IF NOT EXISTS admin_interventions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES proctoring_sessions(id) ON DELETE CASCADE,
    admin_id BIGINT NOT NULL,
    intervention_type VARCHAR(50) NOT NULL,
    message TEXT,
    action_taken VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved BOOLEAN DEFAULT FALSE,
    resolution_notes TEXT
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON proctoring_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_quiz_id ON proctoring_sessions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON proctoring_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON proctoring_sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON proctoring_sessions(session_token);

CREATE INDEX IF NOT EXISTS idx_violations_session_id ON violations(session_id);
CREATE INDEX IF NOT EXISTS idx_violations_type ON violations(type);
CREATE INDEX IF NOT EXISTS idx_violations_severity ON violations(severity);
CREATE INDEX IF NOT EXISTS idx_violations_detected_at ON violations(detected_at);
CREATE INDEX IF NOT EXISTS idx_violations_processed ON violations(processed);

CREATE INDEX IF NOT EXISTS idx_analytics_session_id ON session_analytics(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON session_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_recorded_at ON session_analytics(recorded_at);

CREATE INDEX IF NOT EXISTS idx_identity_session_id ON identity_verifications(session_id);
CREATE INDEX IF NOT EXISTS idx_identity_type ON identity_verifications(verification_type);
CREATE INDEX IF NOT EXISTS idx_identity_result ON identity_verifications(verification_result);

CREATE INDEX IF NOT EXISTS idx_plagiarism_session_id ON plagiarism_reports(session_id);
CREATE INDEX IF NOT EXISTS idx_plagiarism_status ON plagiarism_reports(status);
CREATE INDEX IF NOT EXISTS idx_plagiarism_score ON plagiarism_reports(similarity_score);

CREATE INDEX IF NOT EXISTS idx_interventions_session_id ON admin_interventions(session_id);
CREATE INDEX IF NOT EXISTS idx_interventions_admin_id ON admin_interventions(admin_id);
CREATE INDEX IF NOT EXISTS idx_interventions_type ON admin_interventions(intervention_type);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sessions_updated_at 
    BEFORE UPDATE ON proctoring_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to calculate risk score
CREATE OR REPLACE FUNCTION calculate_risk_score(session_uuid UUID)
RETURNS FLOAT AS $$
DECLARE
    total_score FLOAT := 0;
    violation_record RECORD;
BEGIN
    -- Calculate risk score based on violations
    FOR violation_record IN 
        SELECT type, confidence, severity
        FROM violations 
        WHERE session_id = session_uuid
    LOOP
        CASE violation_record.severity
            WHEN 'critical' THEN total_score := total_score + (violation_record.confidence * 0.4);
            WHEN 'high' THEN total_score := total_score + (violation_record.confidence * 0.3);
            WHEN 'medium' THEN total_score := total_score + (violation_record.confidence * 0.2);
            WHEN 'low' THEN total_score := total_score + (violation_record.confidence * 0.1);
        END CASE;
    END LOOP;
    
    -- Cap the risk score at 1.0
    IF total_score > 1.0 THEN
        total_score := 1.0;
    END IF;
    
    RETURN total_score;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update risk score
CREATE OR REPLACE FUNCTION update_session_risk_score()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE proctoring_sessions 
    SET risk_score = calculate_risk_score(NEW.session_id),
        violations_count = (
            SELECT COUNT(*) 
            FROM violations 
            WHERE session_id = NEW.session_id
        )
    WHERE id = NEW.session_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_risk_score
    AFTER INSERT OR UPDATE ON violations
    FOR EACH ROW EXECUTE FUNCTION update_session_risk_score();

-- Insert default violation types for reference
INSERT INTO violations (id, session_id, type, description, confidence, severity) VALUES
    (uuid_generate_v4(), uuid_generate_v4(), 'face_not_detected', 'Student face not clearly visible', 0.8, 'high'),
    (uuid_generate_v4(), uuid_generate_v4(), 'multiple_faces', 'Multiple faces detected in frame', 0.9, 'critical'),
    (uuid_generate_v4(), uuid_generate_v4(), 'phone_detected', 'Mobile device detected', 0.7, 'high'),
    (uuid_generate_v4(), uuid_generate_v4(), 'tab_switch', 'Browser tab switching detected', 0.6, 'medium'),
    (uuid_generate_v4(), uuid_generate_v4(), 'copy_paste', 'Copy-paste activity detected', 0.9, 'critical')
ON CONFLICT DO NOTHING;

-- Create views for analytics
CREATE OR REPLACE VIEW session_summary AS
SELECT 
    s.id,
    s.user_id,
    s.quiz_id,
    s.start_time,
    s.end_time,
    s.status,
    s.risk_score,
    s.violations_count,
    COUNT(v.id) as total_violations,
    COUNT(CASE WHEN v.severity = 'critical' THEN 1 END) as critical_violations,
    COUNT(CASE WHEN v.severity = 'high' THEN 1 END) as high_violations,
    iv.verification_result as identity_status
FROM proctoring_sessions s
LEFT JOIN violations v ON s.id = v.session_id
LEFT JOIN identity_verifications iv ON s.id = iv.session_id
GROUP BY s.id, iv.verification_result;

CREATE OR REPLACE VIEW violation_statistics AS
SELECT 
    type,
    COUNT(*) as total_count,
    AVG(confidence) as avg_confidence,
    COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_count,
    COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_count,
    COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_count,
    COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_count
FROM violations
GROUP BY type
ORDER BY total_count DESC;

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO proctoria;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO proctoria;