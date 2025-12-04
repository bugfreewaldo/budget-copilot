-- Initial database setup for PostgreSQL

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create indexes for common queries (migrations will handle schema)
-- This file is for any initial setup that needs to happen before the app runs

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE budget_copilot TO budget_user;
