# Hero Assets

Placeholder assets for the Premium Dark Hero.

## Optional: Hand holding phone

To use a custom photorealistic image of a hand holding a smartphone:

- Add `hand-phone.png` (recommended: 800×1000px, PNG with transparency if needed)
- Update `stockImages.heroHandPhone` in `lib/stock-images.ts` to use `/hero/hand-phone.png`

The hero currently uses a premium phone mockup with full Committed UI (profile, verified badge, Message/Follow buttons, stats, community thumbnails). A hand-phone composite can be added by overlaying the mockup on a hand image.

## Profile / community images

Profile and community thumbnails in the phone mockup use Unsplash URLs. For custom assets:

- `profile.jpg` – profile portrait (400×500px)
- `community1.jpg`, `community2.jpg`, `community3.jpg` – post thumbnails (200×200px)

Update `ProfileScreenMockup.tsx` to use `/hero/` paths if you add these.
