# Professional Status System Explanation

## Current Status System Architecture

### **Regular Users (Chat Status)**
Uses `user_status` table with **automatic** status tracking:
- **Status calculated from `last_active_at`**:
  - Active app + recent activity → `online`
  - Inactive 5-15 minutes → `away`
  - Inactive >15 minutes → `offline`
  - Manual `busy` status is preserved
- **Automatically updates** based on app state (foreground/background)
- Updates `last_active_at` every 30 seconds when app is active
- Sets to `away` when app goes to background

### **Professionals (Professional Status)**
Uses `professional_status` table with **manual** status setting:
- Status is **manually set** by professional in availability screen
- No automatic calculation based on activity
- `last_seen_at` is updated but not used for status calculation
- Separate from `user_status` table

## Issues with Current System

1. **Two Separate Systems**: Professionals have their own status table that doesn't sync with the regular user status system
2. **Manual Only**: Professional status doesn't automatically reflect if they're actually active in the app
3. **No Activity Tracking**: System doesn't know if professional is actively using the app or just manually set to "online"

## How Professional Status Currently Works

1. Professional opens availability screen
2. Status is loaded from `professional_status` table
3. Professional manually selects status (Online/Busy/Away/Offline)
4. Status is saved to `professional_status` table
5. Status remains static until professional manually changes it again
6. No automatic updates based on app activity

## Recommended Solution: Unified Status System

Professionals should use the same `user_status` system with professional-specific overrides:

### Benefits:
1. **Automatic status tracking** - Knows if professional is actually active
2. **Consistent system** - Same status logic for all users
3. **Real-time accuracy** - Status reflects actual app usage
4. **Professional preferences** - Can still set manual status that overrides automatic calculation

### Implementation Approach:
1. Professionals use `user_status` table for base status (automatic tracking)
2. `professional_status.status` acts as a **preference/override**:
   - If professional sets to "busy" → always shows busy (even if active)
   - If professional sets to "offline" → always shows offline (even if active)
   - If professional sets to "online" → uses automatic calculation from `user_status`
   - If professional sets to "away" → uses automatic calculation but defaults to away when inactive

## Availability Screen Connection Status

✅ **Currently Working:**
- Loads professional profile data
- Loads and displays current status
- Updates status when professional changes it
- Saves max concurrent sessions
- Saves availability toggles (online/in-person)
- Saves quiet hours settings
- Displays active session count

❌ **Not Currently Connected:**
- Status is not synced with `user_status` (automatic tracking)
- Status doesn't automatically update when professional uses app
- No real-time status sync with regular user status system

## Questions to Answer

1. Should professionals use automatic status tracking like regular users?
2. Should manual status setting override automatic calculation?
3. Should there be a hybrid approach (automatic with manual override)?

