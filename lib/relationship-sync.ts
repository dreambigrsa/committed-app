/**
 * Relationship Sync Utility
 * 
 * Handles real-time sync, offline queue, and conflict resolution
 * for relationship updates across devices.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { Relationship } from '@/types';

const OFFLINE_QUEUE_KEY = '@relationship_offline_queue';
const SYNC_CONFLICTS_KEY = '@relationship_sync_conflicts';

export interface OfflineRelationshipChange {
  id: string;
  type: 'create' | 'update' | 'delete' | 'accept' | 'reject' | 'end';
  relationshipId?: string;
  data: any;
  timestamp: number;
  deviceId: string;
}

export interface RelationshipConflict {
  relationshipId: string;
  localChange: OfflineRelationshipChange;
  serverChange: any;
  timestamp: number;
  resolved: boolean;
}

/**
 * Add a relationship change to the offline queue
 */
export async function queueRelationshipChange(
  change: Omit<OfflineRelationshipChange, 'id' | 'timestamp' | 'deviceId'>
): Promise<void> {
  try {
    const queue = await getOfflineQueue();
    const deviceId = await getDeviceId();
    
    const queuedChange: OfflineRelationshipChange = {
      ...change,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      deviceId,
    };
    
    queue.push(queuedChange);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('Failed to queue relationship change:', error);
  }
}

/**
 * Get all pending offline relationship changes
 */
export async function getOfflineQueue(): Promise<OfflineRelationshipChange[]> {
  try {
    const queueJson = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!queueJson) return [];
    return JSON.parse(queueJson);
  } catch (error) {
    console.error('Failed to get offline queue:', error);
    return [];
  }
}

/**
 * Clear the offline queue
 */
export async function clearOfflineQueue(): Promise<void> {
  try {
    await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
  } catch (error) {
    console.error('Failed to clear offline queue:', error);
  }
}

/**
 * Remove a specific change from the offline queue
 */
export async function removeFromQueue(changeId: string): Promise<void> {
  try {
    const queue = await getOfflineQueue();
    const filtered = queue.filter(c => c.id !== changeId);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to remove from queue:', error);
  }
}

/**
 * Sync offline queue with server when connection is restored
 */
export async function syncOfflineQueue(
  onConflict?: (conflict: RelationshipConflict) => Promise<'local' | 'server' | 'merge'>
): Promise<{ synced: number; conflicts: number; errors: number }> {
  const queue = await getOfflineQueue();
  if (queue.length === 0) return { synced: 0, conflicts: 0, errors: 0 };

  let synced = 0;
  let conflicts = 0;
  let errors = 0;

  for (const change of queue) {
    try {
      const result = await processQueuedChange(change, onConflict);
      if (result === 'synced') {
        synced++;
        await removeFromQueue(change.id);
      } else if (result === 'conflict') {
        conflicts++;
      } else {
        errors++;
      }
    } catch (error) {
      console.error(`Failed to sync change ${change.id}:`, error);
      errors++;
    }
  }

  return { synced, conflicts, errors };
}

/**
 * Process a single queued change
 */
async function processQueuedChange(
  change: OfflineRelationshipChange,
  onConflict?: (conflict: RelationshipConflict) => Promise<'local' | 'server' | 'merge'>
): Promise<'synced' | 'conflict' | 'error'> {
  try {
    switch (change.type) {
      case 'create':
        // Check if relationship already exists (created on another device)
        if (change.relationshipId) {
          const { data: existing } = await supabase
            .from('relationships')
            .select('*')
            .eq('id', change.relationshipId)
            .single();
          
          if (existing) {
            // Conflict: relationship was created on another device
            if (onConflict) {
              const conflict: RelationshipConflict = {
                relationshipId: change.relationshipId,
                localChange: change,
                serverChange: existing,
                timestamp: Date.now(),
                resolved: false,
              };
              const resolution = await onConflict(conflict);
              if (resolution === 'local') {
                // Keep local version (shouldn't happen for create)
                return 'synced';
              } else if (resolution === 'server') {
                // Use server version
                return 'synced';
              } else {
                // Merge (not applicable for create)
                return 'conflict';
              }
            }
            return 'conflict';
          }
        }
        
        // Create relationship
        const { error } = await supabase
          .from('relationships')
          .insert(change.data);
        
        if (error) throw error;
        return 'synced';

      case 'update':
        // Check for conflicts by comparing updated_at
        if (change.relationshipId) {
          const { data: serverRel } = await supabase
            .from('relationships')
            .select('*')
            .eq('id', change.relationshipId)
            .single();
          
          if (serverRel) {
            const serverUpdated = new Date(serverRel.updated_at).getTime();
            const localUpdated = change.timestamp;
            
            // If server was updated after local change, there's a conflict
            if (serverUpdated > localUpdated) {
              if (onConflict) {
                const conflict: RelationshipConflict = {
                  relationshipId: change.relationshipId,
                  localChange: change,
                  serverChange: serverRel,
                  timestamp: Date.now(),
                  resolved: false,
                };
                const resolution = await onConflict(conflict);
                
                if (resolution === 'local') {
                  // Apply local changes
                  await supabase
                    .from('relationships')
                    .update(change.data)
                    .eq('id', change.relationshipId);
                  return 'synced';
                } else if (resolution === 'server') {
                  // Keep server version
                  return 'synced';
                } else {
                  // Merge changes
                  const merged = { ...serverRel, ...change.data };
                  await supabase
                    .from('relationships')
                    .update(merged)
                    .eq('id', change.relationshipId);
                  return 'synced';
                }
              }
              return 'conflict';
            }
          }
        }
        
        // Apply update
        const { error: updateError } = await supabase
          .from('relationships')
          .update(change.data)
          .eq('id', change.relationshipId);
        
        if (updateError) throw updateError;
        return 'synced';

      case 'delete':
      case 'end':
        // Check if relationship still exists
        if (change.relationshipId) {
          const { data: existing } = await supabase
            .from('relationships')
            .select('*')
            .eq('id', change.relationshipId)
            .single();
          
          if (!existing) {
            // Already deleted, no conflict
            return 'synced';
          }
          
          // Apply delete/end
          const updateData = change.type === 'end' 
            ? { status: 'ended', end_date: new Date().toISOString() }
            : { status: 'ended' };
          
          await supabase
            .from('relationships')
            .update(updateData)
            .eq('id', change.relationshipId);
          
          return 'synced';
        }
        return 'error';

      case 'accept':
      case 'reject':
        // Handle relationship request acceptance/rejection
        if (change.relationshipId) {
          await supabase
            .from('relationship_requests')
            .update({ status: change.type === 'accept' ? 'accepted' : 'rejected' })
            .eq('id', change.relationshipId);
          return 'synced';
        }
        return 'error';

      default:
        return 'error';
    }
  } catch (error) {
    console.error('Error processing queued change:', error);
    return 'error';
  }
}

/**
 * Get or create a unique device ID
 */
async function getDeviceId(): Promise<string> {
  try {
    const deviceIdKey = '@device_id';
    let deviceId = await AsyncStorage.getItem(deviceIdKey);
    
    if (!deviceId) {
      deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await AsyncStorage.setItem(deviceIdKey, deviceId);
    }
    
    return deviceId;
  } catch (error) {
    // Fallback to timestamp-based ID
    return `device-${Date.now()}`;
  }
}

/**
 * Save a conflict for later resolution
 */
export async function saveConflict(conflict: RelationshipConflict): Promise<void> {
  try {
    const conflicts = await getConflicts();
    conflicts.push(conflict);
    await AsyncStorage.setItem(SYNC_CONFLICTS_KEY, JSON.stringify(conflicts));
  } catch (error) {
    console.error('Failed to save conflict:', error);
  }
}

/**
 * Get all unresolved conflicts
 */
export async function getConflicts(): Promise<RelationshipConflict[]> {
  try {
    const conflictsJson = await AsyncStorage.getItem(SYNC_CONFLICTS_KEY);
    if (!conflictsJson) return [];
    return JSON.parse(conflictsJson).filter((c: RelationshipConflict) => !c.resolved);
  } catch (error) {
    console.error('Failed to get conflicts:', error);
    return [];
  }
}

/**
 * Resolve a conflict
 */
export async function resolveConflict(
  conflictId: string,
  resolution: 'local' | 'server' | 'merge',
  mergedData?: any
): Promise<void> {
  try {
    const conflicts = await getConflicts();
    const conflict = conflicts.find(c => 
      c.relationshipId === conflictId || 
      c.localChange.id === conflictId
    );
    
    if (!conflict) return;
    
    // Apply resolution
    if (resolution === 'local') {
      await supabase
        .from('relationships')
        .update(conflict.localChange.data)
        .eq('id', conflict.relationshipId);
    } else if (resolution === 'server') {
      // Keep server version, no action needed
    } else if (resolution === 'merge' && mergedData) {
      await supabase
        .from('relationships')
        .update(mergedData)
        .eq('id', conflict.relationshipId);
    }
    
    // Mark as resolved
    conflict.resolved = true;
    await AsyncStorage.setItem(SYNC_CONFLICTS_KEY, JSON.stringify(conflicts));
  } catch (error) {
    console.error('Failed to resolve conflict:', error);
  }
}

/**
 * Check if device is online
 */
export function isOnline(): boolean {
  // This is a simple check - in production, use NetInfo
  return true; // Assume online for now
}

