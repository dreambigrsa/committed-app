# End Relationship Feature Fixes

## Issues Fixed

### 1. RLS Policy Error for Notifications
**Problem**: When pressing the "End Relationship" button, users received an error:
```
Failed to create notification: { "code": "42501", "details": null, "hint": null, "message": "new row violates row-level security policy for table \"notifications\"" }
```

**Solution**: Created a migration `migrations/add-notifications-insert-policy.sql` that adds an INSERT policy for the notifications table, allowing authenticated users to create notifications for other users.

**Action Required**: Run the migration in Supabase SQL Editor:
```sql
-- Run: migrations/add-notifications-insert-policy.sql
```

### 2. Button Text Not Updating After Request Sent
**Problem**: The "End Relationship" button continued to show the same text even after a request was sent, making it unclear that a request was already pending.

**Solution**: 
- Added state to track pending end relationship disputes
- Added a `useEffect` hook to check for pending disputes when the relationship is loaded
- Updated the button to:
  - Show "End Relationship Request Sent" when a request is pending
  - Disable the button when a request is already sent
  - Update the description text to inform the user that a request is already pending

## Changes Made

### Files Modified:
1. **`migrations/add-notifications-insert-policy.sql`** (NEW)
   - Adds INSERT policy for notifications table

2. **`app/settings.tsx`**
   - Added `pendingEndRequest` state
   - Added `useEffect` to check for pending disputes
   - Updated button text and disabled state based on pending request
   - Added `dangerButtonDisabled` style

3. **`contexts/AppContext.tsx`**
   - Improved error handling in `endRelationship` function
   - Added specific handling for notification creation errors
   - Changed error handling to throw errors instead of returning null (so UI can display them)

## Testing

After running the migration, test the following:
1. ✅ Press "End Relationship" button - should create dispute and send notification
2. ✅ Button should change to "End Relationship Request Sent" after request is sent
3. ✅ Button should be disabled after request is sent
4. ✅ Description text should update to inform user that request is pending
5. ✅ No RLS errors should occur when creating notifications

## Migration Instructions

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `migrations/add-notifications-insert-policy.sql`
4. Run the migration
5. Verify the policy was created by checking the policies for the `notifications` table

