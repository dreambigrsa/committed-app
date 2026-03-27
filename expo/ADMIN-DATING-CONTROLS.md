# 🎛️ Admin Controls for Dating System

## ✅ Complete Admin Control System

Admins now have **full control** over the dating system, users, pricing, and limits!

## 🎯 Admin Features

### 1. **Dating Management Dashboard** (`/admin/dating`)

Admins can:
- **View All Dating Profiles**: See all user dating profiles with status
- **View All Matches**: See all mutual matches in the system
- **View All Likes**: See all likes (including super likes)
- **View Statistics**: Total profiles, active profiles, matches, likes
- **Deactivate Profiles**: Ban users from dating features
- **Search & Filter**: Find specific users or matches

**Access**: Admin & Super Admin

### 2. **Pricing & Subscription Management** (`/admin/pricing`)

Admins can:
- **Set Plan Prices**: Configure monthly/yearly prices for each plan
- **Set Feature Limits**: Configure limits for free users:
  - Daily likes limit (default: 10)
  - Daily super likes limit (default: 1)
  - Rewinds (default: 0)
  - Boosts (default: 0)
- **Configure Global Settings**:
  - Currency (default: USD)
  - Free trial days (default: 7)
- **Manage Plans**: Create/edit subscription plans

**Access**: Admin & Super Admin

### 3. **User Management** (Enhanced)

Existing user management now includes:
- View dating profile status
- See subscription status
- Manage user access to dating features

## 💰 Subscription System

### Plans

#### **Free Plan** (Default)
- **Price**: $0/month
- **Limits**:
  - 10 likes per day
  - 1 super like per day
  - 0 rewinds
  - 0 boosts
- **Features**:
  - Basic matching
  - Limited discovery
  - Standard messaging

#### **Premium Plan**
- **Price**: $9.99/month or $99.99/year (admin configurable)
- **Limits**: **Unlimited** for all features
- **Features**:
  - Unlimited likes
  - Unlimited super likes
  - Rewind last swipe
  - Boost profile visibility
  - See who liked you
  - Read receipts
  - Priority support

### How Limits Work

1. **Daily Limits**: Reset at midnight (user's timezone)
2. **Weekly Limits**: Reset at start of week
3. **Monthly Limits**: Reset at start of month
4. **Lifetime Limits**: Never reset

### Usage Tracking

The system automatically tracks:
- Daily likes used
- Daily super likes used
- Rewinds used
- Boosts used

## 🔒 Feature Enforcement

### Automatic Limit Checking

When users try to:
- **Like someone**: System checks daily likes limit
- **Super like**: System checks daily super likes limit
- **Rewind**: System checks rewinds limit
- **Boost**: System checks boosts limit

If limit reached:
- User sees error message
- Suggestion to upgrade to Premium
- Action is blocked

### Database Functions

1. **`check_dating_feature_limit(user_id, feature_name)`**
   - Returns `true` if user can perform action
   - Returns `false` if limit reached
   - Automatically gets user's plan

2. **`track_dating_usage(user_id, feature_name, increment)`**
   - Tracks usage for limit enforcement
   - Automatically increments counter
   - Handles period resets

3. **`get_user_subscription_plan(user_id)`**
   - Returns user's current plan
   - Falls back to free plan if no subscription

## 📊 Admin Dashboard Sections

### Dating Management
- **Profiles Tab**: All dating profiles
- **Matches Tab**: All mutual matches
- **Likes Tab**: All likes (one-way)
- **Stats Tab**: Overview statistics

### Pricing Management
- **Global Settings**: Currency, trial days
- **Plan Configuration**: Prices for each plan
- **Feature Limits**: Limits for each plan

## 🎨 User Experience

### Free Users
- See limit indicators (e.g., "8/10 likes today")
- Get upgrade prompts when limit reached
- Clear messaging about Premium benefits

### Premium Users
- No limits shown
- All features unlocked
- Premium badge on profile

## 🔧 Configuration

### Setting Prices

1. Go to Admin → Pricing & Subscriptions
2. Edit plan prices (monthly/yearly)
3. Changes take effect immediately

### Setting Limits

1. Go to Admin → Pricing & Subscriptions
2. Find plan (e.g., "Free")
3. Edit limit values:
   - Enter number for limit
   - Enter "unlimited" or leave empty for no limit
4. Changes apply to new usage periods

### Default Limits

**Free Plan**:
- Daily likes: 10
- Daily super likes: 1
- Rewinds: 0
- Boosts: 0

**Premium Plan**:
- All features: Unlimited

## 📈 Analytics

Admins can see:
- Total dating profiles
- Active profiles
- Total matches
- Total likes
- Subscription conversion rates (future)

## 🚀 Future Enhancements

1. **Subscription Analytics**: Revenue, churn, conversion
2. **A/B Testing**: Test different prices/limits
3. **Promotional Codes**: Discount codes for subscriptions
4. **Tiered Plans**: Multiple premium tiers
5. **Usage Reports**: Detailed usage analytics per user

## 🔐 Security

- **RLS Policies**: All tables protected
- **Admin Only**: Pricing/limits only editable by admins
- **Audit Trail**: All changes logged
- **Service Role**: Usage tracking uses service role

## 📝 Summary

✅ **Full Admin Control**: Manage everything from one dashboard
✅ **Flexible Pricing**: Set any prices you want
✅ **Configurable Limits**: Control free vs premium features
✅ **Real-time Enforcement**: Limits enforced automatically
✅ **User Management**: View and manage dating users
✅ **Analytics**: See dating system statistics

The admin has **complete control** over the dating system, pricing, and user limits!

