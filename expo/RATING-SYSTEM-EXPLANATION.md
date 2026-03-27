# Professional Session Rating System - Complete Guide

## Overview
The rating system allows users to rate and review professionals after a session ends. Ratings are stored in the `professional_reviews` table and automatically update the professional's average rating once approved by admins.

---

## 🔄 RATING FLOW

### 1. Session Ends
- When a professional session ends (status changes to `ended`), the system checks if the user has already submitted a review
- This happens automatically when:
  - User clicks "End Session" in `SessionManagementModal`
  - Professional ends the session
  - System automatically ends the session (e.g., after inactivity timeout)

### 2. Review Modal Auto-Prompt
**Location:** `app/messages/[conversationId].tsx`

When a session ends, the system:
1. Checks if session status is `ended`
2. Verifies the professional actually joined (`professionalJoinedAt` exists)
3. Checks if a review already exists for this session
4. If no review exists, automatically shows the `SessionReviewModal` after a 2-second delay

```typescript
// Check if session has ended and user hasn't reviewed yet
if (session && session.status === 'ended' && session.professionalId && !hasReview) {
  // Check if review already exists
  const { data: existingReview } = await supabase
    .from('professional_reviews')
    .select('id')
    .eq('session_id', session.id)
    .eq('user_id', currentUser.id)
    .maybeSingle();
  
  if (!existingReview && session.professionalJoinedAt) {
    // Show review modal after a short delay
    setTimeout(() => {
      setShowReviewModal(true);
    }, 2000);
  }
}
```

### 3. Review Modal Display
**Component:** `components/SessionReviewModal.tsx`

The modal allows users to:
- **Rate 1-5 stars** (required)
- **Write a review** (optional, up to 1000 characters)
- **Submit anonymously** (optional toggle)
- **Cancel** or **Submit** the review

**Features:**
- Star rating with hover effects
- Rating text feedback (Excellent, Very Good, Good, Fair, Poor)
- Character counter for review text
- Anonymous submission option
- Validation (rating is required)

### 4. Review Submission
When the user submits a review:

```typescript
await supabase.from('professional_reviews').insert({
  session_id: sessionId,
  professional_id: professionalId,
  user_id: userId,
  rating,                    // 1-5 stars
  review_text: reviewText.trim() || null,
  is_anonymous: isAnonymous,
  moderation_status: 'pending',  // All reviews require admin approval
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});
```

**Important:**
- Reviews are stored with `moderation_status: 'pending'`
- **All reviews require admin approval** before being visible
- One review per session per user (enforced by UNIQUE constraint)

### 5. Admin Moderation
**Location:** `app/admin/professional-reviews.tsx`

Admins can:
- View all pending reviews
- Approve or reject reviews
- Flag reviews for review
- See moderation history

### 6. Automatic Rating Update
**Database Trigger:** `update_professional_rating()`

When a review is approved by an admin, a database trigger automatically:
- Recalculates the professional's `rating_average` (average of all approved ratings)
- Updates `rating_count` (total number of approved ratings)
- Updates `review_count` (total number of approved reviews with text)

```sql
CREATE OR REPLACE FUNCTION update_professional_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.moderation_status = 'approved' AND (OLD.moderation_status != 'approved') THEN
    UPDATE professional_profiles
    SET
      rating_average = (
        SELECT COALESCE(AVG(rating)::DECIMAL(3,2), 0)
        FROM professional_reviews
        WHERE professional_id = NEW.professional_id AND moderation_status = 'approved'
      ),
      rating_count = (
        SELECT COUNT(*)
        FROM professional_reviews
        WHERE professional_id = NEW.professional_id AND moderation_status = 'approved'
      ),
      review_count = (
        SELECT COUNT(*)
        FROM professional_reviews
        WHERE professional_id = NEW.professional_id AND moderation_status = 'approved' AND review_text IS NOT NULL
      )
    WHERE id = NEW.professional_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 📋 DATABASE SCHEMA

### `professional_reviews` Table

```sql
CREATE TABLE professional_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES professional_sessions(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES professional_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  is_anonymous BOOLEAN DEFAULT FALSE,
  moderation_status TEXT NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'flagged')),
  moderated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  moderated_at TIMESTAMPTZ,
  moderation_reason TEXT,
  reported_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, user_id) -- One review per session per user
);
```

### `professional_profiles` Rating Fields

```sql
rating_average DECIMAL(3,2) DEFAULT 0.00 CHECK (rating_average >= 0 AND rating_average <= 5),
rating_count INTEGER DEFAULT 0,
review_count INTEGER DEFAULT 0,
```

---

## 🔍 CURRENT IMPLEMENTATION STATUS

### ✅ What Works:
1. **Auto-prompt modal** appears 2 seconds after session ends
2. **Review submission** saves to database with pending status
3. **Admin moderation** screen exists (`app/admin/professional-reviews.tsx`)
4. **Database trigger** automatically updates ratings when reviews are approved
5. **One review per session** constraint prevents duplicate reviews

### ⚠️ What's Missing:
1. **AI Message Prompt** - Currently, there's NO AI message that prompts the user to rate
   - The modal appears automatically but the AI doesn't send a message like "Please rate your session with [Professional Name]"
   - This could be added to improve user engagement

2. **Reminder System** - No reminders if user dismisses the modal without rating
   - Could add a "Rate Later" button or show the modal again on next chat visit

3. **Professional Notification** - Professionals aren't notified when they receive a review
   - Could add push notifications when reviews are approved

---

## 💡 SUGGESTED IMPROVEMENTS

### 1. Add AI Prompt Message
When a session ends, the AI could send a message like:
```
"Your session with [Professional Name] has ended. We'd love to hear about your experience! Please take a moment to rate your session."
```

**Implementation Location:** `lib/professional-sessions.ts` → `endProfessionalSession()`

### 2. Add "Rate Later" Option
Instead of forcing immediate rating, allow users to:
- Click "Rate Later" to dismiss the modal
- Show a button in the chat to rate later
- Send a reminder after 24 hours

### 3. Professional Dashboard
Show professionals:
- Their average rating
- Recent reviews
- Rating trends over time

---

## 🎯 SUMMARY

**Current Flow:**
1. Session ends → Status changes to `ended`
2. System detects ended session → Checks for existing review
3. No review found → Shows `SessionReviewModal` after 2 seconds
4. User rates and submits → Review saved with `pending` status
5. Admin approves → Database trigger updates professional's rating

**AI Prompt:** ❌ **NOT CURRENTLY IMPLEMENTED**
- The modal appears automatically, but the AI does NOT send a prompt message
- This could be added to improve user engagement and explain why the modal appeared

**Rating Display:** ✅ Professional ratings are shown in:
- Professional profiles
- Booking screens
- Professional matching results

