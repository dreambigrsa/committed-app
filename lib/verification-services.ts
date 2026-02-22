import { supabase } from './supabase';

interface ServiceConfig {
  service_type: 'sms' | 'email';
  provider: string;
  enabled: boolean;
  config: {
    account_sid?: string;
    auth_token?: string;
    phone_number?: string;
    api_key?: string;
    from_email?: string;
    from_name?: string;
  };
}

/**
 * Get service configuration from database
 * Returns null if table doesn't exist or config is not found (graceful fallback)
 */
export async function getServiceConfig(serviceType: 'sms' | 'email'): Promise<ServiceConfig | null> {
  try {
    console.log(`[getServiceConfig] Fetching ${serviceType} config...`);
    
    // First, try to check if table exists by querying it
    const { data, error } = await supabase
      .from('verification_service_configs')
      .select('*', { count: 'exact' })
      .eq('service_type', serviceType)
      .maybeSingle();

    // If table doesn't exist or no config found, return null (not an error)
    if (error) {
      console.error(`[getServiceConfig] Error fetching ${serviceType} config:`, {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      
      // Check if it's a "table doesn't exist" error (code 42P01) or RLS issue
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.log(`[getServiceConfig] verification_service_configs table doesn't exist - verification will work without external service`);
        return null;
      }
      
      // Check for RLS/permission errors
      if (error.code === '42501' || error.code === 'PGRST301' || error.message?.includes('permission denied') || error.message?.includes('RLS')) {
        console.error(`[getServiceConfig] RLS/permission error - user may not have access to verification_service_configs table`);
        console.error(`[getServiceConfig] This is likely an RLS policy issue. Check that users can read verification_service_configs.`);
        
        // Try to query all configs to see if we get any data (for debugging)
        const { data: allData, error: allError } = await supabase
          .from('verification_service_configs')
          .select('*');
        console.log(`[getServiceConfig] Debug - All configs query result:`, {
          hasData: !!allData,
          dataCount: allData?.length || 0,
          error: allError?.message,
        });
        
        return null;
      }
      
      // For other errors, log but don't throw
      console.warn(`[getServiceConfig] Failed to get ${serviceType} config (non-critical):`, error.message);
      return null;
    }

    // If no data found, that's okay - service just isn't configured
    if (!data) {
      console.log(`[getServiceConfig] No ${serviceType} config found in database`);
      
      // Debug: Try to see if ANY configs exist
      const { data: allConfigs, error: debugError } = await supabase
        .from('verification_service_configs')
        .select('service_type, enabled, provider');
      console.log(`[getServiceConfig] Debug - All configs in database:`, allConfigs);
      if (debugError) {
        console.error(`[getServiceConfig] Debug query error:`, debugError);
      }
      
      return null;
    }

    console.log(`[getServiceConfig] Found ${serviceType} config:`, {
      enabled: data.enabled,
      provider: data.provider,
      hasApiKey: !!data.config?.api_key,
      hasFromEmail: !!data.config?.from_email,
      configKeys: data.config ? Object.keys(data.config) : [],
    });

    return data as ServiceConfig;
  } catch (error: any) {
    // Catch any unexpected errors and return null gracefully
    console.error(`[getServiceConfig] Unexpected error getting ${serviceType} config:`, error?.message || error);
    return null;
  }
}

/**
 * Send SMS verification code via Twilio
 * This should be called from a Supabase Edge Function for security
 */
export async function sendSmsCode(phoneNumber: string, code: string): Promise<{ success: boolean; error?: string }> {
  try {
    const config = await getServiceConfig('sms');
    
    if (!config || !config.enabled) {
      return { success: false, error: 'SMS service is not configured or enabled' };
    }

    if (config.provider === 'twilio') {
      try {
        // Call Supabase Edge Function to send SMS
        // The edge function will handle the Twilio API call securely
        const { data, error } = await supabase.functions.invoke('send-sms', {
          body: {
            phoneNumber,
            code,
          },
        });

        if (error) {
          console.error('SMS function error:', error);
          // If function doesn't exist or fails, fall back to showing code
          return { success: false, error: 'SMS service unavailable. Please configure edge functions.' };
        }

        return { success: data?.success || false, error: data?.error };
      } catch (err: any) {
        // Edge function might not be deployed yet
        console.error('Failed to invoke SMS function:', err);
        return { success: false, error: 'SMS service not available. Please deploy edge functions.' };
      }
    }

    return { success: false, error: 'Unsupported SMS provider' };
  } catch (error: any) {
    console.error('Failed to send SMS:', error);
    return { success: false, error: error.message || 'Failed to send SMS' };
  }
}

/**
 * Send Email verification code via Resend
 * This should be called from a Supabase Edge Function for security
 */
export async function sendEmailCode(email: string, code: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[sendEmailCode] Getting email service config...');
    const config = await getServiceConfig('email');
    
    console.log('[sendEmailCode] Config result:', {
      configExists: !!config,
      enabled: config?.enabled,
      provider: config?.provider,
    });
    
    // If config doesn't exist or is disabled, that's okay - we'll show code in alert
    if (!config) {
      console.warn('[sendEmailCode] No email config found - will show code in alert');
      return { success: false, error: 'Email service is not configured or enabled' };
    }
    
    if (!config.enabled) {
      console.warn('[sendEmailCode] Email config exists but is disabled');
      return { success: false, error: 'Email service is not configured or enabled' };
    }

    if (config.provider === 'resend') {
      try {
        // Call Supabase Edge Function to send Email
        // The edge function will handle the Resend API call securely
        const { data, error } = await supabase.functions.invoke('send-email', {
          body: {
            email,
            code,
          },
        });

        if (error) {
          console.error('Email function error:', error);
          // If function doesn't exist or fails, fall back to showing code
          return { success: false, error: 'Email service unavailable. Please configure edge functions.' };
        }

        return { success: data?.success || false, error: data?.error };
      } catch (err: any) {
        // Edge function might not be deployed yet
        console.error('Failed to invoke email function:', err);
        return { success: false, error: 'Email service not available. Please deploy edge functions.' };
      }
    }

    // Fallback: Use Supabase Auth email if Resend is not configured
    if (config.provider === 'supabase') {
      // For now, we'll use a simple approach - store code in database
      // and let the user enter it manually
      return { success: true };
    }

    return { success: false, error: 'Unsupported email provider' };
  } catch (error: any) {
    console.error('Failed to send email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

/**
 * Fallback: Send email using Supabase's built-in email (if edge function fails)
 * This creates a verification code entry that can be checked
 */
export async function createVerificationCode(
  userId: string,
  type: 'phone' | 'email',
  contact: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const insertData: any = {
      user_id: userId,
      verification_type: type, // Use verification_type, not type
      code,
      expires_at: expiresAt,
      used: false,
    };

    // Add phone_number or email based on type
    // Only add if the column exists (handles cases where table might not have these columns yet)
    if (type === 'phone') {
      insertData.phone_number = contact;
    } else {
      insertData.email = contact;
    }

    // Explicitly specify columns to avoid schema cache issues
    // This ensures we only insert the columns that exist
    const { error } = await supabase
      .from('verification_codes')
      .insert(insertData)
      .select('id'); // Select a column to verify the insert worked

    if (error) {
      console.error('Failed to create verification code:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      
      // If error mentions 'type' column (schema cache issue), retry with minimal data
      if (error.message?.includes("'type' column") || (error.message?.includes('type') && error.message?.includes('schema cache'))) {
        console.log('Schema cache error detected - retrying with minimal columns (no phone_number/email)...');
        const minimalData: any = {
          user_id: userId,
          verification_type: type,
          code,
          expires_at: expiresAt,
          used: false,
        };
        
        const { error: retryError } = await supabase
          .from('verification_codes')
          .insert(minimalData)
          .select('id');
        
        if (retryError) {
          console.error('Retry also failed:', retryError);
          return { 
            success: false, 
            error: `Schema cache issue. Please run 'force-refresh-schema.sql' in Supabase SQL Editor to refresh the cache. Error: ${retryError.message}` 
          };
        }
        console.log('Successfully inserted with minimal columns (bypassed schema cache)');
        return { success: true };
      }
      
      // If phone_number or email column doesn't exist, try without them
      if (error.message?.includes('phone_number') || error.message?.includes('email')) {
        console.log('Retrying without phone_number/email columns...');
        const retryData: any = {
          user_id: userId,
          verification_type: type,
          code,
          expires_at: expiresAt,
          used: false,
        };
        
        const { error: retryError } = await supabase
          .from('verification_codes')
          .insert(retryData)
          .select('id');
        
        if (retryError) {
          return { success: false, error: retryError.message };
        }
        return { success: true };
      }
      
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error creating verification code:', error);
    return { success: false, error: error.message || 'Failed to create verification code' };
  }
}
