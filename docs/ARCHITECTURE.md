# Architecture

## Garage scene

The home hero keeps its text and links visible beside a skeleton while WebGL starts. The CSS garage is the fallback for constrained devices, unavailable WebGL, and reduced motion. `garage-renderer.ts` builds and draws the room, lights, and products. The original animated door opens from the Enter button or can be skipped for the rest of the session.

The desktop hero holds its normal page position while one deliberate wheel gesture, swipe, or key press moves through Cars, Trucks, Bikes, and RC Toys. The glowing case label shows the active zone and a live region announces changes. The static fallback uses four CSS display cases with text buttons, and the live hero shows a scroll hint on the first visit in a session. `hero-gesture.ts` normalizes wheel units, accumulates small deltas over 260 ms, and waits for the camera and a 120 ms quiet gap before treating momentum as a separate gesture. `hero-scroll.ts` leaves ordinary page scrolling native and hands boundary crossings to the 700 ms frame-based animation in `hero-travel.ts`. The renderer holds the last frame during the page handoff so the scroll can paint without competing with WebGL. Momentum suppression after the handoff is capped at 280 ms. `hero-arrival.ts` restores the home scroll offset and zone on return. There is no extra page height for the tour. Opening a different storefront page starts at the top, while filters, section links and Back keep their own scroll position. `garage-session.ts` releases the renderer when the hero leaves the viewport, and `garage-inspection.ts` hands it off to the product viewer during a 3D preview.

Below the hero, `category-stages-motion.ts` links card entrances and background parallax to normal scrolling. Category headings stay in the regular page flow, with compact spacing and standard product cards. Section links use the measured store header height.

## Home content and accessibility

New Arrivals reads the latest products from the same catalog API as the home category sections. The home FAQ selects five questions from `faq-content.ts`, which the support page uses in full. Both use the keyboard-operable `FaqList`. Empty-state artwork only moves while visible and respects the reduced-motion setting. The app shell leaves out the custom cursor and floating shapes on cart, checkout, sign-in, account creation, order, tracking, and admin routes.

The home route fetches the first garage zone immediately. It fetches the other zones after the first paint or as soon as the shopper selects one. The active 3D bench prioritizes its photo and optional GLB. The other bench photos load during idle time, and their models wait until selected. For the RC bench, a sign with the listing name or an empty-catalog message stays visible if there is no usable product photo or model. Phones and constrained devices keep the static hero until the shopper chooses **Explore the garage**.

The hero paints its copy over the scene's dark palette while the renderer starts after the first paint and after the entry dialog closes. Room, lighting, benches, and media setup run across separate animation frames. A CSS garage provides the static view for reduced motion, manual opt-in and unavailable WebGL. The canvas fades in after its first frame. The camera fits the active display case according to the viewport and makes one eased move per selection. The static and mobile hero scroll normally, with direct category selection. The compact renderer caps the pixel ratio at 1 and uses fewer lights. Bench photos use a small WebP variant where one exists and are capped at 256 pixels per side on the compact renderer. The bundled car uses `EXT_meshopt_compression`, which the lazy GLTF loader decodes.

Global ambient visuals start in an idle slot, and the hero and category headings share the sticky header size reported by `ResizeObserver`. Category headings render with the home page. Later category data still loads after the first paint, and product images load lazily with reserved space. The RC display prefers a featured product and queries the full RC catalog for the newest listing if there are no featured products.

## Storefront metadata

`metadata.mjs` defines page titles, summaries, canonical URLs, social previews, and JSON-LD. The Angular SEO service updates them on navigation and when product details arrive. The production SEO command uses the same definitions and public product API to write HTML with metadata already in the head, plus the sitemap and robots link. Angular still renders the interactive storefront. No private routes are included in the sitemap.

## Cart

The Angular cart store refreshes its signals from the API after each write. Guests receive a secure-in-production, HTTP-only guest cookie on their first add. Signed-in customers use a separate HTTP-only session cookie. The server merges eligible guest quantities into the signed-in cart and keeps them within current stock and the quantity limit. Cart values are computed from the current product records.

## Admin bootstrap and production startup

The interactive `npm run create-admin` command uses the configured MongoDB connection and bcrypt. It creates or promotes an account and rotates its password and session version. Previous cookies for that account expire on their next request. Public registration accepts only customer fields.

Admin sign-in uses a separate HTTP-only cookie and a MongoDB session with independent idle and absolute expiries. Requests validate the current account role and session version. Mutations also validate a session-bound CSRF token. The password-only enrollment session can only set up the authenticator or sign out. Authenticator codes follow [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238). TOTP secrets use authenticated encryption, and recovery codes are stored as hashes and consumed atomically. Shared MongoDB counters enforce sliding 15-minute login limits across API processes. The audit log records IDs and reduced summaries without passwords, codes, or private request bodies.

Production startup uses the same store-settings service as the API. Before opening the listener, it checks seller identity, customer care and grievance contacts, the invoice prefix, and published placeholder inventory. Development remains available for maintenance.

## Admin dashboard and products

The admin shell keeps a separate session and collapses its navigation on smaller screens. The dashboard reads workflow counts and collected order totals for the last 30 calendar dates in IST. Top sellers use item quantities in the same collected orders. Audit responses resolve actor and account target names without changing the stored audit history.

Product search and filters run on the API with pagination. The editor checks draft and publication requirements with the same server validation used on save. Draft-only and publication feedback are rendered through shared form fields. The Angular router owns admin page titles, while storefront routes keep their SEO titles. Bulk publishing validates the full selection before committing any change. Stock adjustments still use the stock-movement transaction. Product uploads are authenticated and CSRF-protected. Images are converted to bounded WebP files with Sharp. GLB uploads are validated against the binary glTF format and checked for embedded resources. Cloudinary handles configured deployments, and the local upload directory is served only in development or tests.

## Business rules and settings

A validated StoreSettings document supplies seller details and checkout policy, with a short per-process read cache. Settings changes invalidate the local cache. Checkout serializes risk checks for a normalized mobile number and address using private lookup keys. Flagged orders require an explicit customer confirmation before packing. OTP and mobile notifications have interfaces ready for a provider.

Coupon availability and redemptions are checked inside the order transaction. Each redemption writes the coupon record, so concurrent transactions compete on the same counter. Order email events are transactional outbox entries delivered by the existing worker after commit. Tickets use a private number-and-email lookup and track acknowledgement and resolution independently. Account closure removes or anonymizes linked personal fields and gives anonymous order records a retention expiry.

The storefront shares one public store-info resource across the footer, seller page, policy pages, and product disclosures. Checkout uses the same server tax calculation as invoices, displays GST already included in the merchandise total, and records the terms and policies version the buyer accepted.

## COD orders

The checkout asks for a server quote based on current prices, inventory, delivery, discounts, and the COD fee. The quote hash helps detect changes between review and submission, and the checkout key lets a retry return the original order. The server checks the cart again inside a MongoDB transaction, creates the order, decrements inventory, and clears the purchased cart entries. Prices are stored in paise in order responses.

Customers can cancel while the order is placed or confirmed. A store administrator can also cancel a packed order. After dispatch, failed delivery goes through `undelivered` and then `returned_to_seller`. Each transition checks the current status. A resalable return restores inventory once. A damaged receipt records its condition with no stock increase.

Checkout includes SKU, HSN, MRP, GST rate, price, discount and return-window snapshots on each line. The server splits the merchandise discount proportionally, extracts GST from the remaining price, and reconciles rounding on the last eligible line for each GST rate. It splits tax into CGST and SGST for an in-state shipment and IGST otherwise. Delivery and COD fees stay separate from the merchandise breakdown. Dispatch assigns an invoice number inside the order transaction using the next number for the Indian financial year. Unregistered sellers issue a bill of supply with no tax lines. Order tracking links to the owner-only document with the seller’s name and details. Orders dispatched before this change keep their original records without an invoice backfill.

Delivered orders support partial returns. The parent order serializes reservations, so parallel requests cannot reserve the same units or exceed their paid value. Receiving a resalable item writes the stock adjustment and the movement together. Refund amounts are capped by the purchased units’ discounted value and the remaining amount collected. Return resolution records a refund or replacement after staff completes it.

Products default to draft and publish only after validation. Public product queries share one visibility filter, including the production placeholder exclusion. Admin product APIs alone select cost price. Historical orders continue using their snapshots when a listing is hidden or archived.

## API contracts

The public response names below match the client TypeScript types. Express controllers and serializers produce those shapes from the server models. Database identifiers and server-only fields stay out of the corresponding public account and order responses.

| Contract | Shape and source |
| --- | --- |
| `Product` | Public catalog item. The listing and detail service derives the type for older records, returns rating summaries, and retains category-specific fields. |
| `ProductPage` | `items`, `page`, `limit`, `total`, `totalPages`, and optional brand and scale facets. |
| `CustomerAccount` | Public account returned by auth endpoints with `id`, `name`, and `email`. |
| `Cart` | Cart line items, total quantity, subtotal in rupees, and optional free-delivery amount in paise. |
| `OrderQuote` | Item and total summary in paise, COD details, and the quote hash. |
| `PlaceOrderResponse` | `orderNumber` returned by order creation and idempotent retries. |
| `CustomerOrder` | Order status, history, payment status, item and total summary, delivery estimate, and cancellation eligibility. |
| `OrderPage` | `items`, `page`, and `totalPages` for the authenticated order list. |
| `ApiError` | A public `message` produced by the central error handler. |
