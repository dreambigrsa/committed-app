# 📋 Legal Documents & Onboarding Flow

## ✅ Legal Documents Modal on Login

**YES, it works!** The legal documents modal **automatically pops up** when a user logs in if they haven't accepted all required documents.

### How It Works:

1. **User Logs In** (`app/auth.tsx` or auto-login via session)
   - AppContext's `loadUserData()` is called
   - Checks legal acceptances: `checkUserLegalAcceptances(user.id)`
   - Sets `legalAcceptanceStatus` in AppContext

2. **LegalAcceptanceEnforcer Component** (`components/LegalAcceptanceEnforcer.tsx`)
   - This component is **always active** (mounted in `app/_layout.tsx` line 56)
   - It watches `legalAcceptanceStatus` from AppContext
   - When `legalAcceptanceStatus` is NOT null AND user doesn't have all required:
     - Shows modal automatically
     - Modal blocks access until documents are accepted

3. **Modal Shows:**
   - Missing documents (never accepted)
   - Needs re-acceptance (document version changed)
   - User can view documents by clicking on them
   - User must accept all required documents to proceed

4. **After Accepting:**
   - Modal closes
   - Checks if onboarding is needed
   - Redirects to onboarding if not completed yet
   - Otherwise, user can continue

### Code Location:
- **Enforcer:** `components/LegalAcceptanceEnforcer.tsx`
- **Check on login:** `contexts/AppContext.tsx` line 207
- **Mounted in:** `app/_layout.tsx` line 56

---

## ✅ AI Consent Modal / Onboarding

**YES, it works!** The onboarding screen explains Committed AI and requires user consent.

### How It Works:

1. **User Completes Signup → Email Verification → Legal Documents**
   - After accepting legal documents, user is redirected to `/onboarding`

2. **Onboarding Screen** (`app/onboarding.tsx`)
   - **Step 1:** Welcome to Committed
   - **Step 2:** How Committed AI Works (what it can/cannot do)
   - **Step 3:** AI vs Human Professionals (explains both)
   - **Step 4:** Location (optional)
   - **Step 5:** **Consent & Agreement** ⭐ (REQUIRED)

3. **Consent Step (Step 5):**
   - Shows text: *"I understand that Committed AI provides support but may connect me with human professionals when appropriate. I consent to this service."*
   - User **must check** the checkbox: "I understand and consent"
   - `consentGiven` state must be `true` to proceed
   - If user tries to complete without consent, shows alert: "Consent Required"

4. **On Completion:**
   - Saves to `user_onboarding_data` table:
     - `has_completed_onboarding: true`
     - `ai_explanation_viewed: true`
     - `consent_given: true`
     - `consent_given_at: timestamp`
   - Redirects to home

### Code Location:
- **Onboarding:** `app/onboarding.tsx`
- **Consent check:** Line 180-183
- **Saves consent:** Line 200-202

---

## 🔄 Complete Flow

```
User Signs Up
    ↓
Email Verification
    ↓
Login / Session Restored
    ↓
AppContext.loadUserData()
    ↓
checkUserLegalAcceptances() → Sets legalAcceptanceStatus
    ↓
LegalAcceptanceEnforcer checks status
    ↓
Has all required documents? 
    ↓ NO → Shows modal (blocks access)
    ↓ YES → Continue
    ↓
Check onboarding status
    ↓
Has completed onboarding?
    ↓ NO → Redirect to /onboarding
    ↓ YES → Continue to home
    ↓
Onboarding Screen:
  - Step 1: Welcome
  - Step 2: AI Explanation
  - Step 3: AI vs Professionals
  - Step 4: Location (optional)
  - Step 5: AI Consent (REQUIRED) ⭐
    ↓
User checks "I understand and consent"
    ↓
handleComplete() → Saves consent
    ↓
Redirect to home
```

---

## ✅ Key Points

1. **Legal Documents Modal:**
   - ✅ Shows automatically on login if documents not accepted
   - ✅ Blocks access until accepted
   - ✅ Can view documents by clicking
   - ✅ Checks every login

2. **AI Consent:**
   - ✅ Explained in onboarding steps
   - ✅ User must explicitly consent
   - ✅ Cannot proceed without consent
   - ✅ Consent is saved to database

3. **Both are Enforced:**
   - Legal documents are checked every login
   - Onboarding (with AI consent) is required once
   - Both must be completed before user can use app

---

## 📝 Database Records

### Legal Acceptances:
- Table: `user_legal_acceptances`
- Records: `user_id`, `document_id`, `document_version`, `context`

### Onboarding Consent:
- Table: `user_onboarding_data`
- Records: `user_id`, `has_completed_onboarding`, `consent_given`, `ai_explanation_viewed`

Both are checked on login and required for access! ✅

