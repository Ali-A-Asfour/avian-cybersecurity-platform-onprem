-- Migration: Add queue positioning field for help desk tickets
-- Date: 2024-01-01
-- Description: Add queue_position_updated_at field for deterministic queue ordering in help desk system

-- Add queue_position_updated_at field to tickets table
ALTER TABLE tickets 
ADD COLUMN queue_position_updated_at TIMESTAMP NOT NULL DEFAULT NOW();

-- Create index for queue positioning
CREATE INDEX IF NOT EXISTS tickets_queue_position_idx ON tickets(queue_position_updated_at);

-- Update existing tickets to have queue_position_updated_at = created_at for consistency
UPDATE tickets 
SET queue_position_updated_at = created_at 
WHERE queue_position_updated_at IS NULL;

-- Add comment explaining the field purpose
COMMENT ON COLUMN tickets.queue_position_updated_at IS 'Timestamp used for deterministic queue ordering. Updated when ticket is assigned to move to bottom of queue.';