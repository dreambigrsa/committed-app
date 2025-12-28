# Dating Filters Fix

## Issues Fixed

### 1. Gender Filtering Not Working
**Problem**: Users were seeing profiles of the wrong gender when they selected a specific gender preference (e.g., seeing men when they selected "women").

**Root Cause**: 
- The mutual compatibility logic was incorrect
- Profiles without gender were being shown to everyone, even when filtering by gender
- The gender matching logic didn't properly check mutual compatibility

**Fix**:
- Made gender filtering strict: when filtering by "men" or "women", only show profiles with matching gender
- Fixed mutual compatibility check to ensure both users are interested in each other
- Profiles without gender are now excluded when filtering by gender (instead of shown to everyone)
- Added proper logging for debugging

**Code Changes** (`lib/dating-service.ts`):
- Updated `getDatingDiscovery` function to properly filter by gender
- When `lookingFor === 'women'`: Only show profiles where `gender === 'female'`
- When `lookingFor === 'men'`: Only show profiles where `gender === 'male'`
- Added mutual compatibility check: profile's `looking_for` must include current user's gender (or be 'everyone')

### 2. Gender Selection in Profile Setup
**Status**: ✅ Already working correctly
- Users can select their gender in `app/dating/profile-setup.tsx`
- Gender field is properly saved to the database
- Gender is displayed in the profile setup screen

### 3. Filter Application
**Status**: ✅ Already working correctly
- Filters are saved to user profile when applied
- Discovery screen refreshes when returning from filters screen (via `useFocusEffect`)
- All filter preferences (age, distance, location, gender) are properly applied

## How It Works Now

### Default Behavior:
- **Male users**: By default see "women" (opposite gender)
- **Female users**: By default see "men" (opposite gender)
- **Non-binary or prefer not to say**: Default to "everyone"
- Users can change this preference in their profile settings

### Gender Filtering Logic:
1. **User selects "women"**:
   - Only shows profiles where `gender === 'female'`
   - Profile's `looking_for` must be 'women' or 'everyone' (mutual compatibility)
   - Excludes profiles without gender set

2. **User selects "men"**:
   - Only shows profiles where `gender === 'male'`
   - Profile's `looking_for` must be 'men' or 'everyone' (mutual compatibility)
   - Excludes profiles without gender set

3. **User selects "everyone"**:
   - Shows all profiles (no gender filtering)

### Mutual Compatibility:
- Ensures both users are interested in each other
- If User A wants to see "women" and User B is female:
  - User B's `looking_for` must be 'women' or 'everyone' (so User B wants to see women, which includes User A)
  - OR User B's `looking_for` is 'men' and User A is male (mutual interest)

## Testing

To verify the fixes work:
1. Set your gender in profile setup
2. Set your "Looking for" preference to "women" or "men"
3. Apply filters
4. Check discovery - you should only see profiles matching your preference
5. Check console logs for filtering details (if debugging needed)

## Database Requirements

Make sure the `gender` field exists in `dating_profiles` table:
- Run migration: `migrations/add-gender-to-dating-profiles.sql`
- Field type: `TEXT CHECK (gender IN ('male', 'female', 'non_binary', 'prefer_not_to_say'))`

## Notes

- Profiles without gender are excluded when filtering by specific gender (not shown to everyone)
- This ensures users only see profiles that match their preference
- Mutual compatibility ensures both users are interested in each other
- Non-binary users can see and be seen by both men and women (depending on preferences)

