/**
 * Stock image URLs (Unsplash). Warm, human, relationship/trust themes.
 * Authentic couple, confident single, community lifestyle.
 */
const base = 'https://images.unsplash.com';

export const stockImages = {
  /* Human presence - warm, natural, authentic */
  couple: 'https://m.media-amazon.com/images/I/810WNfR-VbL._AC_SL1500_.jpg',
  single: `${base}/photo-1507003211169-0a1dd7228f2d?w=800&q=85`,
  profilePortrait: `${base}/photo-1507003211169-0a1dd7228f2d?w=400&h=500&fit=crop&q=85`,
  community: `${base}/photo-1529156069898-49953e39b3ac?w=800&q=85`,
  communityThumb1: `${base}/photo-1529333166437-7750a6dd5a70?w=200&h=200&fit=crop`,
  communityThumb2: `${base}/photo-1529636798458-92182e662485?w=200&h=200&fit=crop`,
  communityThumb3: `${base}/photo-1516589178581-6cd7833ae3b2?w=200&h=200&fit=crop`,
  /* Connect Safely section — replace with your own: /images/connect-safely/1.jpg etc. */
  connectSafelyAvatars: [
    process.env.NEXT_PUBLIC_CONNECT_SAFELY_1 || `${base}/photo-1529333166437-7750a6dd5a70?w=120&h=120&fit=crop`,
    process.env.NEXT_PUBLIC_CONNECT_SAFELY_2 || `${base}/photo-1529636798458-92182e662485?w=120&h=120&fit=crop`,
    process.env.NEXT_PUBLIC_CONNECT_SAFELY_3 || `${base}/photo-1516589178581-6cd7833ae3b2?w=120&h=120&fit=crop`,
  ] as const,
  /* Fallbacks */
  hero: `${base}/photo-1529333166437-7750a6dd5a70?w=1920&q=80`,
  trust: `${base}/photo-1560472354-b33ff0c44a43?w=800&q=80`,
  therapists: `${base}/photo-1573496359142-b8d87734a5a2?w=800&q=80`,
  /* Support section - warm, intimate support moment */
  supportMoment: `${base}/photo-1573496359142-b8d87734a5a2?w=800&h=600&fit=crop&q=90`,
} as const;
