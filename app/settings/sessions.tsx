import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, Smartphone, Trash2, CheckCircle2 } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';

interface Session {
  id: string;
  device_info: string;
  last_active: string;
  created_at: string;
  is_active: boolean;
}

export default function SessionsScreen() {
  const router = useRouter();
  const { currentUser } = useApp();
  const { colors } = useTheme();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, [currentUser]);

  const loadSessions = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      // Get current session from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      
      // Get stored sessions from database
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('is_active', true)
        .order('last_active', { ascending: false });

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading sessions:', error);
      }

      const sessionList: Session[] = [];
      
      // Add current session
      if (session) {
        const deviceInfo = `${Platform.OS} Device`;
        sessionList.push({
          id: session.access_token,
          device_info: `${deviceInfo} (Current)`,
          last_active: new Date().toISOString(),
          created_at: new Date(session.expires_at! - 3600000).toISOString(), // Approximate
          is_active: true,
        });
      }

      // Add other sessions from database
      if (data) {
        data.forEach((s: any) => {
          if (s.session_token !== session?.access_token) {
            sessionList.push({
              id: s.id,
              device_info: s.device_info || 'Unknown Device',
              last_active: s.last_active,
              created_at: s.created_at,
              is_active: s.is_active,
            });
          }
        });
      }

      setSessions(sessionList);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteSession = async (sessionId: string, isCurrent: boolean) => {
    if (isCurrent) {
      Alert.alert('Cannot Delete', 'You cannot delete your current session. Please sign out instead.');
      return;
    }

    Alert.alert(
      'End Session',
      'Are you sure you want to end this session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('user_sessions')
                .update({ is_active: false })
                .eq('id', sessionId);

              if (error) throw error;

              setSessions(sessions.filter(s => s.id !== sessionId));
              Alert.alert('Success', 'Session ended successfully.');
            } catch (error) {
              console.error('Failed to delete session:', error);
              Alert.alert('Error', 'Failed to end session. Please try again.');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Active Sessions',
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()}>
                <ArrowLeft size={24} color={colors.text.primary} />
              </TouchableOpacity>
            ),
          }}
        />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Active Sessions',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <ArrowLeft size={24} color={colors.text.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.section, { backgroundColor: colors.background.primary }]}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Active Sessions ({sessions.length})
          </Text>
          <Text style={[styles.description, { color: colors.text.secondary }]}>
            Manage devices that are signed in to your account. End any session you don't recognize.
          </Text>
        </View>

        {sessions.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: colors.background.primary }]}>
            <Smartphone size={48} color={colors.text.tertiary} />
            <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
              No active sessions found
            </Text>
          </View>
        ) : (
          sessions.map((session) => {
            const isCurrent = session.device_info.includes('Current');
            return (
              <View
                key={session.id}
                style={[styles.sessionCard, { backgroundColor: colors.background.primary, borderColor: colors.border.light }]}
              >
                <View style={styles.sessionHeader}>
                  <View style={styles.sessionInfo}>
                    <Smartphone size={20} color={colors.primary} />
                    <View style={styles.sessionDetails}>
                      <Text style={[styles.deviceName, { color: colors.text.primary }]}>
                        {session.device_info}
                      </Text>
                      <Text style={[styles.lastActive, { color: colors.text.secondary }]}>
                        Last active: {formatDate(session.last_active)}
                      </Text>
                    </View>
                  </View>
                  {isCurrent && (
                    <View style={[styles.currentBadge, { backgroundColor: colors.secondary + '20' }]}>
                      <CheckCircle2 size={14} color={colors.secondary} />
                      <Text style={[styles.currentText, { color: colors.secondary }]}>Current</Text>
                    </View>
                  )}
                </View>
                {!isCurrent && (
                  <TouchableOpacity
                    style={[styles.deleteButton, { borderColor: colors.border.light }]}
                    onPress={() => deleteSession(session.id, false)}
                  >
                    <Trash2 size={16} color={colors.danger} />
                    <Text style={[styles.deleteText, { color: colors.danger }]}>End Session</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyContainer: {
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
  },
  sessionCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sessionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  sessionDetails: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  lastActive: {
    fontSize: 13,
  },
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  currentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  deleteText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

