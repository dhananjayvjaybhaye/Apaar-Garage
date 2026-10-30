# AGENTS.md: Apaar Garage (MEAN + Angular 22)

## Project
E-commerce web application selling three categories:
1. **Toys** (kids and families)
2. **RC cars and trucks**
3. **Officially licensed diecast** cars, trucks and bikes (collectors)

Audience: kids/parents and adult collectors. The app must feel **premium** yet **lovable for all ages**, with rich, tasteful animation that drives engagement, and must work flawlessly on every screen size.

Official references (consult before guessing): https://angular.dev, https://angular.dev/style-guide, and the machine-readable docs at https://angular.dev/llms-full.txt

---

## Current phase: personal build and demo (no real products yet)
The owner is building and hosting this privately for now. There is no inventory and no real selling. Build the full store experience, but run it in **demo mode**:
- Use an environment flag `APP_MODE=demo|live` (default `demo`). Everything below is enforced when `demo`; the "India compliance" rules become blocking only when `live`.
- **Seed data only:** create a seed script with fictional placeholder products (made-up brand and model names such as "Turbo Racer GT", never real brands or real licensed product names), placeholder prices, and stock photos from the allowed sources. Cover all three categories so every screen and state can be tested.
- **Razorpay Test Mode keys only.** No live keys in demo. Show a visible "Demo store: no real orders or payments" banner and use test card/UPI details.
- No real emails or SMS: log them to the console or use a local mail catcher.
- Add `noindex` (meta tag and `robots.txt`) while in demo so the site is not indexed. Protect the hosted demo (basic auth or login allowlist) if it is public.
- Structure everything so switching to `live` later only needs real products, live keys, and the compliance items completed, not code rewrites.
- Build an **admin area** early (protected by role) to add, edit and publish products, since the owner will add real products later.

## Brand identity: Apaar Garage
- Store/brand name: **Apaar Garage** ("apaar" means boundless or limitless). Use this name in the header, title tags, footer, emails and legal pages. Keep it in one config constant (`BRAND_NAME`) so it is easy to change.
- Category labels inside the store can still use the two moods: **Collector's Garage** (diecast) and **Play Zone** (toys, RC).
- **Logo: not provided yet. Codex designs it.** Create an original logo for "Apaar Garage" that fits the design concept and tokens in this file (red, asphalt, yellow, chrome; Barlow Condensed for the wordmark). Requirements:
  - Premium and simple, readable at small sizes, and appealing to both kids/parents and adult collectors.
  - Must not imitate or resemble any existing toy or car brand mark (Hot Wheels, Matchbox, Maisto, Bburago, and so on) or any manufacturer's logo.
  - Deliver as clean SVG: full logo for light backgrounds, full logo for dark backgrounds, a square icon version, and a favicon. Convert any text to outlines in the final SVGs.
  - Present 2-3 concept options to the owner in a simple preview page before choosing one. Wait for the owner's pick.
  - Place the chosen files in `client/public/brand/` and record the decision in `docs/brand-decisions.md`.
- Until a logo is approved, use a plain text wordmark "Apaar Garage" in Barlow Condensed ExtraBold as a temporary placeholder in the header and favicon.
- Once approved, wire it into the header (full logo on desktop, icon on small screens), footer, favicon, web app manifest icons, and the Open Graph/social preview image. Do not stretch, restyle or recolor the approved logo.
- The progress-car loader should echo the logo's visual style once the logo exists.

## Stack (MEAN)
- **MongoDB** (Mongoose) / **Express** / **Angular 22** / **Node.js**
- TypeScript everywhere. Angular 22 requires TypeScript 6 and a supported Node version (Node 22 or newer). Check `ng version` and the Angular update guide before installing anything.
- Angular 22 conventions: standalone components (no NgModules), signal-based state, Signal Forms for forms, `resource`/`httpResource` for async data, OnPush change detection, built-in control flow (`@if`, `@for`, `@switch`), `inject()` for DI, lazy-loaded routes.
- Enable **SSR + hydration** for public pages (home, catalog, product detail) for SEO and fast first paint.
- Use the Angular CLI (`ng new`, `ng generate`) defaults for generated file names and structure. Do not hand-roll structure the CLI already provides.

## Repository layout
```
/
├─ client/                 # Angular workspace (UI code lives in client/src)
│  ├─ src/
│  │  ├─ main.ts           # bootstrap, directly inside src
│  │  ├─ index.html
│  │  ├─ styles/           # tokens, theme, global styles
│  │  └─ app/
│  │     ├─ app.ts / app.html / app.scss
│  │     ├─ app.config.ts
│  │     ├─ app.routes.ts
│  │     ├─ core/          # app-wide singletons: auth, http interceptors, guards, config, error handling
│  │     ├─ shared/        # reusable UI + utilities: buttons, toast, loaders (progress-car), pipes, directives
│  │     └─ features/      # one folder per feature, lazy-loaded
│  │        ├─ home/  catalog/  product-detail/  cart/  checkout/
│  │        ├─ orders/  account/  auth/  wishlist/  garage/
│  └─ public/              # static assets
├─ server/                 # Express API
│  └─ src/
│     ├─ main.ts, app.ts
│     ├─ config/           # env validation
│     ├─ db/               # mongoose connection
│     ├─ middleware/       # auth, rate-limit, error handler, validation
│     └─ modules/          # auth, users, products, cart, orders, payments, webhooks
└─ docs/                   # asset-credits.md, decisions, API notes
```

### Angular structure rules (from the official style guide)
- All UI code goes in `src`. Config and scripts live outside `src`.
- Bootstrap in `main.ts` directly inside `src`.
- Organize by **feature**, not by file type. Group a component's TS, template and styles in one folder with the same base file name.
- One concept per file (one component, directive or service per file).
- Separate words in file names with hyphens. Avoid generic names like `helpers.ts`, `utils.ts`, `common.ts`.
- Use an app-specific selector prefix for components and directives.
- Prefer native `class`/`style` bindings over `NgClass`/`NgStyle`.
- When in doubt, prefer consistency within the file.
- Folders `core/`, `shared/`, `features/` are the common convention for applying this guide. Keep folder depth shallow.

---

## Authentication: Google login
- Use **Google Identity Services** ("Sign in with Google") on the client.
- The client sends the Google **ID token** to the API. The server **verifies it** (`google-auth-library`: signature, audience = our client ID, issuer, expiry) and then creates or finds the user.
- The server issues its own session: short-lived access token plus rotating refresh token, stored in **httpOnly, Secure, SameSite cookies**. Never keep tokens in `localStorage`.
- CSRF protection for cookie-based auth. Logout clears cookies and revokes the refresh token.
- Support **guest checkout** (no login required to buy) so login is never a conversion blocker. Optional email/password can be added later behind the same auth module.
- Handle every auth state in the UI: signed out, signing in, error (popup blocked, cancelled, network), expired session, account link.

## Payments: Razorpay (India, INR only for now)
- Gateway: **Razorpay Standard Checkout** (UPI, cards, netbanking, wallets handled by Razorpay's hosted checkout). Keep it behind a `PaymentProvider` interface on the server so another gateway (Cashfree, PayU) can be added later.
- Currency: `INR` only. Store and transmit amounts as integers in **paise**. Display in rupees with Indian number formatting (`en-IN`).
- **Never handle raw card data.** Load `https://checkout.razorpay.com/v1/checkout.js` from Razorpay's CDN only (never self-host it) and use the hosted checkout, which keeps PCI scope minimal.
- Server SDK: the official `razorpay` npm package. Keys (`KEY_ID`, `KEY_SECRET`, `WEBHOOK_SECRET`) only in environment variables; only `KEY_ID` is ever sent to the browser. Provide `.env.example`. Develop in Test Mode; Live Mode needs HTTPS and a completed KYC.
- Flow:
  1. Client calls `POST /api/v1/payments/orders` with the cart id.
  2. Server recomputes the total from **server-side prices** (never trust client totals), creates an internal order, then creates a Razorpay Order via the Orders API and returns `order_id` plus the public key.
  3. Client opens Checkout with that `order_id`.
  4. On success the client sends `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature` to `POST /api/v1/payments/verify`; server verifies the HMAC-SHA256 signature with the key secret.
  5. **Webhooks are the source of truth** for final status (`payment.captured`, `payment.failed`, `refund.processed`, and others as needed).
- Webhooks: use `express.raw()` on the webhook route and verify the `x-razorpay-signature` against the **raw body** (never a re-serialized `JSON.stringify` of the parsed body). Use constant-time comparison. Make handlers **idempotent** (dedupe on event id / payment id), return 200 quickly, and process the rest asynchronously.
- Order state machine: `created -> pending_payment -> paid -> processing -> shipped -> delivered`, plus `payment_failed`, `cancelled`, `refunded`, `partially_refunded`. Reconcile stuck `pending_payment` orders with a scheduled job that checks Razorpay.
- UI must cover: payment pending, success, failure with retry, user closed the modal, abandoned cart, double-click protection, UPI app switching on mobile, refund status, a clear order confirmation page, and confirmation email/SMS.
- Cash on Delivery: **decision pending** (common in India, adds RTO risk and fees). Design the order model so COD can be added as another payment method without a rewrite.
- Invoices: generate a GST invoice per order (see India compliance below).

---

## Universal standards (apply by default)
**Security (OWASP-aligned):** HTTPS only, `helmet`, strict CORS allowlist, rate limiting, request validation (Zod or similar) on every endpoint, NoSQL-injection sanitization, output encoding (rely on Angular's sanitization; never bypass it without review), Content Security Policy, dependency audit in CI, no secrets in the repo, least-privilege DB user, password hashing (argon2/bcrypt) if passwords are added.
**Accessibility (WCAG 2.2 AA):** semantic HTML, keyboard operable, visible focus, correct labels and ARIA, color contrast, alt text, accessible modals/menus (consider Angular Aria primitives), `prefers-reduced-motion`.
**SEO:** SSR for public pages, unique title/description per page, canonical URLs, Open Graph tags, `Product` structured data (JSON-LD), sitemap.xml, robots.txt, clean URLs.
**Performance:** Core Web Vitals targets (LCP under 2.5s, INP under 200ms, CLS under 0.1), `NgOptimizedImage` with responsive `srcset`, lazy routes, `@defer` for below-the-fold and heavy animation, small bundles.
**Legal and trust pages:** privacy policy, terms, shipping, returns/refunds, contact, cookie consent. Confirm requirements for the target region.
**Quality:** ESLint + Prettier, strict TypeScript, unit tests (CLI default runner), API tests, Playwright e2e for the main flows (browse, search, cart, login, checkout), CI on every PR, conventional commits.
**Observability:** structured server logs, centralized error handling, user-friendly error messages (never leak stack traces).
**API:** REST with consistent error shape, pagination, versioned routes (`/api/v1`), OpenAPI doc.

---

## India compliance (pre-launch checklist: blocking only when `APP_MODE=live`; verify with a CA/lawyer)
- **BIS / Toys (Quality Control) Order, 2020:** toys for children under 14 must carry the BIS standard mark; mandatory since 1 Jan 2021 and actively enforced against online sellers. Every toy and RC product record needs a `bisCertified` flag and a BIS licence/registration number field; **in `live` mode, do not allow a toy listing to be published without it** (demo mode may use placeholder values). Display the BIS mark and a compliance declaration on the product page. Confirm with the owner how diecast collectibles (often labelled "not for children under 14") are classified.
- **Consumer Protection (E-Commerce) Rules, 2020:** show seller/business details, a grievance officer with contact details, clear return/refund/cancellation policy, and no unfair trade practices.
- **Product page legal data:** MRP inclusive of taxes, country of origin, manufacturer/importer details, age grade and safety warnings, net quantity where applicable (Legal Metrology).
- **GST:** GST registration, correct HSN code and GST rate per product, GST-compliant invoice per order (GSTIN, HSN, tax breakup, place of supply).
- **Data privacy:** privacy policy and consent flows aligned with India's DPDP Act; parental-consent considerations if any feature targets children. Cookie consent banner.
- **Pages required:** About, Contact, Privacy Policy, Terms, Shipping, Returns/Refunds, Cancellation, Grievance Redressal.
- Shipping: design checkout for Indian addresses (6-digit PIN code validation with city/state auto-fill, state dropdown, mobile number with OTP verification option), and plan integration with an Indian courier aggregator later.

## Responsive and "no UI/UX gap" rules
Target: **320px to 4K**, phones, tablets, laptops, large desktops, portrait and landscape.
- **Mobile-first.** Breakpoints as tokens (for example 360 / 480 / 768 / 1024 / 1280 / 1536). Prefer fluid layouts: CSS grid/flex, `clamp()` for type and spacing, container queries for components.
- No horizontal scroll at any width. Use `dvh`/`svh` units, safe-area insets for notched phones, responsive images.
- Touch targets at least 44x44px. Every hover effect has a touch/keyboard equivalent. Test with zoom 200% and larger system font size.
- **Every screen and every data fetch must define all states:** loading (skeleton or themed loader), empty, error with retry, success, offline, 403/404, and slow network.
- **Every form:** inline validation, clear error text, disabled/pending state on submit, double-submit prevention, preserved input on error, correct mobile keyboard types and autocomplete attributes.
- Navigation: sticky mobile nav, breadcrumbs on product pages, back-button friendly, scroll restoration, focus moves to the page heading on route change.
- Cart and checkout must be flawless: persistent cart (guest and logged-in), stock checks, price changes surfaced clearly, address validation, order summary always visible.
- Definition of Done for any UI task: verified at 320, 375, 768, 1024, 1440 and 1920 widths, keyboard-only pass, reduced-motion pass, all states implemented, no console errors. Add Playwright screenshot checks at those widths for key pages.

---

## Design concept: "Premium with a playful soul"
One brand system, two moods:
- **Collector's Garage** (diecast): darker, refined, showroom feel, chrome details, slower and smoother motion.
- **Play Zone** (toys, RC): same palette, brighter surfaces, rounder shapes, bouncier motion.
Shared components, tokens and logo. Category pages switch mood via a theme attribute, not separate code.

## Design tokens
Define as CSS variables, imported from `src/styles/`:
- `--red` #E10600: primary actions, highlights
- `--asphalt` #14161A: dark backgrounds, header, footer
- `--yellow` #FFC400: badges, sale tags, accents (never as text on white; use on dark or as a fill with dark text)
- `--chrome` #F2F3F5: light surfaces
- `--silver` #B8BEC6: borders, secondary text on dark
- Category accents: electric blue (RC), gold (collector editions)
Check WCAG AA contrast on every text/background pair.
Typography (Google Fonts): Barlow Condensed (headings), Inter (body), with system fallbacks. Radius: 12-16px in Play Zone, 6-8px in Collector's Garage.

## Signature animations
1. **Progress car:** a small car drives along a track as progress advances, with a checkered flag at the end. Use for page-load progress, checkout steps, and a free-shipping progress bar in the cart.
2. **Themed loaders:** spinning wheel for full-page loads; tire-tread shimmer for product skeleton cards.
3. **Animated notifications (toasts):** quick "pull-in" slide with a small icon animation. "Added to cart" shows a mini car driving into the cart icon. Success moments get brief, subtle checkered-flag confetti.
4. **Product cards:** gentle 3D tilt on hover, wheels spin. Quick-view opens with smooth scale and fade.
5. **Diecast detail pages:** 360-degree viewer or image sequence, zoom, animated specs panel.
6. **Hero:** scroll-linked parallax with a car moving through the scene. Keep it light.
7. **Page transitions:** brief speed-line wipe (under 400ms), using Angular route animations or the View Transitions API.
8. **Empty states and 404:** playful animated scenes (for example, a car that ran out of road).

Motion rules:
- 150-400ms for UI, up to 1.2s for hero moments. Shared easing tokens.
- Animate only `transform` and `opacity`.
- Respect `prefers-reduced-motion`: replace motion with simple fades or static states.
- Lottie/SVG assets under about 100KB each, lazy-loaded. Prefer CSS/SVG for small effects.
- Sound is off by default and always opt-in.
- Animation must never block purchase; loaders and effects stay skippable and the UI remains usable while they run.

## Engagement features (build in phases)
- Wishlist and "garage" (collection shelf) for collectors
- Collector badges and edition rarity tags
- Age-aware filters ("Ages 3+", "Collector grade")
- Reviews, recently viewed, back-in-stock alerts
- Gift mode for parents

---

## Assets and licensing rules
- Stock photos and video only from Unsplash, Pexels, Pixabay, Coverr. Animations from LottieFiles (check each asset's license).
- **Do not** use brand logos or official product photos (Hot Wheels, Maisto, Bburago, and so on) unless supplied by an authorized distributor or press kit. Use clearly marked placeholders until then.
- No random web GIFs or images. Keep `/docs/asset-credits.md` listing the source and license of every asset.
- No stock photos of identifiable children.

## Working rules for the agent
- Work in small, reviewable steps. Propose a plan before large changes.
- Follow the Angular official docs and the structure above. Ask before adding a dependency or changing design tokens.
- Commit after each working feature.
- Run lint, type-check, unit tests and a build before declaring a task done. For UI work, also verify the responsive and all-states checklist.
- Never commit secrets. Never trust client-supplied prices, totals or user IDs.

## Commands
(Fill in after scaffolding: install, dev server, SSR build, test, lint, e2e for both `client/` and `server/`.)
