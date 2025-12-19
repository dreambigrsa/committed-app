-- Add basic sticker packs with emoji-based stickers
-- This migration creates default sticker packs that users can use immediately
-- The stickers use publicly available emoji images from a CDN

-- Create sticker_packs table if it doesn't exist
CREATE TABLE IF NOT EXISTS sticker_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create stickers table if it doesn't exist
CREATE TABLE IF NOT EXISTS stickers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID NOT NULL REFERENCES sticker_packs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  is_animated BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_stickers_pack_id ON stickers(pack_id);
CREATE INDEX IF NOT EXISTS idx_sticker_packs_active ON sticker_packs(is_active);
CREATE INDEX IF NOT EXISTS idx_sticker_packs_featured ON sticker_packs(is_featured);

-- Enable RLS
ALTER TABLE sticker_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE stickers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Anyone can view active sticker packs" ON sticker_packs;
DROP POLICY IF EXISTS "Anyone can view stickers from active packs" ON stickers;

-- RLS Policies for sticker_packs (everyone can view active packs)
CREATE POLICY "Anyone can view active sticker packs"
  ON sticker_packs FOR SELECT
  USING (is_active = true);

-- RLS Policies for stickers (everyone can view stickers from active packs)
CREATE POLICY "Anyone can view stickers from active packs"
  ON stickers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sticker_packs
      WHERE sticker_packs.id = stickers.pack_id
      AND sticker_packs.is_active = true
    )
  );

-- Insert basic sticker packs (only if they don't already exist)
INSERT INTO sticker_packs (id, name, description, icon_url, is_active, is_featured, display_order, created_at, updated_at)
SELECT
  gen_random_uuid(),
  pack_data.name,
  pack_data.description,
  pack_data.icon_url,
  pack_data.is_active,
  pack_data.is_featured,
  pack_data.display_order,
  NOW(),
  NOW()
FROM (VALUES
  ('Emoji Reactions', 'Express yourself with classic emoji reactions', 'https://emojicdn.elk.sh/😀', true, true, 1),
  ('Love & Hearts', 'Show your love with heart emojis', 'https://emojicdn.elk.sh/❤️', true, true, 2),
  ('Celebrations', 'Celebrate special moments', 'https://emojicdn.elk.sh/🎉', true, true, 3),
  ('Fun & Playful', 'Fun and playful stickers', 'https://emojicdn.elk.sh/😄', true, true, 4),
  ('Thumbs & Gestures', 'Thumbs up, down, and other gestures', 'https://emojicdn.elk.sh/👍', true, false, 5),
  ('Animals & Nature', 'Cute animals and nature emojis', 'https://emojicdn.elk.sh/🐶', true, true, 6),
  ('Food & Drinks', 'Delicious food and drinks', 'https://emojicdn.elk.sh/🍕', true, true, 7),
  ('Travel & Places', 'Travel destinations and places', 'https://emojicdn.elk.sh/✈️', true, false, 8),
  ('Sports & Activities', 'Sports and fun activities', 'https://emojicdn.elk.sh/⚽', true, false, 9),
  ('Weather & Nature', 'Weather and natural elements', 'https://emojicdn.elk.sh/☀️', true, false, 10),
  ('Objects & Symbols', 'Everyday objects and symbols', 'https://emojicdn.elk.sh/💡', true, false, 11),
  ('Music & Arts', 'Music notes and artistic expressions', 'https://emojicdn.elk.sh/🎵', true, false, 12),
  ('Technology', 'Tech gadgets and devices', 'https://emojicdn.elk.sh/📱', true, false, 13),
  ('Time & Calendar', 'Time-related emojis', 'https://emojicdn.elk.sh/⏰', true, false, 14),
  ('Emotions & Feelings', 'Express your emotions', 'https://emojicdn.elk.sh/😢', true, false, 15),
  ('GIF Reactions', 'Animated reaction GIFs', 'https://emojicdn.elk.sh/🎬', true, true, 16),
  ('GIF Celebrations', 'Animated celebration GIFs', 'https://emojicdn.elk.sh/🎊', true, true, 17),
  ('GIF Emotions', 'Animated emotional GIFs', 'https://emojicdn.elk.sh/😍', true, false, 18),
  ('GIF Fun & Cute', 'Animated fun and cute GIFs', 'https://emojicdn.elk.sh/😊', true, false, 19)
) AS pack_data(name, description, icon_url, is_active, is_featured, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM sticker_packs WHERE sticker_packs.name = pack_data.name
);

-- Insert stickers for Emoji Reactions pack
INSERT INTO stickers (id, pack_id, name, image_url, is_animated, display_order, created_at, updated_at)
SELECT
  gen_random_uuid(),
  sp.id,
  emoji.name,
  'https://emojicdn.elk.sh/' || emoji.emoji,
  false,
  emoji.order_num,
  NOW(),
  NOW()
FROM sticker_packs sp
CROSS JOIN (VALUES
  ('😀', 'Grinning Face', 1),
  ('😃', 'Grinning Face with Big Eyes', 2),
  ('😄', 'Grinning Face with Smiling Eyes', 3),
  ('😁', 'Beaming Face with Smiling Eyes', 4),
  ('😆', 'Grinning Squinting Face', 5),
  ('😅', 'Grinning Face with Sweat', 6),
  ('🤣', 'Rolling on the Floor Laughing', 7),
  ('😂', 'Face with Tears of Joy', 8),
  ('🙂', 'Slightly Smiling Face', 9),
  ('🙃', 'Upside-Down Face', 10),
  ('😉', 'Winking Face', 11),
  ('😊', 'Smiling Face with Smiling Eyes', 12),
  ('😇', 'Smiling Face with Halo', 13),
  ('🥰', 'Smiling Face with Hearts', 14),
  ('😍', 'Smiling Face with Heart-Eyes', 15),
  ('🤩', 'Star-Struck', 16),
  ('😘', 'Face Blowing a Kiss', 17),
  ('😗', 'Kissing Face', 18),
  ('😚', 'Kissing Face with Closed Eyes', 19),
  ('😙', 'Kissing Face with Smiling Eyes', 20)
) AS emoji(emoji, name, order_num)
WHERE sp.name = 'Emoji Reactions'
AND NOT EXISTS (
  SELECT 1 FROM stickers WHERE stickers.pack_id = sp.id AND stickers.name = emoji.name
);

-- Insert stickers for Love & Hearts pack
INSERT INTO stickers (id, pack_id, name, image_url, is_animated, display_order, created_at, updated_at)
SELECT
  gen_random_uuid(),
  sp.id,
  emoji.name,
  'https://emojicdn.elk.sh/' || emoji.emoji,
  false,
  emoji.order_num,
  NOW(),
  NOW()
FROM sticker_packs sp
CROSS JOIN (VALUES
  ('❤️', 'Red Heart', 1),
  ('🧡', 'Orange Heart', 2),
  ('💛', 'Yellow Heart', 3),
  ('💚', 'Green Heart', 4),
  ('💙', 'Blue Heart', 5),
  ('💜', 'Purple Heart', 6),
  ('🖤', 'Black Heart', 7),
  ('🤍', 'White Heart', 8),
  ('🤎', 'Brown Heart', 9),
  ('💔', 'Broken Heart', 10),
  ('❣️', 'Heart Exclamation', 11),
  ('💕', 'Two Hearts', 12),
  ('💞', 'Revolving Hearts', 13),
  ('💓', 'Beating Heart', 14),
  ('💗', 'Growing Heart', 15),
  ('💖', 'Sparkling Heart', 16),
  ('💘', 'Heart with Arrow', 17),
  ('💝', 'Heart with Ribbon', 18),
  ('💟', 'Heart Decoration', 19),
  ('☮️', 'Peace Symbol', 20)
) AS emoji(emoji, name, order_num)
WHERE sp.name = 'Love & Hearts'
AND NOT EXISTS (
  SELECT 1 FROM stickers WHERE stickers.pack_id = sp.id AND stickers.name = emoji.name
);

-- Insert stickers for Celebrations pack
INSERT INTO stickers (id, pack_id, name, image_url, is_animated, display_order, created_at, updated_at)
SELECT
  gen_random_uuid(),
  sp.id,
  emoji.name,
  'https://emojicdn.elk.sh/' || emoji.emoji,
  false,
  emoji.order_num,
  NOW(),
  NOW()
FROM sticker_packs sp
CROSS JOIN (VALUES
  ('🎉', 'Party Popper', 1),
  ('🎊', 'Confetti Ball', 2),
  ('🎈', 'Balloon', 3),
  ('🎁', 'Wrapped Gift', 4),
  ('🎀', 'Ribbon', 5),
  ('🎂', 'Birthday Cake', 6),
  ('🍰', 'Shortcake', 7),
  ('🧁', 'Cupcake', 8),
  ('🥳', 'Partying Face', 9),
  ('🎆', 'Fireworks', 10),
  ('🎇', 'Sparkler', 11),
  ('✨', 'Sparkles', 12),
  ('🌟', 'Glowing Star', 13),
  ('⭐', 'Star', 14),
  ('💫', 'Dizzy', 15),
  ('🎵', 'Musical Note', 16),
  ('🎶', 'Musical Notes', 17),
  ('🎤', 'Microphone', 18),
  ('🎧', 'Headphone', 19),
  ('🥂', 'Clinking Glasses', 20)
) AS emoji(emoji, name, order_num)
WHERE sp.name = 'Celebrations'
AND NOT EXISTS (
  SELECT 1 FROM stickers WHERE stickers.pack_id = sp.id AND stickers.name = emoji.name
);

-- Insert stickers for Fun & Playful pack
INSERT INTO stickers (id, pack_id, name, image_url, is_animated, display_order, created_at, updated_at)
SELECT
  gen_random_uuid(),
  sp.id,
  emoji.name,
  'https://emojicdn.elk.sh/' || emoji.emoji,
  false,
  emoji.order_num,
  NOW(),
  NOW()
FROM sticker_packs sp
CROSS JOIN (VALUES
  ('😎', 'Smiling Face with Sunglasses', 1),
  ('🤓', 'Nerd Face', 2),
  ('🧐', 'Face with Monocle', 3),
  ('🤗', 'Hugging Face', 4),
  ('🤔', 'Thinking Face', 5),
  ('🤭', 'Face with Hand Over Mouth', 6),
  ('🤫', 'Shushing Face', 7),
  ('🤤', 'Drooling Face', 8),
  ('😴', 'Sleeping Face', 9),
  ('🤯', 'Exploding Head', 10),
  ('🥳', 'Partying Face', 11),
  ('😎', 'Cool Face', 12),
  ('🤪', 'Zany Face', 13),
  ('😜', 'Winking Face with Tongue', 14),
  ('😝', 'Squinting Face with Tongue', 15),
  ('🤑', 'Money-Mouth Face', 16),
  ('🤠', 'Cowboy Hat Face', 17),
  ('😏', 'Smirking Face', 18),
  ('😒', 'Unamused Face', 19),
  ('🙄', 'Face with Rolling Eyes', 20)
) AS emoji(emoji, name, order_num)
WHERE sp.name = 'Fun & Playful'
AND NOT EXISTS (
  SELECT 1 FROM stickers WHERE stickers.pack_id = sp.id AND stickers.name = emoji.name
);

-- Insert stickers for Thumbs & Gestures pack
INSERT INTO stickers (id, pack_id, name, image_url, is_animated, display_order, created_at, updated_at)
SELECT
  gen_random_uuid(),
  sp.id,
  emoji.name,
  'https://emojicdn.elk.sh/' || emoji.emoji,
  false,
  emoji.order_num,
  NOW(),
  NOW()
FROM sticker_packs sp
CROSS JOIN (VALUES
  ('👍', 'Thumbs Up', 1),
  ('👎', 'Thumbs Down', 2),
  ('👌', 'OK Hand', 3),
  ('✌️', 'Victory Hand', 4),
  ('🤞', 'Crossed Fingers', 5),
  ('🤟', 'Love-You Gesture', 6),
  ('🤘', 'Sign of the Horns', 7),
  ('🤙', 'Call Me Hand', 8),
  ('👏', 'Clapping Hands', 9),
  ('🙌', 'Raising Hands', 10),
  ('👐', 'Open Hands', 11),
  ('🤲', 'Palms Up Together', 12),
  ('🤝', 'Handshake', 13),
  ('🙏', 'Folded Hands', 14),
  ('✍️', 'Writing Hand', 15),
  ('💪', 'Flexed Biceps', 16),
  ('🦾', 'Mechanical Arm', 17),
  ('🦿', 'Mechanical Leg', 18),
  ('🦵', 'Leg', 19),
  ('🦶', 'Foot', 20)
) AS emoji(emoji, name, order_num)
WHERE sp.name = 'Thumbs & Gestures'
AND NOT EXISTS (
  SELECT 1 FROM stickers WHERE stickers.pack_id = sp.id AND stickers.name = emoji.name
);

-- Insert stickers for Animals & Nature pack
INSERT INTO stickers (id, pack_id, name, image_url, is_animated, display_order, created_at, updated_at)
SELECT
  gen_random_uuid(),
  sp.id,
  emoji.name,
  'https://emojicdn.elk.sh/' || emoji.emoji,
  false,
  emoji.order_num,
  NOW(),
  NOW()
FROM sticker_packs sp
CROSS JOIN (VALUES
  ('🐶', 'Dog Face', 1),
  ('🐱', 'Cat Face', 2),
  ('🐭', 'Mouse Face', 3),
  ('🐹', 'Hamster', 4),
  ('🐰', 'Rabbit Face', 5),
  ('🦊', 'Fox', 6),
  ('🐻', 'Bear', 7),
  ('🐼', 'Panda', 8),
  ('🐨', 'Koala', 9),
  ('🐯', 'Tiger Face', 10),
  ('🦁', 'Lion', 11),
  ('🐮', 'Cow Face', 12),
  ('🐷', 'Pig Face', 13),
  ('🐸', 'Frog', 14),
  ('🐵', 'Monkey Face', 15),
  ('🐔', 'Chicken', 16),
  ('🐧', 'Penguin', 17),
  ('🐦', 'Bird', 18),
  ('🦅', 'Eagle', 19),
  ('🦉', 'Owl', 20),
  ('🐴', 'Horse Face', 21),
  ('🦄', 'Unicorn', 22),
  ('🐝', 'Honeybee', 23),
  ('🦋', 'Butterfly', 24),
  ('🐛', 'Bug', 25),
  ('🌳', 'Tree', 26),
  ('🌲', 'Evergreen Tree', 27),
  ('🌴', 'Palm Tree', 28),
  ('🌵', 'Cactus', 29),
  ('🌱', 'Seedling', 30)
) AS emoji(emoji, name, order_num)
WHERE sp.name = 'Animals & Nature'
AND NOT EXISTS (
  SELECT 1 FROM stickers WHERE stickers.pack_id = sp.id AND stickers.name = emoji.name
);

-- Insert stickers for Food & Drinks pack
INSERT INTO stickers (id, pack_id, name, image_url, is_animated, display_order, created_at, updated_at)
SELECT
  gen_random_uuid(),
  sp.id,
  emoji.name,
  'https://emojicdn.elk.sh/' || emoji.emoji,
  false,
  emoji.order_num,
  NOW(),
  NOW()
FROM sticker_packs sp
CROSS JOIN (VALUES
  ('🍕', 'Pizza', 1),
  ('🍔', 'Hamburger', 2),
  ('🍟', 'French Fries', 3),
  ('🌭', 'Hot Dog', 4),
  ('🍗', 'Poultry Leg', 5),
  ('🍖', 'Meat on Bone', 6),
  ('🥩', 'Cut of Meat', 7),
  ('🍝', 'Spaghetti', 8),
  ('🍜', 'Steaming Bowl', 9),
  ('🍲', 'Pot of Food', 10),
  ('🍱', 'Bento Box', 11),
  ('🍣', 'Sushi', 12),
  ('🍛', 'Curry Rice', 13),
  ('🍙', 'Rice Ball', 14),
  ('🍘', 'Rice Cracker', 15),
  ('🍚', 'Cooked Rice', 16),
  ('🍞', 'Bread', 17),
  ('🥐', 'Croissant', 18),
  ('🥖', 'Baguette', 19),
  ('🥨', 'Pretzel', 20),
  ('🧀', 'Cheese', 21),
  ('🥚', 'Egg', 22),
  ('🍳', 'Cooking', 23),
  ('🥞', 'Pancakes', 24),
  ('🥓', 'Bacon', 25),
  ('🥪', 'Sandwich', 26),
  ('🌮', 'Taco', 27),
  ('🌯', 'Burrito', 28),
  ('🥙', 'Stuffed Flatbread', 29),
  ('🍿', 'Popcorn', 30),
  ('🍩', 'Doughnut', 31),
  ('🍪', 'Cookie', 32),
  ('🎂', 'Birthday Cake', 33),
  ('🍰', 'Shortcake', 34),
  ('🧁', 'Cupcake', 35),
  ('🍫', 'Chocolate Bar', 36),
  ('🍬', 'Candy', 37),
  ('🍭', 'Lollipop', 38),
  ('🍮', 'Custard', 39),
  ('🍯', 'Honey Pot', 40),
  ('☕', 'Hot Beverage', 41),
  ('🍵', 'Teacup', 42),
  ('🥤', 'Cup with Straw', 43),
  ('🍶', 'Sake', 44),
  ('🍺', 'Beer Mug', 45),
  ('🍻', 'Clinking Beer Mugs', 46),
  ('🥂', 'Clinking Glasses', 47),
  ('🍷', 'Wine Glass', 48),
  ('🥃', 'Tumbler Glass', 49),
  ('🍸', 'Cocktail Glass', 50)
) AS emoji(emoji, name, order_num)
WHERE sp.name = 'Food & Drinks'
AND NOT EXISTS (
  SELECT 1 FROM stickers WHERE stickers.pack_id = sp.id AND stickers.name = emoji.name
);

-- Insert stickers for Travel & Places pack
INSERT INTO stickers (id, pack_id, name, image_url, is_animated, display_order, created_at, updated_at)
SELECT
  gen_random_uuid(),
  sp.id,
  emoji.name,
  'https://emojicdn.elk.sh/' || emoji.emoji,
  false,
  emoji.order_num,
  NOW(),
  NOW()
FROM sticker_packs sp
CROSS JOIN (VALUES
  ('✈️', 'Airplane', 1),
  ('🚀', 'Rocket', 2),
  ('🚁', 'Helicopter', 3),
  ('🚢', 'Ship', 4),
  ('⛵', 'Sailboat', 5),
  ('🚤', 'Speedboat', 6),
  ('🛥️', 'Motor Boat', 7),
  ('🚂', 'Locomotive', 8),
  ('🚃', 'Railway Car', 9),
  ('🚄', 'High-Speed Train', 10),
  ('🚅', 'Bullet Train', 11),
  ('🚆', 'Train', 12),
  ('🚇', 'Metro', 13),
  ('🚈', 'Light Rail', 14),
  ('🚉', 'Station', 15),
  ('🚊', 'Tram', 16),
  ('🚝', 'Monorail', 17),
  ('🚞', 'Mountain Railway', 18),
  ('🚟', 'Suspension Railway', 19),
  ('🚠', 'Mountain Cableway', 20),
  ('🚡', 'Aerial Tramway', 21),
  ('🚗', 'Automobile', 22),
  ('🚕', 'Taxi', 23),
  ('🚙', 'Sport Utility Vehicle', 24),
  ('🚌', 'Bus', 25),
  ('🚎', 'Trolleybus', 26),
  ('🏎️', 'Racing Car', 27),
  ('🚓', 'Police Car', 28),
  ('🚑', 'Ambulance', 29),
  ('🚒', 'Fire Engine', 30),
  ('🚐', 'Minibus', 31),
  ('🛻', 'Pickup Truck', 32),
  ('🚚', 'Delivery Truck', 33),
  ('🚛', 'Articulated Lorry', 34),
  ('🚜', 'Tractor', 35),
  ('🏍️', 'Motorcycle', 36),
  ('🛵', 'Motor Scooter', 37),
  ('🛴', 'Kick Scooter', 38),
  ('🚲', 'Bicycle', 39),
  ('🛺', 'Auto Rickshaw', 40),
  ('🏠', 'House', 41),
  ('🏡', 'House with Garden', 42),
  ('🏘️', 'Houses', 43),
  ('🏚️', 'Derelict House', 44),
  ('🏗️', 'Building Construction', 45),
  ('🏭', 'Factory', 46),
  ('🏢', 'Office Building', 47),
  ('🏬', 'Department Store', 48),
  ('🏣', 'Japanese Post Office', 49),
  ('🏤', 'Post Office', 50),
  ('🏥', 'Hospital', 51),
  ('🏦', 'Bank', 52),
  ('🏨', 'Hotel', 53),
  ('🏪', 'Convenience Store', 54),
  ('🏫', 'School', 55),
  ('🏩', 'Love Hotel', 56),
  ('⛪', 'Church', 57),
  ('🕌', 'Mosque', 58),
  ('🕍', 'Synagogue', 59),
  ('🛕', 'Hindu Temple', 60),
  ('🗼', 'Tokyo Tower', 61),
  ('🗽', 'Statue of Liberty', 62),
  ('⛲', 'Fountain', 63),
  ('⛺', 'Tent', 64),
  ('🌁', 'Foggy', 65),
  ('🌃', 'Night with Stars', 66),
  ('🌄', 'Sunrise Over Mountains', 67),
  ('🌅', 'Sunrise', 68),
  ('🌆', 'Cityscape at Dusk', 69),
  ('🌇', 'Sunset', 70),
  ('🌉', 'Bridge at Night', 71),
  ('🎠', 'Carousel Horse', 72),
  ('🎡', 'Ferris Wheel', 73),
  ('🎢', 'Roller Coaster', 74),
  ('🗻', 'Mount Fuji', 75),
  ('⛰️', 'Mountain', 76),
  ('🌋', 'Volcano', 77),
  ('🗾', 'Map of Japan', 78),
  ('🏔️', 'Snow-Capped Mountain', 79),
  ('⛰️', 'Mountain', 80),
  ('🏕️', 'Camping', 81),
  ('🏖️', 'Beach with Umbrella', 82),
  ('🏜️', 'Desert', 83),
  ('🏝️', 'Desert Island', 84),
  ('🏞️', 'National Park', 85),
  ('🏟️', 'Stadium', 86),
  ('🏛️', 'Classical Building', 87),
  ('🏗️', 'Building Construction', 88),
  ('��', 'Brick', 89),
  ('🏘️', 'Houses', 90)
) AS emoji(emoji, name, order_num)
WHERE sp.name = 'Travel & Places'
AND NOT EXISTS (
  SELECT 1 FROM stickers WHERE stickers.pack_id = sp.id AND stickers.name = emoji.name
);

-- Insert stickers for Sports & Activities pack
INSERT INTO stickers (id, pack_id, name, image_url, is_animated, display_order, created_at, updated_at)
SELECT
  gen_random_uuid(),
  sp.id,
  emoji.name,
  'https://emojicdn.elk.sh/' || emoji.emoji,
  false,
  emoji.order_num,
  NOW(),
  NOW()
FROM sticker_packs sp
CROSS JOIN (VALUES
  ('⚽', 'Soccer Ball', 1),
  ('🏀', 'Basketball', 2),
  ('🏈', 'American Football', 3),
  ('⚾', 'Baseball', 4),
  ('🥎', 'Softball', 5),
  ('🎾', 'Tennis', 6),
  ('🏐', 'Volleyball', 7),
  ('🏉', 'Rugby Football', 8),
  ('🥏', 'Flying Disc', 9),
  ('🎱', 'Pool 8 Ball', 10),
  ('🏓', 'Ping Pong', 11),
  ('🏸', 'Badminton', 12),
  ('🥅', 'Goal Net', 13),
  ('🏒', 'Ice Hockey', 14),
  ('🏑', 'Field Hockey', 15),
  ('🥍', 'Lacrosse', 16),
  ('🏏', 'Cricket Game', 17),
  ('🎯', 'Direct Hit', 18),
  ('⛳', 'Flag in Hole', 19),
  ('🏹', 'Bow and Arrow', 20),
  ('🎣', 'Fishing Pole', 21),
  ('🥊', 'Boxing Glove', 22),
  ('🥋', 'Martial Arts Uniform', 23),
  ('🎽', 'Running Shirt', 24),
  ('🛷', 'Sled', 25),
  ('⛷️', 'Skier', 26),
  ('🏂', 'Snowboarder', 27),
  ('🪂', 'Parachute', 28),
  ('🏋️', 'Person Lifting Weights', 29),
  ('🤼', 'People Wrestling', 30),
  ('🤸', 'Person Cartwheeling', 31),
  ('⛹️', 'Person Bouncing Ball', 32),
  ('🤺', 'Person Fencing', 33),
  ('🤾', 'Person Playing Handball', 34),
  ('🏌️', 'Person Golfing', 35),
  ('🏇', 'Horse Racing', 36),
  ('🧘', 'Person in Lotus Position', 37),
  ('🏄', 'Person Surfing', 38),
  ('🏊', 'Person Swimming', 39),
  ('🚣', 'Person Rowing Boat', 40),
  ('🧗', 'Person Climbing', 41),
  ('🚵', 'Person Mountain Biking', 42),
  ('🚴', 'Person Biking', 43),
  ('🏃', 'Person Running', 44),
  ('🚶', 'Person Walking', 45),
  ('💃', 'Woman Dancing', 46),
  ('🕺', 'Man Dancing', 47),
  ('🕴️', 'Person in Suit Levitating', 48),
  ('👯', 'People with Bunny Ears', 49),
  ('🧖', 'Person in Steamy Room', 50)
) AS emoji(emoji, name, order_num)
WHERE sp.name = 'Sports & Activities'
AND NOT EXISTS (
  SELECT 1 FROM stickers WHERE stickers.pack_id = sp.id AND stickers.name = emoji.name
);

-- Insert stickers for Weather & Nature pack
INSERT INTO stickers (id, pack_id, name, image_url, is_animated, display_order, created_at, updated_at)
SELECT
  gen_random_uuid(),
  sp.id,
  emoji.name,
  'https://emojicdn.elk.sh/' || emoji.emoji,
  false,
  emoji.order_num,
  NOW(),
  NOW()
FROM sticker_packs sp
CROSS JOIN (VALUES
  ('☀️', 'Sun', 1),
  ('🌤️', 'Sun Behind Small Cloud', 2),
  ('⛅', 'Sun Behind Cloud', 3),
  ('🌥️', 'Sun Behind Large Cloud', 4),
  ('☁️', 'Cloud', 5),
  ('🌦️', 'Sun Behind Rain Cloud', 6),
  ('⛈️', 'Cloud with Lightning and Rain', 7),
  ('🌩️', 'Cloud with Lightning', 8),
  ('⚡', 'High Voltage', 9),
  ('❄️', 'Snowflake', 10),
  ('☃️', 'Snowman', 11),
  ('⛄', 'Snowman Without Snow', 12),
  ('🌨️', 'Cloud with Snow', 13),
  ('🌧️', 'Cloud with Rain', 14),
  ('💧', 'Droplet', 15),
  ('💦', 'Sweat Droplets', 16),
  ('☔', 'Umbrella with Rain Drops', 17),
  ('🌊', 'Water Wave', 18),
  ('🌈', 'Rainbow', 19),
  ('🌫️', 'Fog', 20),
  ('🌪️', 'Tornado', 21),
  ('🌀', 'Cyclone', 22),
  ('🌍', 'Globe Showing Europe-Africa', 23),
  ('🌎', 'Globe Showing Americas', 24),
  ('🌏', 'Globe Showing Asia-Australia', 25),
  ('🌐', 'Globe with Meridians', 26),
  ('🗺️', 'World Map', 27),
  ('🌑', 'New Moon', 28),
  ('🌒', 'Waxing Crescent Moon', 29),
  ('🌓', 'First Quarter Moon', 30),
  ('🌔', 'Waxing Gibbous Moon', 31),
  ('🌕', 'Full Moon', 32),
  ('🌖', 'Waning Gibbous Moon', 33),
  ('🌗', 'Last Quarter Moon', 34),
  ('🌘', 'Waning Crescent Moon', 35),
  ('🌙', 'Crescent Moon', 36),
  ('🌚', 'New Moon Face', 37),
  ('🌛', 'First Quarter Moon Face', 38),
  ('🌜', 'Last Quarter Moon Face', 39),
  ('🌝', 'Full Moon Face', 40),
  ('🌞', 'Sun with Face', 41),
  ('⭐', 'Star', 42),
  ('🌟', 'Glowing Star', 43),
  ('💫', 'Dizzy', 44),
  ('✨', 'Sparkles', 45),
  ('☄️', 'Comet', 46),
  ('🔥', 'Fire', 47),
  ('💥', 'Collision', 48),
  ('🌋', 'Volcano', 49),
  ('🌊', 'Water Wave', 50)
) AS emoji(emoji, name, order_num)
WHERE sp.name = 'Weather & Nature'
AND NOT EXISTS (
  SELECT 1 FROM stickers WHERE stickers.pack_id = sp.id AND stickers.name = emoji.name
);

-- Insert stickers for Objects & Symbols pack
INSERT INTO stickers (id, pack_id, name, image_url, is_animated, display_order, created_at, updated_at)
SELECT
  gen_random_uuid(),
  sp.id,
  emoji.name,
  'https://emojicdn.elk.sh/' || emoji.emoji,
  false,
  emoji.order_num,
  NOW(),
  NOW()
FROM sticker_packs sp
CROSS JOIN (VALUES
  ('💡', 'Light Bulb', 1),
  ('🔦', 'Flashlight', 2),
  ('🕯️', 'Candle', 3),
  ('🧯', 'Fire Extinguisher', 4),
  ('🛢️', 'Oil Drum', 5),
  ('💸', 'Money with Wings', 6),
  ('💵', 'Dollar Banknote', 7),
  ('💴', 'Yen Banknote', 8),
  ('💶', 'Euro Banknote', 9),
  ('💷', 'Pound Banknote', 10),
  ('💰', 'Money Bag', 11),
  ('💳', 'Credit Card', 12),
  ('💎', 'Gem Stone', 13),
  ('⚖️', 'Balance Scale', 14),
  ('🔧', 'Wrench', 15),
  ('🔨', 'Hammer', 16),
  ('⚒️', 'Hammer and Pick', 17),
  ('🛠️', 'Hammer and Wrench', 18),
  ('⛏️', 'Pick', 19),
  ('🔩', 'Nut and Bolt', 20),
  ('⚙️', 'Gear', 21),
  ('🧰', 'Toolbox', 22),
  ('🧲', 'Magnet', 23),
  ('🔫', 'Pistol', 24),
  ('💣', 'Bomb', 25),
  ('🧨', 'Firecracker', 26),
  ('🔪', 'Kitchen Knife', 27),
  ('🗡️', 'Dagger', 28),
  ('⚔️', 'Crossed Swords', 29),
  ('🛡️', 'Shield', 30),
  ('🚬', 'Cigarette', 31),
  ('⚰️', 'Coffin', 32),
  ('🪦', 'Headstone', 33),
  ('⚱️', 'Funeral Urn', 34),
  ('🏺', 'Amphora', 35),
  ('🔮', 'Crystal Ball', 36),
  ('📿', 'Prayer Beads', 37),
  ('🧿', 'Nazar Amulet', 38),
  ('💈', 'Barber Pole', 39),
  ('⚗️', 'Alembic', 40),
  ('🔭', 'Telescope', 41),
  ('🔬', 'Microscope', 42),
  ('🕳️', 'Hole', 43),
  ('💊', 'Pill', 44),
  ('💉', 'Syringe', 45),
  ('🧬', 'DNA', 46),
  ('🦠', 'Microbe', 47),
  ('🧫', 'Petri Dish', 48),
  ('🧪', 'Test Tube', 49),
  ('🌡️', 'Thermometer', 50),
  ('🧹', 'Broom', 51),
  ('🧺', 'Basket', 52),
  ('🧻', 'Roll of Paper', 53),
  ('🚽', 'Toilet', 54),
  ('🚿', 'Shower', 55),
  ('🛁', 'Bathtub', 56),
  ('🛀', 'Person Taking Bath', 57),
  ('🧼', 'Soap', 58),
  ('🧽', 'Sponge', 59),
  ('🧴', 'Lotion Bottle', 60),
  ('🛎️', 'Bellhop Bell', 61),
  ('🔑', 'Key', 62),
  ('🗝️', 'Old Key', 63),
  ('🚪', 'Door', 64),
  ('🪑', 'Chair', 65),
  ('🛋️', 'Couch and Lamp', 66),
  ('🛏️', 'Bed', 67),
  ('🛌', 'Person in Bed', 68),
  ('🧸', 'Teddy Bear', 69),
  ('🖼️', 'Framed Picture', 70),
  ('🛍️', 'Shopping Bags', 71),
  ('🛒', 'Shopping Cart', 72),
  ('🎁', 'Wrapped Gift', 73),
  ('🎈', 'Balloon', 74),
  ('🎏', 'Carp Streamer', 75),
  ('🎀', 'Ribbon', 76),
  ('🎊', 'Confetti Ball', 77),
  ('🎉', 'Party Popper', 78),
  ('🎎', 'Japanese Dolls', 79),
  ('🏮', 'Red Paper Lantern', 80),
  ('🎐', 'Wind Chime', 81),
  ('🧧', 'Red Envelope', 82),
  ('✉️', 'Envelope', 83),
  ('📩', 'Envelope with Arrow', 84),
  ('📨', 'Incoming Envelope', 85),
  ('📧', 'E-Mail', 86),
  ('💌', 'Love Letter', 87),
  ('📥', 'Inbox Tray', 88),
  ('📤', 'Outbox Tray', 89),
  ('📦', 'Package', 90),
  ('🏷️', 'Label', 91),
  ('📪', 'Closed Mailbox with Lowered Flag', 92),
  ('📫', 'Closed Mailbox with Raised Flag', 93),
  ('📬', 'Open Mailbox with Raised Flag', 94),
  ('📭', 'Open Mailbox with Lowered Flag', 95),
  ('📮', 'Postbox', 96),
  ('📯', 'Postal Horn', 97),
  ('📜', 'Scroll', 98),
  ('📃', 'Page with Curl', 99),
  ('📄', 'Page Facing Up', 100)
) AS emoji(emoji, name, order_num)
WHERE sp.name = 'Objects & Symbols'
AND NOT EXISTS (
  SELECT 1 FROM stickers WHERE stickers.pack_id = sp.id AND stickers.name = emoji.name
);

-- Insert stickers for Music & Arts pack
INSERT INTO stickers (id, pack_id, name, image_url, is_animated, display_order, created_at, updated_at)
SELECT
  gen_random_uuid(),
  sp.id,
  emoji.name,
  'https://emojicdn.elk.sh/' || emoji.emoji,
  false,
  emoji.order_num,
  NOW(),
  NOW()
FROM sticker_packs sp
CROSS JOIN (VALUES
  ('🎵', 'Musical Note', 1),
  ('🎶', 'Musical Notes', 2),
  ('🎤', 'Microphone', 3),
  ('🎧', 'Headphone', 4),
  ('🎼', 'Musical Score', 5),
  ('🎹', 'Musical Keyboard', 6),
  ('🥁', 'Drum', 7),
  ('🎷', 'Saxophone', 8),
  ('🎺', 'Trumpet', 9),
  ('🎸', 'Guitar', 10),
  ('🪕', 'Banjo', 11),
  ('🎻', 'Violin', 12),
  ('🎲', 'Game Die', 13),
  ('🎯', 'Direct Hit', 14),
  ('🎳', 'Bowling', 15),
  ('🎮', 'Video Game', 16),
  ('🎰', 'Slot Machine', 17),
  ('🧩', 'Puzzle Piece', 18),
  ('🎨', 'Artist Palette', 19),
  ('🖌️', 'Paintbrush', 20),
  ('🖍️', 'Crayon', 21),
  ('🖊️', 'Pen', 22),
  ('🖋️', 'Fountain Pen', 23),
  ('✏️', 'Pencil', 24),
  ('✒️', 'Black Nib', 25),
  ('🖇️', 'Paperclip', 26),
  ('📝', 'Memo', 27),
  ('💼', 'Briefcase', 28),
  ('📁', 'File Folder', 29),
  ('📂', 'Open File Folder', 30),
  ('🗂️', 'Card Index Dividers', 31),
  ('📅', 'Calendar', 32),
  ('📆', 'Tear-Off Calendar', 33),
  ('🗒️', 'Spiral Notepad', 34),
  ('🗓️', 'Spiral Calendar', 35),
  ('📇', 'Card Index', 36),
  ('📈', 'Chart Increasing', 37),
  ('📉', 'Chart Decreasing', 38),
  ('📊', 'Bar Chart', 39),
  ('📋', 'Clipboard', 40),
  ('📌', 'Pushpin', 41),
  ('📍', 'Round Pushpin', 42),
  ('📎', 'Paperclip', 43),
  ('🖇️', 'Linked Paperclips', 44),
  ('📏', 'Straight Ruler', 45),
  ('📐', 'Triangular Ruler', 46),
  ('✂️', 'Scissors', 47),
  ('🗑️', 'Wastebasket', 48),
  ('🔒', 'Locked', 49),
  ('🔓', 'Unlocked', 50),
  ('🔏', 'Locked with Pen', 51),
  ('🔐', 'Locked with Key', 52),
  ('🔑', 'Key', 53),
  ('🗝️', 'Old Key', 54),
  ('🔨', 'Hammer', 55),
  ('🪓', 'Axe', 56),
  ('⛏️', 'Pick', 57),
  ('🪚', 'Carpentry Saw', 58),
  ('🔧', 'Wrench', 59),
  ('🪛', 'Screwdriver', 60),
  ('🔩', 'Nut and Bolt', 61),
  ('⚙️', 'Gear', 62),
  ('🗜️', 'Clamp', 63),
  ('⚖️', 'Balance Scale', 64),
  ('🦯', 'White Cane', 65),
  ('🔗', 'Link', 66),
  ('⛓️', 'Chains', 67),
  ('🧰', 'Toolbox', 68),
  ('🧲', 'Magnet', 69),
  ('🪜', 'Ladder', 70)
) AS emoji(emoji, name, order_num)
WHERE sp.name = 'Music & Arts'
AND NOT EXISTS (
  SELECT 1 FROM stickers WHERE stickers.pack_id = sp.id AND stickers.name = emoji.name
);

-- Insert stickers for Technology pack
INSERT INTO stickers (id, pack_id, name, image_url, is_animated, display_order, created_at, updated_at)
SELECT
  gen_random_uuid(),
  sp.id,
  emoji.name,
  'https://emojicdn.elk.sh/' || emoji.emoji,
  false,
  emoji.order_num,
  NOW(),
  NOW()
FROM sticker_packs sp
CROSS JOIN (VALUES
  ('📱', 'Mobile Phone', 1),
  ('📲', 'Mobile Phone with Arrow', 2),
  ('☎️', 'Telephone', 3),
  ('📞', 'Telephone Receiver', 4),
  ('📟', 'Pager', 5),
  ('📠', 'Fax Machine', 6),
  ('🔋', 'Battery', 7),
  ('🔌', 'Electric Plug', 8),
  ('💻', 'Laptop', 9),
  ('🖥️', 'Desktop Computer', 10),
  ('🖨️', 'Printer', 11),
  ('⌨️', 'Keyboard', 12),
  ('🖱️', 'Computer Mouse', 13),
  ('🖲️', 'Trackball', 14),
  ('🕹️', 'Joystick', 15),
  ('🗜️', 'Clamp', 16),
  ('💾', 'Floppy Disk', 17),
  ('💿', 'Optical Disk', 18),
  ('📀', 'DVD', 19),
  ('📼', 'Videocassette', 20),
  ('📷', 'Camera', 21),
  ('📸', 'Camera with Flash', 22),
  ('📹', 'Video Camera', 23),
  ('🎥', 'Movie Camera', 24),
  ('📽️', 'Film Projector', 25),
  ('🎞️', 'Film Frames', 26),
  ('📞', 'Telephone Receiver', 27),
  ('📟', 'Pager', 28),
  ('📠', 'Fax Machine', 29),
  ('📺', 'Television', 30),
  ('📻', 'Radio', 31),
  ('🎙️', 'Studio Microphone', 32),
  ('🎚️', 'Level Slider', 33),
  ('🎛️', 'Control Knobs', 34),
  ('⏱️', 'Stopwatch', 35),
  ('⏲️', 'Timer Clock', 36),
  ('⏰', 'Alarm Clock', 37),
  ('🕰️', 'Mantelpiece Clock', 38),
  ('⌛', 'Hourglass Done', 39),
  ('⏳', 'Hourglass Not Done', 40),
  ('📡', 'Satellite', 41),
  ('🔋', 'Battery', 42),
  ('🔌', 'Electric Plug', 43),
  ('💡', 'Light Bulb', 44),
  ('🔦', 'Flashlight', 45),
  ('🕯️', 'Candle', 46),
  ('🧯', 'Fire Extinguisher', 47),
  ('🛢️', 'Oil Drum', 48),
  ('💸', 'Money with Wings', 49),
  ('💵', 'Dollar Banknote', 50)
) AS emoji(emoji, name, order_num)
WHERE sp.name = 'Technology'
AND NOT EXISTS (
  SELECT 1 FROM stickers WHERE stickers.pack_id = sp.id AND stickers.name = emoji.name
);

-- Insert stickers for Time & Calendar pack
INSERT INTO stickers (id, pack_id, name, image_url, is_animated, display_order, created_at, updated_at)
SELECT
  gen_random_uuid(),
  sp.id,
  emoji.name,
  'https://emojicdn.elk.sh/' || emoji.emoji,
  false,
  emoji.order_num,
  NOW(),
  NOW()
FROM sticker_packs sp
CROSS JOIN (VALUES
  ('⏰', 'Alarm Clock', 1),
  ('🕰️', 'Mantelpiece Clock', 2),
  ('⏱️', 'Stopwatch', 3),
  ('⏲️', 'Timer Clock', 4),
  ('🕛', 'Twelve O''Clock', 5),
  ('🕧', 'Twelve-Thirty', 6),
  ('🕐', 'One O''Clock', 7),
  ('🕜', 'One-Thirty', 8),
  ('🕑', 'Two O''Clock', 9),
  ('🕝', 'Two-Thirty', 10),
  ('🕒', 'Three O''Clock', 11),
  ('🕞', 'Three-Thirty', 12),
  ('🕓', 'Four O''Clock', 13),
  ('🕟', 'Four-Thirty', 14),
  ('🕔', 'Five O''Clock', 15),
  ('🕠', 'Five-Thirty', 16),
  ('🕕', 'Six O''Clock', 17),
  ('🕡', 'Six-Thirty', 18),
  ('🕖', 'Seven O''Clock', 19),
  ('🕢', 'Seven-Thirty', 20),
  ('🕗', 'Eight O''Clock', 21),
  ('🕣', 'Eight-Thirty', 22),
  ('🕘', 'Nine O''Clock', 23),
  ('🕤', 'Nine-Thirty', 24),
  ('🕙', 'Ten O''Clock', 25),
  ('🕥', 'Ten-Thirty', 26),
  ('🕚', 'Eleven O''Clock', 27),
  ('🕦', 'Eleven-Thirty', 28),
  ('⌛', 'Hourglass Done', 29),
  ('⏳', 'Hourglass Not Done', 30),
  ('📅', 'Calendar', 31),
  ('📆', 'Tear-Off Calendar', 32),
  ('🗓️', 'Spiral Calendar', 33),
  ('📇', 'Card Index', 34),
  ('📈', 'Chart Increasing', 35),
  ('📉', 'Chart Decreasing', 36),
  ('📊', 'Bar Chart', 37),
  ('📋', 'Clipboard', 38),
  ('🗒️', 'Spiral Notepad', 39),
  ('🗓️', 'Spiral Calendar', 40)
) AS emoji(emoji, name, order_num)
WHERE sp.name = 'Time & Calendar'
AND NOT EXISTS (
  SELECT 1 FROM stickers WHERE stickers.pack_id = sp.id AND stickers.name = emoji.name
);

-- Insert stickers for Emotions & Feelings pack
INSERT INTO stickers (id, pack_id, name, image_url, is_animated, display_order, created_at, updated_at)
SELECT
  gen_random_uuid(),
  sp.id,
  emoji.name,
  'https://emojicdn.elk.sh/' || emoji.emoji,
  false,
  emoji.order_num,
  NOW(),
  NOW()
FROM sticker_packs sp
CROSS JOIN (VALUES
  ('😢', 'Crying Face', 1),
  ('😭', 'Loudly Crying Face', 2),
  ('😤', 'Face with Steam from Nose', 3),
  ('😠', 'Angry Face', 4),
  ('😡', 'Pouting Face', 5),
  ('🤬', 'Face with Symbols on Mouth', 6),
  ('😈', 'Smiling Face with Horns', 7),
  ('👿', 'Angry Face with Horns', 8),
  ('💀', 'Skull', 9),
  ('☠️', 'Skull and Crossbones', 10),
  ('💩', 'Pile of Poo', 11),
  ('🤡', 'Clown Face', 12),
  ('👹', 'Ogre', 13),
  ('👺', 'Goblin', 14),
  ('👻', 'Ghost', 15),
  ('👽', 'Alien', 16),
  ('👾', 'Alien Monster', 17),
  ('🤖', 'Robot', 18),
  ('😺', 'Grinning Cat', 19),
  ('😸', 'Grinning Cat with Smiling Eyes', 20),
  ('😹', 'Cat with Tears of Joy', 21),
  ('😻', 'Smiling Cat with Heart-Eyes', 22),
  ('😼', 'Cat with Wry Smile', 23),
  ('😽', 'Kissing Cat', 24),
  ('🙀', 'Weary Cat', 25),
  ('😿', 'Crying Cat', 26),
  ('😾', 'Pouting Cat', 27),
  ('🙈', 'See-No-Evil Monkey', 28),
  ('🙉', 'Hear-No-Evil Monkey', 29),
  ('🙊', 'Speak-No-Evil Monkey', 30),
  ('💋', 'Kiss Mark', 31),
  ('💌', 'Love Letter', 32),
  ('💘', 'Heart with Arrow', 33),
  ('💝', 'Heart with Ribbon', 34),
  ('💖', 'Sparkling Heart', 35),
  ('💗', 'Growing Heart', 36),
  ('💓', 'Beating Heart', 37),
  ('💞', 'Revolving Hearts', 38),
  ('💕', 'Two Hearts', 39),
  ('💟', 'Heart Decoration', 40),
  ('❣️', 'Heart Exclamation', 41),
  ('💔', 'Broken Heart', 42),
  ('❤️', 'Red Heart', 43),
  ('🧡', 'Orange Heart', 44),
  ('💛', 'Yellow Heart', 45),
  ('💚', 'Green Heart', 46),
  ('💙', 'Blue Heart', 47),
  ('💜', 'Purple Heart', 48),
  ('🖤', 'Black Heart', 49),
  ('🤍', 'White Heart', 50),
  ('🤎', 'Brown Heart', 51),
  ('💯', 'Hundred Points', 52),
  ('💢', 'Anger Symbol', 53),
  ('💥', 'Collision', 54),
  ('💫', 'Dizzy', 55),
  ('💦', 'Sweat Droplets', 56),
  ('💨', 'Dashing Away', 57),
  ('🕳️', 'Hole', 58),
  ('💣', 'Bomb', 59),
  ('💬', 'Speech Balloon', 60),
  ('👁️‍🗨️', 'Eye in Speech Bubble', 61),
  ('🗨️', 'Left Speech Bubble', 62),
  ('🗯️', 'Right Anger Bubble', 63),
  ('💭', 'Thought Balloon', 64),
  ('💤', 'ZZZ', 65)
) AS emoji(emoji, name, order_num)
WHERE sp.name = 'Emotions & Feelings'
AND NOT EXISTS (
  SELECT 1 FROM stickers WHERE stickers.pack_id = sp.id AND stickers.name = emoji.name
);

-- Insert animated GIF stickers for GIF Reactions pack
-- Using unique placeholder URLs - replace with real GIF URLs later
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
WHERE sp.name = 'GIF Reactions'
AND NOT EXISTS (
  SELECT 1 FROM stickers WHERE stickers.pack_id = sp.id AND stickers.name = emoji.name
);

-- Insert animated GIF stickers for GIF Celebrations pack
-- Using unique placeholder URLs - replace with real GIF URLs later
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
WHERE sp.name = 'GIF Celebrations'
AND NOT EXISTS (
  SELECT 1 FROM stickers WHERE stickers.pack_id = sp.id AND stickers.name = emoji.name
);

-- Insert animated GIF stickers for GIF Emotions pack
-- Using unique placeholder URLs - replace with real GIF URLs later
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
WHERE sp.name = 'GIF Emotions'
AND NOT EXISTS (
  SELECT 1 FROM stickers WHERE stickers.pack_id = sp.id AND stickers.name = emoji.name
);

-- Insert animated GIF stickers for GIF Fun & Cute pack
-- Using unique placeholder URLs - replace with real GIF URLs later
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
WHERE sp.name = 'GIF Fun & Cute'
AND NOT EXISTS (
  SELECT 1 FROM stickers WHERE stickers.pack_id = sp.id AND stickers.name = emoji.name
);

