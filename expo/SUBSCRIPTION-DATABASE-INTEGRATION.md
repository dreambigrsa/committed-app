# Subscription & Premium Database Integration Guide

This document explains how the subscription/premium system is connected to the backend database.

## 📊 Database Schema

The subscription system uses **4 main tables**:

### 1. `subscription_plans` Table
Stores available subscription plans (Free, Premium, etc.)

```sql
- id (UUID) - Primary key
- name (TEXT) - Internal name (e.g., 'free', 'premium')
- display_name (TEXT) - User-facing name (e.g., 'Free', 'Premium')
- description (TEXT) - Plan description
- price_monthly (DECIMAL) - Monthly price
- price_yearly (DECIMAL) - Yearly price
- currency (TEXT) - Currency code (default: 'USD')
- is_active (BOOLEAN) - Whether plan is available
- display_order (INTEGER) - Display order in UI
- features (JSONB) - Additional feature flags
```

### 2. `user_subscriptions` Table
Stores user subscription records

```sql
- id (UUID) - Primary key
- user_id (UUID) - References users(id)
- plan_id (UUID) - References subscription_plans(id)
- status (TEXT) - 'active', 'cancelled', 'expired', 'trial'
- started_at (TIMESTAMP) - When subscription started
- expires_at (TIMESTAMP) - When subscription expires (NULL = lifetime)
- cancelled_at (TIMESTAMP) - When cancelled
- payment_provider (TEXT) - 'stripe', 'apple', 'google', 'manual'
- payment_provider_subscription_id (TEXT) - External payment ID
- auto_renew (BOOLEAN) - Whether to auto-renew
```

### 3. `dating_feature_limits` Table
Stores feature limits per plan (e.g., daily_likes, messages_per_conversation)

```sql
- id (UUID) - Primary key
- plan_id (UUID) - References subscription_plans(id)
- feature_name (TEXT) - e.g., 'daily_likes', 'conversation_starter', 'pre_match_messages'
- limit_value (INTEGER) - Limit amount (NULL = unlimited)
- limit_period (TEXT) - 'daily', 'weekly', 'monthly', 'lifetime'
```

### 4. `dating_usage_tracking` Table
Tracks user's usage of limited features

```sql
- id (UUID) - Primary key
- user_id (UUID) - References users(id)
- feature_name (TEXT) - Feature being tracked
- usage_count (INTEGER) - Current usage count
- period_start (TIMESTAMP) - Start of tracking period
- period_end (TIMESTAMP) - End of tracking period
```

## 🔗 How Frontend Connects to Database

### Current Implementation:

1. **Check Subscription Status** (`lib/dating-service.ts`)
   ```typescript
   // Gets user's current subscription
   const subscription = await supabase
     .from('user_subscriptions')
     .select('*, plan:subscription_plans(*)')
     .eq('user_id', user.id)
     .in('status', ['active', 'trial'])
     .single();
   ```

2. **Check Feature Limits** (`lib/dating-message-limits.ts`)
   ```typescript
   // Uses database functions to check limits
   const { data: allowed } = await supabase.rpc(
     'check_conversation_starter_limit',
     { sender_id_param: user.id, receiver_id_param: receiverId }
   );
   ```

3. **Get Subscription Plans** (`app/dating/premium.tsx`)
   ```typescript
   // Fetches active plans for display
   const { data: plans } = await supabase
     .from('subscription_plans')
     .select('*')
     .eq('is_active', true)
     .order('display_order');
   ```

## 🗄️ Database Functions

The system uses **3 PostgreSQL functions** (defined in migrations):

### 1. `check_dating_feature_limit(user_id, feature_name)`
Checks if user can perform an action (e.g., like a user)

**Returns:** `BOOLEAN` - true if allowed, false if limit reached

**Used for:**
- Daily likes
- Super likes
- Rewinds
- Boosts

### 2. `check_conversation_starter_limit(sender_id, receiver_id)`
Checks if user can send a conversation starter

**Returns:** `BOOLEAN` - true if allowed, false if already sent one

**Used for:** Conversation starter limits (1 per user, lifetime)

### 3. `check_dating_message_limit(sender_id, conversation_id)`
Checks if user can send a message in a dating conversation

**Returns:** `JSONB` with:
```json
{
  "allowed": true/false,
  "reason": "within_limit" | "pre_match_limit_reached" | "conversation_limit_reached",
  "limit": 3,
  "current": 2
}
```

**Used for:**
- Pre-match message limits (3 messages before matching)
- Messages per conversation limits (10 for free users)

### 4. `track_dating_usage(user_id, feature_name, increment)`
Tracks usage of features (automatically increments counters)

**Returns:** `BOOLEAN` - true if successful

**Used for:** Tracking daily likes, super likes, etc.

## 📝 How to Create a Subscription (When Payment Integrated)

When a user subscribes, you'll need to:

1. **Process Payment** (Stripe/Apple/Google)
   - Get payment confirmation
   - Get external subscription ID

2. **Create Subscription Record**
   ```typescript
   // In your payment success handler
   const { data: subscription, error } = await supabase
     .from('user_subscriptions')
     .insert({
       user_id: userId,
       plan_id: planId,
       status: 'active', // or 'trial' for trial subscriptions
       started_at: new Date().toISOString(),
       expires_at: expirationDate, // Calculate based on plan (monthly/yearly)
       payment_provider: 'stripe', // or 'apple', 'google', 'manual'
       payment_provider_subscription_id: externalSubscriptionId,
       auto_renew: true,
     })
     .select()
     .single();
   ```

3. **Handle Existing Subscriptions**
   - If user already has a subscription, you might want to:
     - Cancel old subscription
     - Upgrade/downgrade to new plan
     - Or create a new record (depending on your business logic)

## 🔐 Row Level Security (RLS) Policies

The database has RLS enabled for security:

- **subscription_plans**: Everyone can view active plans, only admins can edit
- **user_subscriptions**: Users can view their own, admins can view all
- **dating_feature_limits**: Everyone can view, only admins can edit
- **dating_usage_tracking**: Users can view their own, system can track usage

## 📋 Migration Files

Run these migrations in Supabase SQL Editor (in order):

1. `migrations/add-subscription-system.sql` - Base subscription tables
2. `migrations/add-dating-message-limits.sql` - Message limit functions

## 🎯 Current Status

### ✅ Already Implemented:
- Database schema (all 4 tables)
- RLS policies
- Database functions for checking limits
- Frontend integration for checking limits
- Admin UI for managing plans and limits
- User-facing premium page

### ⚠️ Still Needed (For Full Payment Integration):

1. **Payment Processing**
   - Integrate Stripe/Apple Pay/Google Pay
   - Create webhook handlers for payment events
   - Handle subscription renewals
   - Handle cancellations

2. **Subscription Creation Function**
   ```sql
   -- Example function you might want to create:
   CREATE OR REPLACE FUNCTION create_user_subscription(
     p_user_id UUID,
     p_plan_id UUID,
     p_payment_provider TEXT,
     p_payment_provider_id TEXT,
     p_expires_at TIMESTAMP WITH TIME ZONE
   )
   RETURNS UUID AS $$
   DECLARE
     v_subscription_id UUID;
   BEGIN
     -- Cancel existing subscription if any
     UPDATE user_subscriptions
     SET status = 'cancelled', cancelled_at = NOW()
     WHERE user_id = p_user_id AND status IN ('active', 'trial');
     
     -- Create new subscription
     INSERT INTO user_subscriptions (
       user_id, plan_id, status, started_at, expires_at,
       payment_provider, payment_provider_subscription_id, auto_renew
     )
     VALUES (
       p_user_id, p_plan_id, 'active', NOW(), p_expires_at,
       p_payment_provider, p_payment_provider_id, true
     )
     RETURNING id INTO v_subscription_id;
     
     RETURN v_subscription_id;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   ```

3. **Webhook Handler** (Supabase Edge Function or external API)
   - Handle payment success events
   - Handle payment failure events
   - Handle subscription cancellation events
   - Update `user_subscriptions` table accordingly

## 🔄 Data Flow Example

**User tries to send a conversation starter:**

1. User taps conversation starter button
2. Frontend calls `checkConversationStarterLimit(receiverId)`
3. Function calls `check_conversation_starter_limit()` database function
4. Database function:
   - Gets user's plan from `user_subscriptions`
   - Gets limit from `dating_feature_limits` for that plan
   - Checks if user already sent starter (queries `messages` table)
   - Returns true/false
5. Frontend receives result
6. If allowed: sends message
7. If not allowed: shows premium modal

**User subscribes to premium:**

1. User clicks "Subscribe" on a plan
2. Payment processing (Stripe/Apple/Google)
3. On success: Create record in `user_subscriptions`
4. User now has premium status
5. All limit checks now return unlimited (NULL limits)
6. User can use premium features

## 📞 Need Help?

If you need to:
- **Create a subscription manually** (for testing):
  ```sql
  INSERT INTO user_subscriptions (user_id, plan_id, status, started_at)
  VALUES ('user-uuid-here', 'premium-plan-uuid', 'active', NOW());
  ```

- **Check a user's subscription**:
  ```sql
  SELECT us.*, sp.display_name, sp.name
  FROM user_subscriptions us
  JOIN subscription_plans sp ON sp.id = us.plan_id
  WHERE us.user_id = 'user-uuid-here'
    AND us.status IN ('active', 'trial');
  ```

- **Update a subscription**:
  ```sql
  UPDATE user_subscriptions
  SET status = 'cancelled', cancelled_at = NOW()
  WHERE user_id = 'user-uuid-here';
  ```

## ✅ Next Steps

1. **Run the migrations** in Supabase SQL Editor:
   - `migrations/add-subscription-system.sql`
   - `migrations/add-dating-message-limits.sql`

2. **Set up payment provider** (Stripe recommended):
   - Create Stripe account
   - Get API keys
   - Set up webhooks

3. **Implement subscription creation**:
   - Create Edge Function or API endpoint
   - Handle payment success
   - Create subscription record

4. **Test the flow**:
   - Create test subscription manually
   - Verify limits work correctly
   - Test premium features unlock

