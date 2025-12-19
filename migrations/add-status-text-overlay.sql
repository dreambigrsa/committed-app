-- Add draggable text overlay support for image/video statuses
-- Stores normalized position (0..1) so it renders consistently across devices.

ALTER TABLE public.statuses
  ADD COLUMN IF NOT EXISTS text_position_x real DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS text_position_y real DEFAULT 0.5;


