-- Add file_size column to documents table
ALTER TABLE documents ADD COLUMN file_size INTEGER;

-- Update existing documents with calculated size from full_text
UPDATE documents SET file_size = LENGTH(full_text) WHERE file_size IS NULL;
