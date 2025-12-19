# Professional Roles Setup Guide

## Overview

This guide explains how to set up the initial professional roles for the Committed app's Professional Join & Escalation System.

## Initial Professional Roles

The system includes 9 initial professional roles covering Mental Health, Personal Development, Business, and Legal categories. All roles are:

- ✅ **Admin-managed**: Can be edited, enabled/disabled, and extended via Admin Panel
- ✅ **Live Chat Eligible**: Can join real-time conversations with users
- ✅ **AI Referral Eligible**: Can be matched by AI based on user needs
- ✅ **Review Enabled**: Support ratings and reviews from users
- ✅ **Configurable**: Admins can modify requirements, disclaimers, and settings

## Setup Instructions

### Step 1: Run Database Schema (if not already done)

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Run `migrations/professional-system-schema.sql`
4. Verify all tables were created successfully

### Step 2: Seed Initial Professional Roles

1. In Supabase SQL Editor, create a new query
2. Copy and paste the entire contents of `migrations/seed-professional-roles.sql`
3. Click "Run" or press Ctrl/Cmd + Enter
4. You should see a success message and a query result showing 9 roles

### Step 3: Verify Roles Were Created

Run this query to verify:

```sql
SELECT 
  name,
  category,
  is_active,
  eligible_for_live_chat,
  requires_credentials,
  display_order
FROM professional_roles
ORDER BY display_order;
```

Expected output: 9 rows with all roles active and properly configured.

## Role Details

### 1. Counselor
- **Category**: Mental Health & Support
- **Credentials Required**: Yes
- **Description**: Provides emotional support, guidance, and coping strategies
- **Disclaimer**: "This professional provides counseling support but does not replace medical or psychiatric treatment."

### 2. Relationship Therapist
- **Category**: Mental Health & Relationships
- **Credentials Required**: Yes
- **Description**: Helps individuals or couples resolve relationship conflicts and improve communication
- **Disclaimer**: "Relationship therapy is not a substitute for emergency or psychiatric care."

### 3. Psychologist
- **Category**: Mental Health
- **Credentials Required**: Yes
- **Description**: Provides psychological assessment and therapy within professional scope
- **Disclaimer**: "This service does not include diagnosis or prescription of medication."

### 4. Mental Health Professional
- **Category**: Mental Health
- **Credentials Required**: Yes
- **Description**: Provides general mental health support and guidance
- **Disclaimer**: "For emergencies, contact local emergency services."

### 5. Life Coach
- **Category**: Personal Development
- **Credentials Required**: Optional (No)
- **Description**: Supports personal growth, goal-setting, and life direction
- **Disclaimer**: "Life coaching is not therapy or medical treatment."

### 6. Business Mentor
- **Category**: Business & Career
- **Credentials Required**: Optional (No)
- **Description**: Advises on business growth, strategy, and professional development
- **Disclaimer**: "Business advice is for guidance only and not legally binding."

### 7. General Mentor
- **Category**: Mentorship
- **Credentials Required**: Optional (No)
- **Description**: Provides guidance based on experience and expertise
- **Disclaimer**: "Mentorship is advisory and does not replace professional services."

### 8. Legal Advisor
- **Category**: Legal
- **Credentials Required**: Yes
- **Description**: Provides general legal guidance and information
- **Disclaimer**: "Legal advice provided is general information and not a substitute for licensed legal representation."

### 9. Lawyer / Legal Consultant
- **Category**: Legal
- **Credentials Required**: Yes
- **Description**: Provides professional legal consultation within licensed jurisdictions
- **Disclaimer**: "This does not establish an attorney-client relationship."

## Managing Roles (Admin Panel)

After seeding the initial roles, Admins can:

1. **View All Roles**: Admin Dashboard → Professional System → Professional Roles
2. **Edit Role Details**: Click "Edit" on any role to modify:
   - Name and category
   - Description
   - Disclaimer text
   - Credential requirements
   - Live chat eligibility
   - Approval requirements
   - Display order
3. **Enable/Disable Roles**: Toggle the "Active" status
4. **Create New Roles**: Click the "+" button to add custom roles
5. **Delete Roles**: Remove roles that are no longer needed

## Integration Points

Once roles are created, they integrate with:

### Professional Onboarding
- Users can apply to become professionals via Settings → Become a Professional
- They select from available active roles
- Credentials are required if `requires_credentials = true`
- Applications are reviewed by Admins

### AI Referral System
- AI can match users to professionals based on role eligibility
- Only roles with `eligible_for_live_chat = true` are considered
- Only `is_active = true` roles are available for matching
- AI uses `ai_matching_rules` (JSONB) for advanced matching logic

### Live Chat System
- Professionals with approved profiles can join live sessions
- Roles must have `eligible_for_live_chat = true`
- Role-specific disclaimers are shown to users before escalation

### Review System
- Users can rate and review professionals after sessions
- Reviews are moderated by Admins
- Rating averages are calculated automatically

## Default Settings

All initial roles are configured with:
- `is_active = true` (enabled by default)
- `eligible_for_live_chat = true` (can join live sessions)
- `approval_required = true` (admin must approve professionals)
- `requires_verification = true` (if credentials are required)
- `display_order` set sequentially (1-9)

## Customization

### Adding Custom Roles

Use the Admin Panel to add new roles:
1. Navigate to Admin → Professional Roles
2. Click the "+" button
3. Fill in role details
4. Configure requirements
5. Save

### Modifying Existing Roles

1. Navigate to Admin → Professional Roles
2. Click "Edit" on the role
3. Modify any fields
4. Save changes

### AI Matching Rules

The `ai_matching_rules` JSONB field allows admins to configure advanced matching logic:

```json
{
  "keywords": ["anxiety", "stress", "depression"],
  "priority": 1,
  "location_required": false,
  "min_rating": 4.0
}
```

Currently set to `{}` for all initial roles, but can be extended via Admin Panel.

## Troubleshooting

### Roles Not Showing Up

1. Check if `is_active = true` in the database
2. Verify the seed script ran successfully
3. Check Admin Panel permissions (must be admin/super_admin)

### Role Not Available in Onboarding

1. Verify `is_active = true`
2. Check `eligible_for_live_chat = true`
3. Ensure role exists in database

### Professional Application Not Processing

1. Verify `approval_required` setting
2. Check Admin has proper permissions
3. Review application in Admin → Professional Profiles

## Next Steps

After setting up roles:

1. ✅ Test professional onboarding flow
2. ✅ Review role settings in Admin Panel
3. ✅ Customize disclaimers if needed
4. ✅ Configure AI matching rules (if needed)
5. ✅ Begin accepting professional applications

---

**Note**: All roles are designed to be admin-managed. No code changes are required to add, edit, or remove roles after initial setup.

