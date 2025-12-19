# How to See Content in Your App

Your app pages are blank because the database has no sample data. Here's how to fix it:

## Step 1: Make Sure Database is Set Up

1. Open your Supabase project dashboard
2. Go to SQL Editor
3. Run `complete-database-setup.sql` if you haven't already

## Step 2: Add Sample Data

1. Go to SQL Editor in Supabase
2. Copy and paste the entire contents of `seed-sample-data.sql`
3. Click "Run"
4. This will create:
   - 5 sample posts with images
   - 2 sample reels with videos
   - 3 sample advertisements (if you're admin)

## Step 3: Verify Data Was Created

Run this query in SQL Editor:

```sql
SELECT 
  (SELECT COUNT(*) FROM users) as total_users,
  (SELECT COUNT(*) FROM posts) as total_posts,
  (SELECT COUNT(*) FROM reels) as total_reels,
  (SELECT COUNT(*) FROM advertisements WHERE active = true) as active_ads;
```

You should see:
- At least 1 user (you)
- 5 posts
- 2 reels
- 3 advertisements (if you're admin)

## Step 4: Check Your User Role

To see advertisements management panel, you need to be admin. Run:

```sql
-- Check your current role
SELECT id, email, role FROM users WHERE email = 'YOUR_EMAIL_HERE';

-- If you want to make yourself super_admin:
UPDATE users SET role = 'super_admin' WHERE email = 'YOUR_EMAIL_HERE';
```

## Step 5: Reload the App

Close and reopen the app, or refresh it. You should now see:
- **Home Tab**: Your relationship status and verification info
- **Feed Tab**: 5 sample posts with images
- **Reels Tab**: 2 video reels you can scroll through
- **Search Tab**: Search for users by name/phone
- **Messages Tab**: Empty (start conversations with other users)
- **Profile Tab**: Your profile with all your info

## What Each Tab Does

### 🏠 Home (Heart Icon)
**Core Purpose**: Relationship verification dashboard
- View your relationship status
- See verification badges (Phone, Email, ID)
- Register a new relationship
- Access couple certificates and anniversary tracker
- Get alerts about pending relationship requests

### 📱 Feed (House Icon)
**Purpose**: Social feed for couples to share their journey
- View posts from verified couples
- Like and comment on posts
- Create new posts with photos
- See sponsored advertisements
- Engage with the community

### 🎬 Reels (Film Icon)
**Purpose**: Short-form video content
- Watch video reels from other couples
- Like and interact with reels
- Create your own reels
- Swipe to browse content
- Full-screen immersive experience

### 🔍 Search
**Core Purpose**: Verify anyone's relationship status
- Search by name or phone number
- See verification badges
- View relationship status (Single/Dating/Engaged/Married)
- See partner name (if public)
- Check verification level

### 💬 Messages
**Purpose**: Private conversations with verified members
- Chat with your partner
- Message other verified couples
- Real-time messaging
- See unread message counts

### 👤 Profile
**Purpose**: Manage your account
- View/edit your profile
- Upload profile picture
- See your verification status
- View your relationship info
- Access settings
- Log out
- Admin tools (if admin/super_admin)

## Troubleshooting

### "No posts/reels showing"
- Make sure you ran `seed-sample-data.sql`
- Check that posts were created: `SELECT * FROM posts;`
- Verify your user exists: `SELECT * FROM users WHERE email = 'your@email.com';`

### "Can't create posts"
- Make sure you're logged in
- Check that your user record exists in the database

### "Can't see Admin panel"
- You need to be `admin` or `super_admin` role
- Update your role: `UPDATE users SET role = 'super_admin' WHERE email = 'your@email.com';`

### "App crashes or shows errors"
- Check the console logs
- Make sure all SQL scripts ran successfully
- Verify Supabase connection in `lib/supabase.ts`

## The Core Purpose

Remember: This is a **Relationship Verification App**, not just another social media app!

**Primary Features:**
1. **Relationship Registration**: Users register their relationships
2. **Partner Verification**: Partner must accept for it to be verified
3. **Public Search**: Anyone can search to verify relationship status
4. **Cheating Alerts**: Notifications if someone tries to register duplicate relationships
5. **Verification Badges**: Phone, Email, and ID verification

**Secondary Features** (to make it more engaging):
- Social feed with posts
- Reels for couples to share videos
- Messaging between verified members
- Advertisements for revenue

The app is about **transparency, trust, and accountability** in relationships!
