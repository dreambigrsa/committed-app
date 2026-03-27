# Professional Booking System - Complete Guide

## Overview
The booking system allows users to schedule offline/in-person sessions with professionals. Bookings are managed through the `professional_sessions` table with `session_type` of `offline_booking` or `scheduled`.

---

## 🔵 HOW USERS BOOK A SESSION

### Current Status: ⚠️ **MISSING UI FOR CREATING BOOKINGS**

The backend functionality exists (`createProfessionalBooking` function in `lib/professional-bookings.ts`), but **there is currently NO UI screen for users to create bookings**. 

**To create a booking, users would need to:**
1. Have a conversation with a professional (via chat)
2. Use the `createProfessionalBooking` function programmatically (not user-facing)

**What needs to be built:**
- A booking creation screen (`app/bookings/create.tsx`) where users can:
  - Select a professional (from their existing conversations or search)
  - Choose date/time
  - Select location type (online, in-person, phone, video)
  - Enter address/notes for in-person sessions
  - See pricing information
  - Confirm and create the booking

---

## 👤 HOW USERS VIEW THEIR BOOKINGS

### Access Point:
- **Currently missing from regular user profile** ⚠️
- Only professionals see "My Bookings" in their profile menu

### What Exists:
- **Screen:** `app/bookings/index.tsx`
- **Route:** `/bookings/index`
- **Features:**
  - View all bookings (filter: upcoming, past, all)
  - See booking details:
    - Professional name and role
    - Date and time
    - Duration
    - Location type and address
    - Pricing/fee
    - Status (scheduled, confirmed, cancelled, completed)
  - **Actions available:**
    - ✅ **Message** - Opens chat with professional
    - ✅ **Reschedule** - Change date/time
    - ✅ **Cancel** - Cancel the booking

### What's Missing:
- ❌ Link to "My Bookings" in regular user profile menu
- ❌ Button/link needs to be added to `app/(tabs)/profile.tsx` for non-professional users

---

## 💼 HOW PROFESSIONALS VIEW THEIR BOOKINGS

### Access Point:
- ✅ **Profile Menu** → "My Bookings"
- **Route:** `/professional/bookings`

### Screen: `app/professional/bookings.tsx`

### Features:
- View all bookings assigned to them
- Filter by: upcoming, past, all
- See booking details:
  - User name and profile picture
  - Date and time
  - Duration
  - Location type and address
  - Pricing/fee
  - Status

### Actions Available:
- ✅ **Message** - Opens chat with user
- ✅ **Confirm** - Confirm a scheduled booking (changes status to 'confirmed')
- ✅ **Complete** - Mark booking as completed
- ✅ **Reschedule** - Change date/time
- ✅ **Cancel** - Cancel the booking

---

## 👨‍💼 HOW ADMINS MANAGE BOOKINGS

### Access Point:
- ✅ **Admin Dashboard** → "Professional Sessions"
- **Route:** `/admin/professional-sessions`

### Screen: `app/admin/professional-sessions.tsx`

### Features:
- View ALL professional sessions (including bookings and live chats)
- Filter by status: all, pending_acceptance, active, ended, declined
- Real-time updates via Supabase subscriptions
- See session details:
  - User and professional names
  - Session type (live_chat, offline_booking, scheduled, escalated)
  - Status
  - Creation date/time
  - AI summary (if available)

### What Admins Can See:
- All session types mixed together (bookings appear alongside live chats)
- Session status and metadata
- User and professional information

### What's Missing for Better Booking Management:
- ❌ Separate filter/view for bookings only (`session_type = 'offline_booking'`)
- ❌ Booking-specific details (scheduled date, location, pricing)
- ❌ Ability to edit/cancel bookings directly
- ❌ Booking analytics (revenue, popular times, cancellation rates)

---

## 📋 BOOKING LIFECYCLE & STATUSES

### Booking Statuses:
1. **scheduled** - Initial booking created, waiting for professional confirmation
2. **confirmed** - Professional has confirmed the booking
3. **completed** - Session has been completed
4. **cancelled** - Booking was cancelled
5. **no_show** - User/professional didn't show up (future)

### Booking Flow:
```
User creates booking → scheduled
     ↓
Professional confirms → confirmed
     ↓
Session happens → completed
     OR
Booking cancelled → cancelled
```

---

## 🛠️ TECHNICAL IMPLEMENTATION

### Database Table: `professional_sessions`
- Fields include: `scheduled_date`, `scheduled_duration_minutes`, `location_type`, `location_address`, `booking_fee_amount`, `payment_status`, etc.

### Key Functions:
- `createProfessionalBooking()` - Creates a new booking
- `getUserBookings()` - Gets all bookings for a user
- `getProfessionalBookings()` - Gets all bookings for a professional
- `rescheduleBooking()` - Changes booking date/time
- `cancelBooking()` - Cancels a booking
- `confirmBooking()` - Professional confirms booking
- `completeBooking()` - Marks booking as completed

### Professional Pricing:
- Professionals can set their fees in **Settings → Professional Availability**
- Pricing stored in `professional_profiles.pricing_info` (JSON)
- Includes: `rate`, `currency`, `unit` (session/hour/minute)

---

## ⚠️ WHAT NEEDS TO BE ADDED

### 1. **Booking Creation UI** (High Priority)
- Create `app/bookings/create.tsx`
- Allow users to:
  - Select professional (from conversations or search)
  - Pick date/time
  - Choose location type
  - Enter address/notes
  - See pricing
  - Confirm booking

### 2. **User Bookings Link** (High Priority)
- Add "My Bookings" link to regular user profile menu in `app/(tabs)/profile.tsx`
- Should navigate to `/bookings/index`

### 3. **Admin Booking Management** (Medium Priority)
- Filter bookings separately from live chats
- Show booking-specific details (date, location, pricing)
- Add booking analytics
- Allow admins to manage bookings directly

### 4. **Payment Integration** (Future)
- Currently `payment_status` field exists but no payment processing
- Would need integration with Stripe/PayPal/etc.

---

## 📱 USER JOURNEY (Current vs Ideal)

### Current Journey:
1. ❌ User cannot create bookings (no UI)
2. ❌ User cannot easily access their bookings (no link in profile)
3. ✅ User can manage bookings IF they navigate directly to `/bookings/index`

### Ideal Journey:
1. ✅ User chats with professional or browses professionals
2. ✅ User clicks "Book Session" button
3. ✅ User fills booking form (date, time, location, etc.)
4. ✅ Booking created, professional notified
5. ✅ User sees booking in "My Bookings" from profile
6. ✅ Professional confirms booking
7. ✅ Session happens, booking marked complete

---

## 🎯 SUMMARY

**What Works:**
- ✅ Backend booking functions (create, view, reschedule, cancel)
- ✅ Professional booking management screen
- ✅ User booking viewing screen (but not easily accessible)
- ✅ Admin session viewing (but not booking-specific)

**What's Missing:**
- ❌ UI for users to CREATE bookings
- ❌ "My Bookings" link for regular users in profile
- ❌ Admin booking-specific management
- ❌ Payment processing integration

