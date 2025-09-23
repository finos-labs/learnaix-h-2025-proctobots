-- Proctoria Database Initialization Script
-- This script sets up the basic database structure for the Proctoria system

-- Create database (if not exists)
SELECT 'CREATE DATABASE proctoria' WHERE NOT EXISTS (
    SELECT FROM pg_database WHERE datname = 'proctoria'
)\gexec

-- Connect to proctoria database
\c proctoria;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create basic schema
CREATE SCHEMA IF NOT EXISTS proctoria;

-- Basic tables for demo (simplified for hackathon)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'student',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER REFERENCES users(id),
    quiz_id INTEGER,
    status VARCHAR(50) DEFAULT 'active',
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    violations_count INTEGER DEFAULT 0,
    risk_score DECIMAL(5,2) DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS violations (
    id SERIAL PRIMARY KEY,
    session_id UUID REFERENCES sessions(id),
    type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) DEFAULT 'medium',
    description TEXT,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved BOOLEAN DEFAULT FALSE
);

-- Insert sample data for demo
INSERT INTO users (username, email, password_hash, role) VALUES
('admin', 'admin@proctoria.com', crypt('admin123', gen_salt('bf')), 'admin'),
('student1', 'student1@university.edu', crypt('student123', gen_salt('bf')), 'student'),
('instructor1', 'instructor1@university.edu', crypt('instructor123', gen_salt('bf')), 'instructor')
ON CONFLICT (username) DO NOTHING;

-- Sample session data
INSERT INTO sessions (id, user_id, quiz_id, status, violations_count, risk_score) VALUES
(uuid_generate_v4(), 2, 1, 'completed', 2, 15.5),
(uuid_generate_v4(), 2, 2, 'active', 0, 0.0)
ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO proctoria_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO proctoria_user;

-- Success message
SELECT 'Proctoria database initialized successfully!' as status;