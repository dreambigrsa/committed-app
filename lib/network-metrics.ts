import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEY = 'committed:network-metrics:session';

type SessionMetrics = {
  sessionId: string;
  startedAt: string;
  totalRequests: number;
  totalResponseBytes: number;
};

let cache: SessionMetrics | null = null;

function createSession(): SessionMetrics {
  return {
    sessionId: `${Date.now()}`,
    startedAt: new Date().toISOString(),
    totalRequests: 0,
    totalResponseBytes: 0,
  };
}

export async function getSessionMetrics(): Promise<SessionMetrics> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    cache = raw ? JSON.parse(raw) : createSession();
  } catch {
    cache = createSession();
  }
  return cache ?? createSession();
}

export async function recordApiCall(responseBytes: number): Promise<void> {
  const current = await getSessionMetrics();
  const next: SessionMetrics = {
    ...current,
    totalRequests: current.totalRequests + 1,
    totalResponseBytes: current.totalResponseBytes + Math.max(0, responseBytes),
  };
  cache = next;
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(next));
}

export async function resetSessionMetrics(): Promise<void> {
  cache = createSession();
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(cache));
}
