# Relationship Sync Across Devices - Implementation

## Overview
This implementation provides real-time synchronization of relationship data across all devices, with offline queue support and conflict resolution.

## Features Implemented

### 1. Real-Time Sync ✅
- **Real-time subscriptions** for relationship updates
- Both partners see updates immediately when:
  - Relationship is created
  - Relationship status changes (pending → verified → ended)
  - Relationship requests are accepted/rejected
  - Relationship details are updated
- Subscriptions listen to both `user_id` and `partner_user_id` to catch all relevant updates

### 2. Offline Queue ✅
- **Automatic queuing** when network is unavailable
- Relationship operations are queued locally when offline:
  - Create relationship
  - Accept/reject relationship request
  - End relationship
  - Update relationship
- **Automatic sync** when connection is restored
- Queue is processed on app startup and when network reconnects

### 3. Conflict Resolution ✅
- **Timestamp-based conflict detection**
- Detects when server data was modified after local change
- **Three resolution strategies**:
  - `local`: Keep local changes (overwrite server)
  - `server`: Keep server version (discard local)
  - `merge`: Combine both changes intelligently
- Conflicts are saved for manual resolution if needed

## Implementation Details

### Files Created/Modified

#### 1. `lib/relationship-sync.ts` (NEW)
Utility library for offline queue and conflict resolution:
- `queueRelationshipChange()` - Add change to offline queue
- `getOfflineQueue()` - Get pending changes
- `syncOfflineQueue()` - Sync queue with server
- `saveConflict()` - Save conflict for resolution
- `resolveConflict()` - Resolve a conflict

#### 2. `contexts/AppContext.tsx` (MODIFIED)
- Added real-time subscription for relationships table
- Integrated offline queue in relationship operations
- Added automatic sync on user data load
- Enhanced error handling for network failures

### Real-Time Subscriptions

```typescript
// Subscribes to relationship changes for current user
const relationshipsChannel = supabase
  .channel('relationships_realtime')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'relationships',
    filter: `user_id=eq.${userId}`,
  }, async (payload) => {
    await refreshRelationships();
  })
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'relationships',
    filter: `partner_user_id=eq.${userId}`,
  }, async (payload) => {
    await refreshRelationships();
  })
  .subscribe();
```

### Offline Queue Flow

1. **User performs action** (e.g., accept relationship request)
2. **Network request fails** (offline or network error)
3. **Change is queued** locally in AsyncStorage
4. **User continues using app** (changes work locally)
5. **Connection restored** → Queue syncs automatically
6. **Conflicts detected** → Saved for resolution
7. **Success** → Queue item removed

### Conflict Resolution Flow

1. **Conflict detected** during sync:
   - Server data was modified after local change
   - Timestamp comparison: `server.updated_at > local.timestamp`
2. **Conflict saved** to AsyncStorage
3. **Resolution options**:
   - Automatic: Use server version (default)
   - Manual: User chooses local/server/merge
4. **Resolution applied** to database

## Usage

### Automatic (No Code Changes Needed)
- Real-time sync works automatically
- Offline queue works automatically
- Conflicts are detected automatically

### Manual Conflict Resolution (If Needed)

```typescript
import { getConflicts, resolveConflict } from '@/lib/relationship-sync';

// Get unresolved conflicts
const conflicts = await getConflicts();

// Resolve a conflict
await resolveConflict(
  conflictId,
  'local', // or 'server' or 'merge'
  mergedData // if merging
);
```

## Benefits

1. **Immediate Updates**: Both partners see relationship changes instantly
2. **Offline Support**: Users can perform actions offline, syncs when online
3. **Conflict Prevention**: Timestamp-based detection prevents data loss
4. **Multi-Device**: Works seamlessly across phone, tablet, web
5. **Reliable**: Queue persists across app restarts

## Testing

### Test Real-Time Sync
1. Open app on two devices with same account
2. Accept relationship request on Device A
3. Device B should see update immediately (within 1-2 seconds)

### Test Offline Queue
1. Turn off network on Device A
2. Accept relationship request
3. Should see "queued for sync" message
4. Turn network back on
5. Change should sync automatically

### Test Conflict Resolution
1. Make change on Device A (offline)
2. Make different change on Device B (online)
3. Device A comes online
4. Conflict should be detected and resolved

## Future Enhancements

1. **Network State Monitoring**: Use NetInfo to detect online/offline
2. **Conflict Resolution UI**: Screen to manually resolve conflicts
3. **Sync Status Indicator**: Show sync status in UI
4. **Retry Logic**: Automatic retry for failed syncs
5. **Batch Operations**: Sync multiple changes in one request

## Notes

- Queue is stored in AsyncStorage (persists across app restarts)
- Conflicts are stored separately for manual resolution
- Real-time subscriptions are automatically cleaned up on logout
- Sync happens automatically on app startup if queue exists

