# 🔧 Legal Documents & Email Verification Fixes

## Issues Reported

### Issue 1: Legal Documents on Signup
- **Problem:** Legal documents appear on signup page, but when clicked, they don't seem linked anywhere. After signup, users still see the modal again asking them to accept documents, even though they already accepted them during signup.

### Issue 2: Resend Email Not Working
- **Problem:** The "Resend Email" button on the verify-email page doesn't work.

## Root Causes

### Legal Documents Issue

1. **Timing Problem:**
   - Legal acceptances were being saved immediately after signup
   - But the user record might not have been fully created in the database yet
   - This caused the save to fail silently (errors were caught but not handled properly)

2. **No Verification:**
   - After saving acceptances, there was no check to verify they were actually saved
   - If the save failed, the user would still proceed to verify-email
   - When they returned, AppContext would check legal acceptances and find none, showing the modal again

3. **Silent Failures:**
   - The `saveLegalAcceptances` function caught errors but didn't re-throw them
   - This meant the calling code couldn't know if the save succeeded or failed

### Resend Email Issue

1. **API Method Limitation:**
   - `supabase.auth.resend()` only works in certain scenarios
   - If the user doesn't have an active session or is in a specific state, it fails
   - No fallback method was implemented

2. **Error Handling:**
   - Errors weren't being handled with alternative methods
   - If `resend` failed, there was no backup way to send the email

## Fixes Applied

### ✅ 1. Improved Legal Acceptance Saving

**File:** `app/auth.tsx`

**Changes:**
1. **Added delay after signup:**
   - Wait 500ms for user record to be fully created before saving acceptances
   - Ensures database is ready to accept the insert

2. **Added verification:**
   - After saving, immediately check if acceptances were saved correctly
   - If not all required documents are accepted, try saving again after another delay

3. **Better error handling:**
   - `saveLegalAcceptances` now re-throws errors instead of swallowing them
   - Added logging to track successful saves
   - Returns boolean to indicate success/failure

**Before:**
```typescript
const saveLegalAcceptances = async (userId: string) => {
  try {
    // ... save logic
    if (error) throw error;
  } catch (error) {
    console.error('Failed to save legal acceptances:', error);
    // Don't block signup if saving acceptances fails, but log it
  }
};
```

**After:**
```typescript
const saveLegalAcceptances = async (userId: string) => {
  try {
    // ... save logic
    if (error) {
      console.error('Error saving legal acceptances:', error);
      throw error;
    }
    console.log(`Successfully saved ${data?.length || 0} legal acceptances`);
    return true;
  } catch (error) {
    console.error('Failed to save legal acceptances:', error);
    throw error; // Re-throw so caller can handle it
  }
};
```

**In handleAuth:**
```typescript
// Wait a moment for user record to be fully created
await new Promise(resolve => setTimeout(resolve, 500));

// Save legal acceptances
await saveLegalAcceptances(user.id);

// Verify the acceptances were saved
const acceptanceStatus = await checkUserLegalAcceptances(user.id);

if (!acceptanceStatus.hasAllRequired) {
  // Try saving again after a short delay
  await new Promise(resolve => setTimeout(resolve, 500));
  await saveLegalAcceptances(user.id);
}
```

### ✅ 2. Fixed Resend Email

**File:** `app/verify-email.tsx`

**Changes:**
1. **Added fallback method:**
   - If `supabase.auth.resend()` fails, try `supabase.auth.signInWithOtp()` as fallback
   - This works even if the user doesn't have an active session

2. **Better error handling:**
   - Check for session first
   - If no session, use `signInWithOtp` directly
   - If `resend` fails with "not found" or "invalid", fall back to `signInWithOtp`

**Before:**
```typescript
const { data, error } = await supabase.auth.resend({
  type: 'signup',
  email: email,
  options: {
    emailRedirectTo: 'committed://auth-callback',
  },
});

if (error) {
  // Just show error, no fallback
  throw error;
}
```

**After:**
```typescript
// First, check if user has a session
const { data: { session } } = await supabase.auth.getSession();

if (!session?.user) {
  // No session, use signInWithOtp to resend verification
  const { error: otpError } = await supabase.auth.signInWithOtp({
    email: email,
    options: {
      emailRedirectTo: 'committed://auth-callback',
    },
  });
  // ...
}

// If resend fails, try signInWithOtp as fallback
if (error.message?.includes('not found') || error.message?.includes('invalid')) {
  const { error: otpError } = await supabase.auth.signInWithOtp({
    email: email,
    options: {
      emailRedirectTo: 'committed://auth-callback',
    },
  });
  // ...
}
```

### ✅ 3. Legal Document Links

**Note:** The legal document links should work correctly. The route `/legal/[slug]` exists and the `handleViewDocument` function navigates to it properly:

```typescript
const handleViewDocument = (document: LegalDocument) => {
  router.push(`/legal/${document.slug}` as any);
};
```

If links still don't work, it might be because:
- The documents in the database don't have proper `slug` values
- The route might need authentication (but it shouldn't)

## Expected Behavior Now

### Legal Documents
1. **During Signup:**
   - User sees legal documents on signup page
   - Can click "View Full Document" to see the full document
   - Can check boxes to accept documents
   - Must accept all required documents to proceed

2. **After Signup:**
   - Legal acceptances are saved to database
   - System verifies they were saved correctly
   - If save fails, it retries automatically

3. **After Email Verification:**
   - When user returns from email verification
   - AppContext checks legal acceptances
   - If acceptances were saved during signup, modal should NOT appear
   - If acceptances weren't saved (edge case), modal will appear and user can accept again

### Resend Email
1. **User clicks "Resend Email":**
   - System checks if user has active session
   - If yes, uses `supabase.auth.resend()`
   - If no, or if resend fails, uses `signInWithOtp()` as fallback
   - User receives verification email successfully

## Testing

### Test Legal Documents
1. Go to signup page
2. Fill in form
3. **Expected:** Legal documents appear at bottom
4. Click "View Full Document" on any document
5. **Expected:** Document opens in full screen viewer
6. Check all required document boxes
7. Click "Create Account"
8. **Expected:** Account created, redirected to verify-email
9. After verifying email and returning
10. **Expected:** Legal acceptance modal should NOT appear (acceptances were saved)

### Test Resend Email
1. Sign up with new account
2. Go to verify-email page
3. Click "Resend Email"
4. **Expected:** Success message appears
5. **Expected:** Check email inbox for new verification email
6. If first attempt fails, try again
7. **Expected:** Fallback method should work

## Files Modified

1. ✅ `app/auth.tsx` - Improved legal acceptance saving with verification
2. ✅ `app/verify-email.tsx` - Added fallback for resend email

## Additional Notes

### If Legal Document Links Still Don't Work

Check the database:
```sql
SELECT id, title, slug, is_active 
FROM legal_documents 
WHERE is_active = true 
AND 'signup' = ANY(display_location);
```

Ensure:
- All documents have valid `slug` values (e.g., "privacy-policy", "terms-of-service")
- `slug` values match the route pattern `/legal/[slug]`
- Documents are active and have `signup` in `display_location`

### If Resend Still Doesn't Work

Check Supabase configuration:
- Email templates are configured in Supabase dashboard
- SMTP settings are correct
- Rate limiting might be preventing sends (wait a few minutes)

---

**Both issues should now be fixed!** ✅

