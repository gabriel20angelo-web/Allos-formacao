-- Allow users to set a custom name for certificates
-- (Google name may be incomplete or wrong)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS certificate_name TEXT;
