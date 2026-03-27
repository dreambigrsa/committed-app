/**
 * Persist referral code across app restarts and email verification.
 * Attach to signup when user completes registration.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const REFERRAL_CODE_KEY = '@committed/referral_code';

export async function getStoredReferralCode(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(REFERRAL_CODE_KEY);
  } catch {
    return null;
  }
}

export async function setStoredReferralCode(code: string): Promise<void> {
  try {
    await AsyncStorage.setItem(REFERRAL_CODE_KEY, code);
  } catch (e) {
    console.warn('Failed to store referral code:', e);
  }
}

export async function clearStoredReferralCode(): Promise<void> {
  try {
    await AsyncStorage.removeItem(REFERRAL_CODE_KEY);
  } catch {
    // no-op
  }
}
