import { getNetworkProfile, isSlowNetwork, loadDataSaverSettings } from './data-saver';

export type AdaptiveImageKind = 'avatar' | 'feed' | 'full';
export type AdaptiveVideoKind = 'feed' | 'full';

export type AdaptiveMediaProfile = {
  preferLowData: boolean;
  quality: number;
  widths: Record<AdaptiveImageKind, number>;
};

export async function getAdaptiveMediaProfile(): Promise<AdaptiveMediaProfile> {
  const [settings, network] = await Promise.all([
    loadDataSaverSettings(),
    getNetworkProfile(),
  ]);

  const preferLowData = settings.enabled || (settings.autoOnCellular && network.isCellular) || isSlowNetwork(network);

  if (preferLowData) {
    return {
      preferLowData: true,
      quality: 45,
      widths: {
        avatar: 96,
        feed: 480,
        full: 720,
      },
    };
  }

  return {
    preferLowData: false,
    quality: 70,
    widths: {
      avatar: 192,
      feed: 960,
      full: 1280,
    },
  };
}

export function getAdaptiveImageUrl(
  url: string | null | undefined,
  profile: AdaptiveMediaProfile,
  kind: AdaptiveImageKind = 'feed'
): string {
  if (!url || !/^https?:\/\//i.test(url)) return url || '';

  // Signed URLs and non-Supabase media are left unchanged for compatibility.
  if (url.includes('/storage/v1/object/sign/')) return url;
  if (!url.includes('/storage/v1/')) return url;

  const width = profile.widths[kind];
  const quality = profile.quality;

  // Supabase public object URL -> render/image URL with transforms.
  const objectPublicPrefix = '/storage/v1/object/public/';
  if (url.includes(objectPublicPrefix)) {
    const [base, hash] = url.split('#');
    const [pathPart] = base.split('?');
    const transformedPath = pathPart.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
    const transformedUrl = `${transformedPath}?width=${width}&quality=${quality}&resize=contain`;
    return hash ? `${transformedUrl}#${hash}` : transformedUrl;
  }

  // Existing render/image URL: preserve path and override transform query.
  if (url.includes('/storage/v1/render/image/public/')) {
    const [base, hash] = url.split('#');
    const [pathPart] = base.split('?');
    const transformedUrl = `${pathPart}?width=${width}&quality=${quality}&resize=contain`;
    return hash ? `${transformedUrl}#${hash}` : transformedUrl;
  }

  return url;
}

export function getAdaptiveVideoUrl(
  url: string | null | undefined,
  profile: AdaptiveMediaProfile,
  kind: AdaptiveVideoKind = 'feed',
  variants?: { hlsUrl?: string | null; sdUrl?: string | null; hdUrl?: string | null }
): string {
  if (!url || !/^https?:\/\//i.test(url)) return url || '';

  // Prefer explicit backend-provided variants when available.
  if (variants?.hlsUrl) return variants.hlsUrl;
  if (profile.preferLowData && variants?.sdUrl) return variants.sdUrl;
  if (!profile.preferLowData && variants?.hdUrl) return variants.hdUrl;

  // Future-ready query-param convention:
  // - ?hls=<url>
  // - ?sd=<url>&hd=<url>
  // Keeps backward compatibility if params are absent.
  try {
    const parsed = new URL(url);
    const hls = parsed.searchParams.get('hls');
    const sd = parsed.searchParams.get('sd');
    const hd = parsed.searchParams.get('hd');
    if (hls) return decodeURIComponent(hls);
    if (profile.preferLowData && sd) return decodeURIComponent(sd);
    if (!profile.preferLowData && hd) return decodeURIComponent(hd);
  } catch {
    // ignore and fallback
  }

  // Non-breaking fallback: keep original URL.
  if (kind === 'full') return url;
  return url;
}
