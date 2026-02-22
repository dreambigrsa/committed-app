/**
 * Stock image URLs (Unsplash). Warm, human, relationship/trust themes.
 * Authentic couple, confident single, community lifestyle.
 */
const base = 'https://images.unsplash.com';

export const stockImages = {
  /* Human presence - warm, natural, authentic */
  couple: `${base}/photo-1522071820081-009f0129c71c?w=800&q=85`,
  single: `${base}/photo-1507003211169-0a1dd7228f2d?w=800&q=85`,
  profilePortrait: `${base}/photo-1507003211169-0a1dd7228f2d?w=400&h=500&fit=crop&q=85`,
  community: `${base}/photo-1529156069898-49953e39b3ac?w=800&q=85`,
  communityThumb1: `${base}/photo-1529333166437-7750a6dd5a70?w=200&h=200&fit=crop`,
  communityThumb2: `${base}/photo-1529636798458-92182e662485?w=200&h=200&fit=crop`,
  communityThumb3: `${base}/photo-1516589178581-6cd7833ae3b2?w=200&h=200&fit=crop`,
  /* Hero - hand holding phone (for dark hero) */
  heroHandPhone: `${base}/photo-1588645715141-2d5ad848c903?w=800&q=90`,
  /* Fallbacks */
  hero: `${base}/photo-1529333166437-7750a6dd5a70?w=1920&q=80`,
  trust: `${base}/photo-1560472354-b33ff0c44a43?w=800&q=80`,
  therapists: `${base}/photo-1573496359142-b8d87734a5a2?w=800&q=80`,
  /* Support section - warm, intimate support moment */
  supportMoment: `${base}/photo-1573496359142-b8d87734a5a2?w=800&h=600&fit=crop&q=90`,
} as const;
