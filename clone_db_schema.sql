-- 1. Create development schema
CREATE SCHEMA IF NOT EXISTS development;

-- 2. Function to clone table structure & contents from public schema
CREATE OR REPLACE FUNCTION development.clone_schema_data(source_schema text, dest_schema text) RETURNS void AS $$
DECLARE
  r record;
BEGIN
  FOR r IN 
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = source_schema AND table_type = 'BASE TABLE'
  LOOP
    EXECUTE 'CREATE TABLE IF NOT EXISTS ' || quote_ident(dest_schema) || '.' || quote_ident(r.table_name) || ' (LIKE ' || quote_ident(source_schema) || '.' || quote_ident(r.table_name) || ' INCLUDING ALL)';
    EXECUTE 'INSERT INTO ' || quote_ident(dest_schema) || '.' || quote_ident(r.table_name) || ' SELECT * FROM ' || quote_ident(source_schema) || '.' || quote_ident(r.table_name) || ' ON CONFLICT DO NOTHING';
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 3. Execute clone
SELECT development.clone_schema_data('public', 'development');
