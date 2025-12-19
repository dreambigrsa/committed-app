# Setup Instructions

## Complete Database Schema Setup

Run the following SQL scripts in your Supabase SQL Editor in this order:

### 1. Run migrations/add-user-settings-and-moderation.sql

This adds:
- `user_settings` table for user preferences
- Status columns to `posts` and `reels` for content moderation
- Username field for better user identification  
- Updated RLS policies for content moderation

```sql
-- Run in Supabase SQL Editor
-- migrations/add-user-settings-and-moderation.sql
```

## Key Features Implemented

### ✅ Privacy Settings & Persistence
- User settings now save to database and persist across sessions
- Profile visibility controls (public, private, verified-only)
- Notification preferences

### ✅ Role-Based Admin Permissions
- Hierarchical role system: Super Admin > Admin > Moderator > User
- Admins cannot modify roles equal to or higher than their own
- Super Admins have full control
- Moderators and Admins can only manage users below their level

### ✅ Content Moderation System
- Posts and reels have status: pending, approved, rejected
- Admins can approve/reject content with reasons
- Only approved content shows to regular users
- Content creators can see their own pending/rejected content

### ✅ Video Support in Feed
- Posts now support both images and videos
- Mixed media posts (images + videos)
- Video playback with native controls

### ✅ Improved Navigation
- Home and Feed icons properly swapped (Home = house icon, Feed = heart icon)
- Avatar in home screen now navigates to settings

### ✅ Search Improvements
- Added username field for unique user identification
- Search by name, phone number, or username
- Better conflict resolution for users with same names

## What Needs to Be Done Next

### High Priority
1. **Run Database Migration** - Execute migrations/add-user-settings-and-moderation.sql in Supabase
2. **Implement Content Moderation UI** - Admin pages to approve/reject posts and reels
3. **Real-time Sync** - Add Supabase real-time subscriptions for posts, reels, messages
4. **Search Enhancement** - Update search UI to use username field

### Medium Priority
1. **Posts/Reels Review Flow** - Complete workflow for content approval
2. **Backend Sync Implementation** - Real-time updates for all content
3. **Admin Dashboard Fixes** - Fix missing database table references

### Low Priority
1. **Push Notifications** - Integrate Expo Notifications for all events
2. **Enhanced Analytics** - More detailed metrics for admins
3. **Automated Testing** - Add tests for critical workflows

## Architecture Notes

### Role Hierarchy
```
Super Admin (Level 3)
  └─ Can manage all roles including other Super Admins
  
Admin (Level 2)
  └─ Can manage Moderators and Users
  
Moderator (Level 1)
  └─ Can manage Users only
  
User (Level 0)
  └─ Standard permissions
```

### Content Flow
```
User creates post/reel
  └─ Status: pending (if moderation enabled)
  └─ Admin reviews
      ├─ Approve → Status: approved (visible to all)
      └─ Reject → Status: rejected (only visible to creator)
```

## Important Security Notes

- All role modifications check hierarchy
- RLS policies enforce access control
- Content moderation happens at database level
- User settings stored securely with proper policies

## Testing the Features

1. **Test Role Permissions**:
   - Log in as Super Admin
   - Try to modify other admin roles
   - Log in as Admin and verify you cannot modify Super Admins

2. **Test Content Moderation**:
   - Create a post as regular user
   - Log in as Admin
   - Navigate to admin panel to approve/reject

3. **Test Settings Persistence**:
   - Change notification/privacy settings
   - Log out and log back in
   - Verify settings are retained

4. **Test Video in Feed**:
   - Create a post with video
   - Verify it plays in feed
   - Test mixed media posts

## Support

If you encounter any issues:
1. Check Supabase logs for database errors
2. Check browser console for client errors
3. Verify all SQL migrations ran successfully
4. Ensure RLS policies are enabled on all tables
