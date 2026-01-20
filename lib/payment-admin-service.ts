import { supabase } from './supabase';

// ============================================
// PAYMENT METHODS
// ============================================

export async function getPaymentMethods() {
  const { data, error } = await supabase
    .from('payment_methods')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createPaymentMethod(method: {
  name: string;
  description?: string;
  paymentType: 'bank_transfer' | 'mobile_money' | 'cash' | 'crypto' | 'other';
  accountDetails?: any;
  instructions?: string;
  displayOrder?: number;
  iconEmoji?: string;
}) {
  const { data, error } = await supabase
    .from('payment_methods')
    .insert({
      name: method.name,
      description: method.description || null,
      payment_type: method.paymentType,
      account_details: method.accountDetails || null,
      instructions: method.instructions || null,
      display_order: method.displayOrder || 0,
      icon_emoji: method.iconEmoji || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePaymentMethod(
  methodId: string,
  updates: {
    name?: string;
    description?: string;
    paymentType?: 'bank_transfer' | 'mobile_money' | 'cash' | 'crypto' | 'other';
    accountDetails?: any;
    instructions?: string;
    displayOrder?: number;
    iconEmoji?: string;
    isActive?: boolean;
  }
) {
  const updateData: any = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description || null;
  if (updates.paymentType !== undefined) updateData.payment_type = updates.paymentType;
  if (updates.accountDetails !== undefined) updateData.account_details = updates.accountDetails || null;
  if (updates.instructions !== undefined) updateData.instructions = updates.instructions || null;
  if (updates.displayOrder !== undefined) updateData.display_order = updates.displayOrder;
  if (updates.iconEmoji !== undefined) updateData.icon_emoji = updates.iconEmoji || null;
  if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

  const { data, error } = await supabase
    .from('payment_methods')
    .update(updateData)
    .eq('id', methodId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deletePaymentMethod(methodId: string) {
  const { error } = await supabase
    .from('payment_methods')
    .delete()
    .eq('id', methodId);

  if (error) throw error;
}

// ============================================
// PAYMENT SUBMISSIONS
// ============================================

export async function getPaymentSubmissions(status?: 'all' | 'pending' | 'approved' | 'rejected') {
  let query = supabase
    .from('payment_submissions')
    .select(`
      *,
      user:users!payment_submissions_user_id_fkey(id, full_name, email, profile_picture),
      subscription_plan:subscription_plans!payment_submissions_subscription_plan_id_fkey(id, name, price_monthly, price_yearly),
      payment_method:payment_methods!payment_submissions_payment_method_id_fkey(id, name, icon_emoji)
    `)
    .order('created_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function getAdPaymentSubmissions(status?: 'all' | 'pending' | 'approved' | 'rejected') {
  let query = supabase
    .from('payment_submissions')
    .select(`
      *,
      user:users!payment_submissions_user_id_fkey(id, full_name, email, profile_picture),
      payment_method:payment_methods!payment_submissions_payment_method_id_fkey(id, name, icon_emoji),
      advertisement:advertisements!payment_submissions_advertisement_id_fkey(id, title, description, image_url, placement, total_budget, user_id, status, billing_status)
    `)
    .not('advertisement_id', 'is', null)
    .order('created_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function verifyPayment(
  submissionId: string,
  status: 'approved' | 'rejected',
  rejectionReason?: string
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const updateData: any = {
    status,
    verified_by: user.id,
    verified_at: new Date().toISOString(),
  };

  if (status === 'rejected' && rejectionReason) {
    updateData.rejection_reason = rejectionReason;
  }

  const { data, error } = await supabase
    .from('payment_submissions')
    .update(updateData)
    .eq('id', submissionId)
    .select(`
      *,
      user:users!payment_submissions_user_id_fkey(id, full_name, email),
      subscription_plan:subscription_plans!payment_submissions_subscription_plan_id_fkey(id, name, price_monthly, price_yearly),
      payment_method:payment_methods!payment_submissions_payment_method_id_fkey(id, name, icon_emoji)
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function verifyAdPayment(
  submissionId: string,
  status: 'approved' | 'rejected',
  rejectionReason?: string
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const updateData: any = {
    status,
    verified_by: user.id,
    verified_at: new Date().toISOString(),
  };

  if (status === 'rejected' && rejectionReason) {
    updateData.rejection_reason = rejectionReason;
  }

  const { data, error } = await supabase
    .from('payment_submissions')
    .update(updateData)
    .eq('id', submissionId)
    .select(`
      *,
      user:users!payment_submissions_user_id_fkey(id, full_name, email),
      payment_method:payment_methods!payment_submissions_payment_method_id_fkey(id, name, icon_emoji),
      advertisement:advertisements!payment_submissions_advertisement_id_fkey(id, title, status, billing_status)
    `)
    .single();

  if (error) throw error;

  if (data?.advertisement?.id) {
    const adUpdates: any =
      status === 'approved'
        ? { billing_status: 'paid', status: 'approved', active: true }
        : { billing_status: 'failed', status: 'rejected', active: false };

    const { error: adError } = await supabase
      .from('advertisements')
      .update(adUpdates)
      .eq('id', data.advertisement.id);

    if (adError) throw adError;
  }

  if (status === 'approved' && data?.advertisement?.id && data?.user?.id) {
    const receiptNumber = `AD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()}`;

    const { error: receiptError } = await supabase
      .from('ad_payment_receipts')
      .insert({
        advertisement_id: data.advertisement.id,
        payment_submission_id: data.id,
        user_id: data.user.id,
        amount: data.amount,
        currency: data.currency || 'USD',
        receipt_number: receiptNumber,
        issued_at: new Date().toISOString(),
      });

    if (receiptError) throw receiptError;

    await supabase.rpc('create_notification', {
      p_user_id: data.user.id,
      p_type: 'payment_approved',
      p_title: 'Ad payment approved',
      p_message: 'Your ad payment was approved. A receipt is now available.',
      p_data: { advertisementId: data.advertisement.id, receiptNumber },
    });
  }

  if (status === 'rejected' && data?.user?.id) {
    await supabase.rpc('create_notification', {
      p_user_id: data.user.id,
      p_type: 'payment_rejected',
      p_title: 'Ad payment rejected',
      p_message: 'Your ad payment was rejected. Please check the rejection reason.',
      p_data: { advertisementId: data.advertisement?.id, rejectionReason },
    });
  }

  return data;
}
