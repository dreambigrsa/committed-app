# Professional Status System - Recommendation & Options

## My Recommendation: **Hybrid Approach (Option 3)**

This gives professionals control while maintaining accuracy and consistency with the user status system.

---

## Option 1: Fully Manual (Current System)
**How it works:**
- Professional manually sets status in availability screen
- Status stays static until manually changed
- No automatic tracking

**Pros:**
- ✅ Full control for professionals
- ✅ Simple implementation
- ✅ Predictable behavior

**Cons:**
- ❌ Status doesn't reflect actual app usage
- ❌ Professional might forget to change status
- ❌ Inconsistent with regular user status system
- ❌ Users might see "online" professional who hasn't used app in days
- ❌ No automatic offline detection

**Use Case:** Not recommended for production

---

## Option 2: Fully Automatic (Like Regular Users)
**How it works:**
- Professional status automatically calculated from `user_status.last_active_at`
- Uses same logic as regular users (active = online, inactive 5+ min = away, etc.)
- No manual override

**Pros:**
- ✅ Accurate status (reflects actual activity)
- ✅ Consistent with user status system
- ✅ No manual work for professionals
- ✅ Automatic offline detection

**Cons:**
- ❌ No control for professionals
- ❌ Professional might be active but want to show "busy" (at capacity)
- ❌ Can't manually set to "offline" when taking a break but still checking app

**Use Case:** Good for accuracy but professionals lose control

---

## Option 3: Hybrid Approach (RECOMMENDED ⭐)
**How it works:**
- Base status calculated automatically from `user_status` (app activity)
- Professional can set a "preference/override" in availability screen
- Override rules:
  - **"Online"** → Use automatic calculation (show as online if active, away/offline if inactive)
  - **"Busy"** → Always show "busy" (even if inactive, means at capacity)
  - **"Away"** → Use automatic, but default to away when inactive (more lenient than offline)
  - **"Offline"** → Always show "offline" (even if active, means not accepting sessions)

**Implementation:**
1. Professional has entry in both `user_status` (automatic) and `professional_status` (preference)
2. When matching/displaying, check `professional_status.status`:
   - If "online" → use calculated status from `user_status`
   - If "busy", "offline", or "away" → use that status (override)

**Pros:**
- ✅ Accurate base status from activity tracking
- ✅ Professional control when needed (busy/offline override)
- ✅ Consistent with user status system
- ✅ Automatic offline detection when set to "online"
- ✅ Can show "busy" even when active (at capacity)
- ✅ Best of both worlds

**Cons:**
- ⚠️ Slightly more complex implementation
- ⚠️ Two status sources to manage (but clear priority rules)

**Use Case:** Production-ready, balances accuracy with control

---

## Option 4: Smart Hybrid (Advanced)
**How it works:**
- Like Option 3, but with smart defaults:
  - When professional has active sessions ≥ max → auto-suggest "busy"
  - When professional goes offline > 1 hour → auto-set to "offline" (if set to "online")
  - When professional inactive > 30 min → auto-set to "away" (if set to "online")
  - Manual overrides always respected

**Pros:**
- ✅ Everything from Option 3
- ✅ Smarter automatic suggestions
- ✅ Better user experience

**Cons:**
- ⚠️ More complex logic
- ⚠️ More edge cases to handle

**Use Case:** Future enhancement after Option 3 is working

---

## My Strong Recommendation: **Option 3 (Hybrid Approach)**

### Why Option 3 is Best:

1. **Accuracy**: Users see professionals who are actually active (not stale "online" status)
2. **Control**: Professionals can set "busy" when at capacity, or "offline" when on break
3. **Consistency**: Uses same `user_status` system as regular users
4. **Real-world Scenarios**:
   - Professional active but at capacity → Set to "busy" (shows busy even if active)
   - Professional taking break but checking app → Set to "offline" (shows offline even if active)
   - Professional available → Set to "online" (shows online when active, away/offline when not)
   - Professional forgot to change status → Automatic calculation keeps it accurate

### Implementation Steps:

1. **Ensure professionals have `user_status` entries** (same as regular users)
2. **Keep `professional_status.status` as preference/override**
3. **Update status display logic**:
   ```typescript
   function getEffectiveProfessionalStatus(professionalId: string) {
     const userStatus = getUserStatus(professionalId); // Automatic from activity
     const profStatus = getProfessionalStatus(professionalId); // Manual preference
     
     if (profStatus.status === 'busy' || profStatus.status === 'offline') {
       return profStatus.status; // Always respect manual busy/offline
     } else if (profStatus.status === 'away') {
       // Use automatic, but default to away
       return userStatus.statusType === 'offline' ? 'away' : userStatus.statusType;
     } else {
       // "online" preference - use automatic calculation
       return userStatus.statusType;
     }
   }
   ```

4. **Update availability screen**:
   - Label it as "Status Preference" instead of "Current Status"
   - Add helper text: "Set to 'Online' for automatic status, or override with Busy/Offline"
   - Show actual calculated status alongside preference

5. **Update matching logic** to use effective status

### UI Enhancement for Availability Screen:

```
Current Status Preference: [Online ▼]
  ↳ Actual Status: Online (Active in last 5 minutes)

Options:
- Online: Uses automatic status based on app activity
- Busy: Always shows as busy (even when active)
- Away: Uses automatic, defaults to away when inactive  
- Offline: Always shows as offline (even when active)
```

---

## Comparison Table

| Feature | Manual Only | Fully Auto | Hybrid (Recommended) |
|---------|------------|------------|---------------------|
| Accuracy | ❌ No | ✅ Yes | ✅ Yes |
| Professional Control | ✅ Yes | ❌ No | ✅ Yes |
| Auto Offline Detection | ❌ No | ✅ Yes | ✅ Yes |
| Consistency with Users | ❌ No | ✅ Yes | ✅ Yes |
| Real-world Flexibility | ⚠️ Limited | ⚠️ Limited | ✅ Excellent |
| Implementation Complexity | ✅ Simple | ✅ Simple | ⚠️ Moderate |

---

## Next Steps if You Choose Option 3:

1. ✅ Create migration to ensure all professionals have `user_status` entries
2. ✅ Update professional status display logic to use hybrid approach
3. ✅ Update availability screen UI with preference vs actual status
4. ✅ Update matching logic to use effective status
5. ✅ Test with real scenarios (active but busy, offline but checking app, etc.)

---

## Alternative: Start Simple, Enhance Later

If you want to start simpler:
1. **Phase 1**: Implement Option 2 (fully automatic) - Quick win
2. **Phase 2**: Add Option 3 (hybrid) - More control later

This lets you get automatic tracking working first, then add manual overrides when needed.

