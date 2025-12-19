-- Fix GIF sticker packs to ensure each pack has unique stickers
-- This script deletes existing GIF stickers and re-inserts them with correct pack assignments

-- Delete all existing animated GIF stickers
DELETE FROM stickers WHERE is_animated = true;

-- Re-insert animated GIF stickers for GIF Reactions pack
INSERT INTO stickers (id, pack_id, name, image_url, is_animated, display_order, created_at, updated_at)
SELECT
  gen_random_uuid(),
  sp.id,
  emoji.name,
  emoji.gif_url,
  true,
  emoji.order_num,
  NOW(),
  NOW()
FROM sticker_packs sp
CROSS JOIN (VALUES
  ('https://media.giphy.com/media/reactions-pack-1-thumbs-up/giphy.gif', 'Thumbs Up GIF', 1),
  ('https://media.giphy.com/media/reactions-pack-1-thumbs-down/giphy.gif', 'Thumbs Down GIF', 2),
  ('https://media.giphy.com/media/reactions-pack-1-clapping/giphy.gif', 'Clapping Hands GIF', 3),
  ('https://media.giphy.com/media/reactions-pack-1-fire/giphy.gif', 'Fire GIF', 4),
  ('https://media.giphy.com/media/reactions-pack-1-100/giphy.gif', '100 GIF', 5),
  ('https://media.giphy.com/media/reactions-pack-1-applause/giphy.gif', 'Applause GIF', 6),
  ('https://media.giphy.com/media/reactions-pack-1-lit/giphy.gif', 'Lit GIF', 7),
  ('https://media.giphy.com/media/reactions-pack-1-no-way/giphy.gif', 'No Way GIF', 8),
  ('https://media.giphy.com/media/reactions-pack-1-yes/giphy.gif', 'Yes GIF', 9),
  ('https://media.giphy.com/media/reactions-pack-1-amazing/giphy.gif', 'Amazing GIF', 10),
  ('https://media.giphy.com/media/reactions-pack-1-perfect/giphy.gif', 'Perfect GIF', 11),
  ('https://media.giphy.com/media/reactions-pack-1-bravo/giphy.gif', 'Bravo GIF', 12),
  ('https://media.giphy.com/media/reactions-pack-1-epic/giphy.gif', 'Epic GIF', 13),
  ('https://media.giphy.com/media/reactions-pack-1-mind-blown/giphy.gif', 'Mind Blown GIF', 14),
  ('https://media.giphy.com/media/reactions-pack-1-wow/giphy.gif', 'Wow GIF', 15),
  ('https://media.giphy.com/media/reactions-pack-1-incredible/giphy.gif', 'Incredible GIF', 16),
  ('https://media.giphy.com/media/reactions-pack-1-awesome/giphy.gif', 'Awesome GIF', 17),
  ('https://media.giphy.com/media/reactions-pack-1-fantastic/giphy.gif', 'Fantastic GIF', 18),
  ('https://media.giphy.com/media/reactions-pack-1-unbelievable/giphy.gif', 'Unbelievable GIF', 19),
  ('https://media.giphy.com/media/reactions-pack-1-outstanding/giphy.gif', 'Outstanding GIF', 20)
) AS emoji(gif_url, name, order_num)
WHERE sp.name = 'GIF Reactions';

-- Re-insert animated GIF stickers for GIF Celebrations pack
INSERT INTO stickers (id, pack_id, name, image_url, is_animated, display_order, created_at, updated_at)
SELECT
  gen_random_uuid(),
  sp.id,
  emoji.name,
  emoji.gif_url,
  true,
  emoji.order_num,
  NOW(),
  NOW()
FROM sticker_packs sp
CROSS JOIN (VALUES
  ('https://media.giphy.com/media/celebrations-pack-1-party-popper/giphy.gif', 'Party Popper GIF', 1),
  ('https://media.giphy.com/media/celebrations-pack-1-confetti/giphy.gif', 'Confetti GIF', 2),
  ('https://media.giphy.com/media/celebrations-pack-1-celebration/giphy.gif', 'Celebration GIF', 3),
  ('https://media.giphy.com/media/celebrations-pack-1-birthday/giphy.gif', 'Birthday GIF', 4),
  ('https://media.giphy.com/media/celebrations-pack-1-congratulations/giphy.gif', 'Congratulations GIF', 5),
  ('https://media.giphy.com/media/celebrations-pack-1-cheers/giphy.gif', 'Cheers GIF', 6),
  ('https://media.giphy.com/media/celebrations-pack-1-victory/giphy.gif', 'Victory GIF', 7),
  ('https://media.giphy.com/media/celebrations-pack-1-success/giphy.gif', 'Success GIF', 8),
  ('https://media.giphy.com/media/celebrations-pack-1-win/giphy.gif', 'Win GIF', 9),
  ('https://media.giphy.com/media/celebrations-pack-1-achievement/giphy.gif', 'Achievement GIF', 10),
  ('https://media.giphy.com/media/celebrations-pack-1-milestone/giphy.gif', 'Milestone GIF', 11),
  ('https://media.giphy.com/media/celebrations-pack-1-anniversary/giphy.gif', 'Anniversary GIF', 12),
  ('https://media.giphy.com/media/celebrations-pack-1-new-year/giphy.gif', 'New Year GIF', 13),
  ('https://media.giphy.com/media/celebrations-pack-1-holiday/giphy.gif', 'Holiday GIF', 14),
  ('https://media.giphy.com/media/celebrations-pack-1-festival/giphy.gif', 'Festival GIF', 15),
  ('https://media.giphy.com/media/celebrations-pack-1-carnival/giphy.gif', 'Carnival GIF', 16),
  ('https://media.giphy.com/media/celebrations-pack-1-parade/giphy.gif', 'Parade GIF', 17),
  ('https://media.giphy.com/media/celebrations-pack-1-fireworks/giphy.gif', 'Fireworks GIF', 18),
  ('https://media.giphy.com/media/celebrations-pack-1-sparkles/giphy.gif', 'Sparkles GIF', 19),
  ('https://media.giphy.com/media/celebrations-pack-1-magic/giphy.gif', 'Magic GIF', 20)
) AS emoji(gif_url, name, order_num)
WHERE sp.name = 'GIF Celebrations';

-- Re-insert animated GIF stickers for GIF Emotions pack
INSERT INTO stickers (id, pack_id, name, image_url, is_animated, display_order, created_at, updated_at)
SELECT
  gen_random_uuid(),
  sp.id,
  emoji.name,
  emoji.gif_url,
  true,
  emoji.order_num,
  NOW(),
  NOW()
FROM sticker_packs sp
CROSS JOIN (VALUES
  ('https://media.giphy.com/media/emotions-pack-1-laughing/giphy.gif', 'Laughing GIF', 1),
  ('https://media.giphy.com/media/emotions-pack-1-crying/giphy.gif', 'Crying GIF', 2),
  ('https://media.giphy.com/media/emotions-pack-1-love/giphy.gif', 'Love GIF', 3),
  ('https://media.giphy.com/media/emotions-pack-1-heart-eyes/giphy.gif', 'Heart Eyes GIF', 4),
  ('https://media.giphy.com/media/emotions-pack-1-kiss/giphy.gif', 'Kiss GIF', 5),
  ('https://media.giphy.com/media/emotions-pack-1-hug/giphy.gif', 'Hug GIF', 6),
  ('https://media.giphy.com/media/emotions-pack-1-angry/giphy.gif', 'Angry GIF', 7),
  ('https://media.giphy.com/media/emotions-pack-1-sad/giphy.gif', 'Sad GIF', 8),
  ('https://media.giphy.com/media/emotions-pack-1-happy/giphy.gif', 'Happy GIF', 9),
  ('https://media.giphy.com/media/emotions-pack-1-excited/giphy.gif', 'Excited GIF', 10),
  ('https://media.giphy.com/media/emotions-pack-1-surprised/giphy.gif', 'Surprised GIF', 11),
  ('https://media.giphy.com/media/emotions-pack-1-shocked/giphy.gif', 'Shocked GIF', 12),
  ('https://media.giphy.com/media/emotions-pack-1-confused/giphy.gif', 'Confused GIF', 13),
  ('https://media.giphy.com/media/emotions-pack-1-thinking/giphy.gif', 'Thinking GIF', 14),
  ('https://media.giphy.com/media/emotions-pack-1-sleepy/giphy.gif', 'Sleepy GIF', 15),
  ('https://media.giphy.com/media/emotions-pack-1-tired/giphy.gif', 'Tired GIF', 16),
  ('https://media.giphy.com/media/emotions-pack-1-energetic/giphy.gif', 'Energetic GIF', 17),
  ('https://media.giphy.com/media/emotions-pack-1-proud/giphy.gif', 'Proud GIF', 18),
  ('https://media.giphy.com/media/emotions-pack-1-shy/giphy.gif', 'Shy GIF', 19),
  ('https://media.giphy.com/media/emotions-pack-1-blushing/giphy.gif', 'Blushing GIF', 20)
) AS emoji(gif_url, name, order_num)
WHERE sp.name = 'GIF Emotions';

-- Re-insert animated GIF stickers for GIF Fun & Cute pack
INSERT INTO stickers (id, pack_id, name, image_url, is_animated, display_order, created_at, updated_at)
SELECT
  gen_random_uuid(),
  sp.id,
  emoji.name,
  emoji.gif_url,
  true,
  emoji.order_num,
  NOW(),
  NOW()
FROM sticker_packs sp
CROSS JOIN (VALUES
  ('https://media.giphy.com/media/fun-cute-pack-1-cat/giphy.gif', 'Cute Cat GIF', 1),
  ('https://media.giphy.com/media/fun-cute-pack-1-dog/giphy.gif', 'Cute Dog GIF', 2),
  ('https://media.giphy.com/media/fun-cute-pack-1-dancing/giphy.gif', 'Dancing GIF', 3),
  ('https://media.giphy.com/media/fun-cute-pack-1-waving/giphy.gif', 'Waving GIF', 4),
  ('https://media.giphy.com/media/fun-cute-pack-1-jumping/giphy.gif', 'Jumping GIF', 5),
  ('https://media.giphy.com/media/fun-cute-pack-1-spinning/giphy.gif', 'Spinning GIF', 6),
  ('https://media.giphy.com/media/fun-cute-pack-1-bouncing/giphy.gif', 'Bouncing GIF', 7),
  ('https://media.giphy.com/media/fun-cute-pack-1-winking/giphy.gif', 'Winking GIF', 8),
  ('https://media.giphy.com/media/fun-cute-pack-1-blowing-kiss/giphy.gif', 'Blowing Kiss GIF', 9),
  ('https://media.giphy.com/media/fun-cute-pack-1-high-five/giphy.gif', 'High Five GIF', 10),
  ('https://media.giphy.com/media/fun-cute-pack-1-fist-bump/giphy.gif', 'Fist Bump GIF', 11),
  ('https://media.giphy.com/media/fun-cute-pack-1-peace-sign/giphy.gif', 'Peace Sign GIF', 12),
  ('https://media.giphy.com/media/fun-cute-pack-1-rock-on/giphy.gif', 'Rock On GIF', 13),
  ('https://media.giphy.com/media/fun-cute-pack-1-ok-sign/giphy.gif', 'OK Sign GIF', 14),
  ('https://media.giphy.com/media/fun-cute-pack-1-pointing/giphy.gif', 'Pointing GIF', 15),
  ('https://media.giphy.com/media/fun-cute-pack-1-shrugging/giphy.gif', 'Shrugging GIF', 16),
  ('https://media.giphy.com/media/fun-cute-pack-1-face-palm/giphy.gif', 'Face Palm GIF', 17),
  ('https://media.giphy.com/media/fun-cute-pack-1-eye-roll/giphy.gif', 'Eye Roll GIF', 18),
  ('https://media.giphy.com/media/fun-cute-pack-1-smirk/giphy.gif', 'Smirk GIF', 19),
  ('https://media.giphy.com/media/fun-cute-pack-1-cool/giphy.gif', 'Cool GIF', 20)
) AS emoji(gif_url, name, order_num)
WHERE sp.name = 'GIF Fun & Cute';

