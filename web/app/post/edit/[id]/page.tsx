import ExpoMirrorRoute from '@/components/ExpoMirrorRoute';

/** In-app mirror: `/post/edit/:id` (same shell as `/app/post/edit/:id`). */
export default function PostEditMirrorPage() {
  return <ExpoMirrorRoute initialTab="feed" />;
}
