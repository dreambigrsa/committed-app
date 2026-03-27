import { User, Relationship, RelationshipRequest } from '@/types';

export const mockUsers: User[] = [
  {
    id: '1',
    fullName: 'Sarah Johnson',
    email: 'sarah.j@example.com',
    phoneNumber: '+1234567890',
    profilePicture: 'https://i.pravatar.cc/300?img=1',
    role: 'super_admin' as const,
    verifications: {
      phone: true,
      email: true,
      id: true,
    },
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: '2',
    fullName: 'Michael Chen',
    email: 'michael.c@example.com',
    phoneNumber: '+1234567891',
    profilePicture: 'https://i.pravatar.cc/300?img=12',
    role: 'user' as const,
    verifications: {
      phone: true,
      email: true,
      id: false,
    },
    createdAt: '2024-01-16T10:00:00Z',
  },
  {
    id: '3',
    fullName: 'Emma Williams',
    email: 'emma.w@example.com',
    phoneNumber: '+1234567892',
    profilePicture: 'https://i.pravatar.cc/300?img=5',
    role: 'user' as const,
    verifications: {
      phone: true,
      email: false,
      id: false,
    },
    createdAt: '2024-02-01T10:00:00Z',
  },
  {
    id: '4',
    fullName: 'James Rodriguez',
    email: 'james.r@example.com',
    phoneNumber: '+1234567893',
    profilePicture: 'https://i.pravatar.cc/300?img=15',
    role: 'admin' as const,
    verifications: {
      phone: true,
      email: true,
      id: true,
    },
    createdAt: '2024-02-05T10:00:00Z',
  },
];

export const mockRelationships: Relationship[] = [
  {
    id: 'r1',
    userId: '1',
    partnerName: 'David Johnson',
    partnerPhone: '+1234567894',
    partnerUserId: '5',
    type: 'married',
    status: 'verified',
    startDate: '2020-06-15',
    verifiedDate: '2024-01-20T10:00:00Z',
    privacyLevel: 'public',
  },
  {
    id: 'r2',
    userId: '2',
    partnerName: 'Lisa Chen',
    partnerPhone: '+1234567895',
    type: 'engaged',
    status: 'pending',
    startDate: '2023-12-01',
    privacyLevel: 'public',
  },
  {
    id: 'r3',
    userId: '4',
    partnerName: 'Maria Rodriguez',
    partnerPhone: '+1234567896',
    partnerUserId: '6',
    type: 'serious',
    status: 'verified',
    startDate: '2023-03-20',
    verifiedDate: '2024-02-10T10:00:00Z',
    privacyLevel: 'verified-only',
  },
];

export const mockRelationshipRequests: RelationshipRequest[] = [];
