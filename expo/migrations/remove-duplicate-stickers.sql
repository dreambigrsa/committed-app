-- Remove duplicate stickers from the database
-- This script removes duplicate stickers based on pack_id and name, keeping the first occurrence

-- First, show how many duplicates exist (for reference)
SELECT 
  pack_id,
  name,
  COUNT(*) as duplicate_count
FROM stickers
GROUP BY pack_id, name
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Delete duplicate stickers, keeping only the one with the lowest id (first created)
DELETE FROM stickers
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY pack_id, name 
        ORDER BY created_at ASC, id ASC
      ) AS row_num
    FROM stickers
  ) AS duplicates
  WHERE row_num > 1
);

-- Optional: Also remove stickers that appear in multiple packs with the same name
-- (Uncomment if you want to ensure each sticker name appears in only one pack)
-- This keeps the sticker in the pack with the lowest pack_id
/*
DELETE FROM stickers
WHERE id IN (
  SELECT s2.id
  FROM stickers s1
  INNER JOIN stickers s2 ON s1.name = s2.name AND s1.pack_id != s2.pack_id
  WHERE s1.pack_id < s2.pack_id
);
*/

