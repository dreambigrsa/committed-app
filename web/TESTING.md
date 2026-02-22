# Committed Website – Testing Checklist

## Visual & Design

- [ ] **Homepage hero** – Full-width hero image, headline gradient, phone mockup visible, CTAs and trust badges
- [ ] **Problem → Solution** – Split layout with stock images, readable copy
- [ ] **Features section** – 6 feature cards with icons, dashboard mockup below
- [ ] **Use cases** – 4 tiles with images and overlay text, hover effects
- [ ] **How it works** – 3 steps with images and step numbers
- [ ] **Testimonials** – Dark overlay background, 3 quote cards
- [ ] **FAQ** – Accordion-style list, readable
- [ ] **Final CTA** – Full-width image background, primary and secondary buttons

## Branding

- [ ] **Logo** – Navbar shows committed-logo.svg
- [ ] **Footer** – Wordmark and correct tagline
- [ ] **Favicon** – Browser tab shows committed-icon.svg (or fallback)

## Responsive

- [ ] **Mobile (< 640px)** – Hero stacks, features in 1 col, use cases in 1–2 cols, nav collapses to hamburger
- [ ] **Tablet (640–1024px)** – Reasonable 2-col layouts, readable text
- [ ] **Desktop (1024px+)** – Full layout, no overflow, good spacing

## Animations

- [ ] **Scroll reveal** – Sections fade/slide in as they enter viewport
- [ ] **Stagger** – Feature and use case cards stagger in
- [ ] **Card hover** – Feature cards lift on hover
- [ ] **prefers-reduced-motion** – With “Reduce motion” enabled in OS, animations are minimal/disabled

## Accessibility

- [ ] **Color contrast** – Text meets WCAG AA (slate-900 on white, white on dark)
- [ ] **Keyboard nav** – Tab through nav, links, buttons; focus rings visible
- [ ] **Aria** – Nav has aria-label; buttons have meaningful labels

## Routes & Functionality

- [ ] `/` – Homepage loads, all sections render
- [ ] `/download` – Open App, store links, QR code, troubleshooting
- [ ] `/sign-in` – Open App CTA, link to download
- [ ] `/sign-up` – Open App CTA, link to sign-in
- [ ] `/verify-email?token=...` – Loading → success/error; Open App on success (unchanged behavior)
- [ ] `/reset-password?token=...` – Form → success/error; Open App on success (unchanged behavior)
- [ ] `/open?target=...` – Attempts deep link, then fallback (unchanged behavior)
- [ ] `/terms` – Terms content, back link
- [ ] `/privacy` – Privacy content, back link

## Performance

- [ ] **Images** – next/image used; Unsplash images load with appropriate sizes
- [ ] **LCP** – Hero image and headline load quickly
- [ ] **CLS** – No layout shift when images load (sizes specified)

## Browser

- [ ] Chrome/Edge (latest)
- [ ] Safari (latest)
- [ ] Firefox (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome (Android)
