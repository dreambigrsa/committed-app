import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { FileText, User, Shield, Edit2, Trash2 } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import colors from '@/constants/colors';

interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, any>;
  createdAt: string;
}

export default function AdminLogsScreen() {
  const { currentUser } = useApp();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('activity_logs')
        .select(`
          *,
          users!activity_logs_user_id_fkey(full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      if (data) {
        const formattedLogs: ActivityLog[] = data.map((log: any) => ({
          id: log.id,
          userId: log.user_id,
          userName: log.users?.full_name || 'Unknown User',
          action: log.action,
          resourceType: log.resource_type,
          resourceId: log.resource_id,
          details: log.details,
          createdAt: log.created_at,
        }));
        setLogs(formattedLogs);
      }
    } catch (error: any) {
      console.error('Failed to load logs:', error);
      // Extract proper error message
      const errorMessage = error?.message || error?.toString() || 'Failed to load logs';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    if (action.includes('create')) return Edit2;
    if (action.includes('delete')) return Trash2;
    if (action.includes('update')) return Edit2;
    if (action.includes('login')) return User;
    return Shield;
  };

  const getActionColor = (action: string) => {
    if (action.includes('delete')) return colors.danger;
    if (action.includes('create')) return colors.secondary;
    if (action.includes('update')) return colors.primary;
    return colors.text.tertiary;
  };

  if (!currentUser || currentUser.role !== 'super_admin') {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Activity Logs', headerShown: true }} />
        <View style={styles.errorContainer}>
          <Shield size={64} color={colors.danger} />
          <Text style={styles.errorText}>Access Denied</Text>
          <Text style={styles.errorSubtext}>Only Super Admins can view logs</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Activity Logs', headerShown: true }} />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Shield size={64} color={colors.danger} />
          <Text style={styles.errorText}>Failed to load logs</Text>
          <Text style={styles.errorSubtext}>{error}</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <FileText size={24} color={colors.primary} />
            <Text style={styles.headerTitle}>Activity Logs</Text>
            <Text style={styles.headerSubtitle}>Last 100 activities</Text>
          </View>

          <View style={styles.logsList}>
            {logs.map((log) => {
              const ActionIcon = getActionIcon(log.action);
              const actionColor = getActionColor(log.action);

              return (
                <View key={log.id} style={styles.logCard}>
                  <View style={[styles.logIcon, { backgroundColor: actionColor + '20' }]}>
                    <ActionIcon size={20} color={actionColor} />
                  </View>
                  <View style={styles.logContent}>
                    <Text style={styles.logAction}>{log.action}</Text>
                    <Text style={styles.logUser}>by {log.userName}</Text>
                    {log.resourceType && (
                      <Text style={styles.logResource}>
                        {log.resourceType}: {log.resourceId}
                      </Text>
                    )}
                    <Text style={styles.logTime}>
                      {new Date(log.createdAt).toLocaleString()}
                    </Text>
                  </View>
                </View>
              );
            })}

            {logs.length === 0 && (
              <View style={styles.emptyState}>
                <FileText size={64} color={colors.text.tertiary} />
                <Text style={styles.emptyText}>No activity logs yet</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  header: {
    padding: 24,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginTop: 12,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 4,
  },
  logsList: {
    padding: 16,
    gap: 12,
  },
  logCard: {
    flexDirection: 'row',
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  logIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logContent: {
    flex: 1,
  },
  logAction: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text.primary,
    marginBottom: 4,
  },
  logUser: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  logResource: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginBottom: 4,
  },
  logTime: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  emptyState: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.text.secondary,
    marginTop: 16,
  },
});
