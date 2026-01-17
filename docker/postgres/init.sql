-- PostgreSQL initialization script for Complyx
-- This script runs when the PostgreSQL container is first created

-- Create database if it doesn't exist (already created by POSTGRES_DB env var)
-- But we can add any initial setup here

-- Set timezone
SET timezone = 'UTC';

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Note: Database schema will be managed by Prisma migrations
