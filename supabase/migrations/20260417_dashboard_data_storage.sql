-- Run this in the Supabase SQL Editor to enable full dashboard retrieval.
--
-- 1. Add data_file column to saved_dashboards
ALTER TABLE saved_dashboards
  ADD COLUMN IF NOT EXISTS data_file TEXT;

-- 2. Create the dashboard-data storage bucket (private)
--    Run this in the Supabase Dashboard → Storage → New bucket:
--      Name: dashboard-data
--      Public: false
--
--    OR run via SQL (requires pg_net / storage extensions to be available):
INSERT INTO storage.buckets (id, name, public)
VALUES ('dashboard-data', 'dashboard-data', false)
ON CONFLICT (id) DO NOTHING;
