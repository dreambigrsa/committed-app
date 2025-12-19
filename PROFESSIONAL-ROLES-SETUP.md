# Professional Roles Setup Guide

## Overview

This guide explains how to set up the initial professional roles for the Committed app's professional system.

## Initial Roles Created

The system comes with 9 pre-configured professional roles:

### Mental Health & Support
1. **Counselor** - Emotional support, guidance, and coping strategies
2. **Relationship Therapist** - Relationship conflict resolution and communication
3. **Psychologist** - Psychological assessment and therapy
4. **Mental Health Professional** - General mental health support

### Personal Development
5. **Life Coach** - Personal growth, goal-setting, and life direction

### Business & Career
6. **Business Mentor** - Business growth, strategy, and professional development

### Mentorship
7. **General Mentor** - Guidance based on experience and expertise

### Legal
8. **Legal Advisor** - General legal guidance and information
9. **Lawyer / Legal Consultant** - Professional legal consultation

## Setup Instructions

### Option 1: SQL Migration (Recommended)

1. **Run the migration in Supabase SQL Editor:**
   - Open your Supabase project
   - Navigate to SQL Editor
   - Execute: `migrations/seed-initial-professional-roles.sql`

2. **Verify roles were created:**
   ```sql
   SELECT name, category, is_active, display_order 
   FROM professional_roles 
   ORDER BY display_order;
   ```

### Option 2: Admin Panel

1. **Access Admin Dashboard:**
   - Log in as Admin or Super Admin
   - Navigate to: Admin Dashboard → Professional System → Professional Roles

2. **Create roles manually:**
   - Click "Create Role" button
   - Fill in role details:
     - Name
     - Category
     - Description
     - Credential requirements
     - Disclaimer text
   - Save the role

## Role Configuration

Each role supports the following settings (all editable by admins):

### Basic Information
- **Name**: Unique role identifier
- **Category**: Grouping for organization
- **Description**: What this professional does

### Requirements
- **Requires Credentials**: Whether professionals must provide credentials
- **Requires Verification**: Whether credentials must be verified by admin
- **Approval Required**: Whether admin must approve professionals

### Features
- **Eligible for Live Chat**: Can join live conversations with users
- **AI Referral Eligible**: Can be matched by AI system

### Safety & Compliance
- **Disclaimer Text**: Role-specific disclaimer shown to users
- **AI Matching Rules**: Keywords and rules for AI matching (JSON)

### Status
- **Active**: Whether role is visible and available
- **Display Order**: Order in which roles appear

## Admin Management

All roles can be:
- ✅ **Edited** - Change any field
- ✅ **Enabled/Disabled** - Toggle visibility
- ✅ **Reordered** - Change display order
- ✅ **Deleted** - Remove (if no active professionals)

## AI Integration

The AI system uses `ai_matching_rules` JSON field to match users to appropriate professionals:

```json
{
  "keywords": ["counseling", "emotional support", "coping"],
  "priority": 1
}
```

- **keywords**: Terms that trigger this role match
- **priority**: Higher priority = matched first (1 = highest)

## Adding New Roles

Admins can add new roles at any time:

1. Go to Admin → Professional Roles
2. Click "Create Role"
3. Configure all settings
4. Save

**No code changes required!** The system is fully dynamic.

## Role Categories

Current categories:
- Mental Health & Support
- Mental Health & Relationships
- Mental Health
- Personal Development
- Business & Career
- Mentorship
- Legal

Admins can use any category name when creating roles.

## Verification

After running the migration, verify:

```sql
-- Check all roles are active
SELECT COUNT(*) as active_roles 
FROM professional_roles 
WHERE is_active = true;
-- Should return 9

-- Check roles are eligible for live chat
SELECT COUNT(*) as live_chat_eligible 
FROM professional_roles 
WHERE eligible_for_live_chat = true;
-- Should return 9

-- View all roles with details
SELECT 
  name,
  category,
  requires_credentials,
  eligible_for_live_chat,
  is_active
FROM professional_roles
ORDER BY display_order;
```

## Troubleshooting

### Roles not appearing
- Check `is_active = true`
- Verify RLS policies allow viewing
- Check user has admin permissions

### Can't create professionals
- Ensure role `approval_required = true` (admin must approve)
- Check role `is_active = true`
- Verify role exists in database

### AI not matching roles
- Check `ai_matching_rules` JSON is valid
- Verify role `is_active = true`
- Check `eligible_for_live_chat = true`

## Next Steps

After roles are created:
1. ✅ Professionals can apply via Settings → Become a Professional
2. ✅ Admins can review applications in Admin → Professional Profiles
3. ✅ AI can match users to professionals
4. ✅ Live chat system can connect users with professionals

---

**Status**: All 9 initial roles configured and ready for use!
