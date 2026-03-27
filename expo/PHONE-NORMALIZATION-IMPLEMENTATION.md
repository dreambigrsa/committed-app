# Phone Number Normalization Implementation

## Overview
This implementation ensures all phone numbers are stored and compared in a consistent format, preventing duplicate relationships caused by formatting differences (e.g., "+1-234-567-8900" vs "1234567890" vs "(234) 567-8900").

## Format
All phone numbers are normalized to: **+[country code][number]**
- Example: `+11234567890` (US number)
- Example: `+441234567890` (UK number)

## Implementation Details

### 1. Utility Function (`lib/phone-normalization.ts`)
Created a comprehensive phone normalization utility with the following functions:

- **`normalizePhoneNumber(phoneNumber, defaultCountryCode)`**: Normalizes a phone number to the standard format
- **`comparePhoneNumbers(phone1, phone2)`**: Compares two phone numbers after normalization
- **`formatPhoneNumberForDisplay(phoneNumber, format)`**: Formats normalized numbers for display (international, national, local)
- **`extractCountryCode(phoneNumber)`**: Extracts country code from a normalized number

### 2. Application Integration (`contexts/AppContext.tsx`)

#### User Signup
- Phone numbers are normalized before storing in the database
- Normalized phone is used when checking and linking relationships

#### Relationship Creation
- Partner phone numbers are normalized before storing
- Phone number matching uses normalized comparison to prevent false mismatches
- Searches check both normalized and original formats to catch existing records

#### Relationship Linking
- When a new user signs up, their phone number is normalized before searching for existing relationships
- Searches check both normalized and original formats to ensure all relationships are found

#### User Profile Updates
- Phone numbers are normalized when updating user profiles

#### User Search
- Search queries are normalized if they look like phone numbers
- Searches check both normalized and original formats to find all matches
- Deduplication uses normalized phone numbers for accurate matching

### 3. Database Migration (`migrations/normalize-phone-numbers.sql`)

A SQL migration script that:
- Creates a `normalize_phone_number()` PostgreSQL function
- Normalizes all existing phone numbers in the `users` table
- Normalizes all existing `partner_phone` values in the `relationships` table
- Creates indexes for performance
- Includes verification queries to check normalization results

**Important**: Review the normalized values before running in production!

## Benefits

1. **Prevents Duplicate Relationships**: Users can't accidentally create duplicate relationships due to phone number formatting differences
2. **Improved Search Accuracy**: Phone number searches work regardless of how the number was entered
3. **Better Auto-linking**: When a new user signs up, their relationships are more reliably linked
4. **Consistent Data**: All phone numbers in the database follow the same format

## Usage

### In Code
```typescript
import { normalizePhoneNumber, comparePhoneNumbers } from '@/lib/phone-normalization';

// Normalize a phone number
const normalized = normalizePhoneNumber('(234) 567-8900'); // Returns: '+12345678900'

// Compare two phone numbers
const match = comparePhoneNumbers('+1-234-567-8900', '12345678900'); // Returns: true
```

### Database Migration
1. Open Supabase SQL Editor
2. Run `migrations/normalize-phone-numbers.sql`
3. Review the verification queries to ensure normalization worked correctly
4. (Optional) Remove backup columns and helper function after verification

## Testing Recommendations

1. **Test various phone number formats**:
   - `+1-234-567-8900`
   - `(234) 567-8900`
   - `234-567-8900`
   - `12345678900`
   - `+1 234 567 8900`

2. **Test relationship registration** with different phone formats to ensure they're treated as the same number

3. **Test user signup** with a phone number that matches an existing relationship's `partner_phone` to verify auto-linking works

4. **Test search** with various phone number formats to ensure all matches are found

## Notes

- Default country code is `'1'` (US/Canada) but can be customized
- Phone numbers must be 10-15 digits (E.164 standard)
- Invalid phone numbers return `null` and are rejected
- The migration includes backup columns (commented out) for safety - uncomment if you want to keep backups

