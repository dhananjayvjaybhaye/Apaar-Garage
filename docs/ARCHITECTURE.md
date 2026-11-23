# Architecture

## Garage scene

The home hero shows its text over a dark background while WebGL starts. A CSS display case is the fallback for constrained devices, unavailable WebGL, and reduced motion. `garage-renderer.ts` builds and draws the room, lights, and products. The original animated door opens from the Enter button or can be skipped for the rest of the session.

The desktop hero holds its normal page position while one deliberate wheel gesture, swipe, or key press moves through Cars, Trucks, Bikes, and RC Toys. The glowing case label shows the active zone and a live region announces changes. The static fallback has four text buttons. `hero-gesture.ts` normalizes wheel units, accumulates small deltas over 100 ms, and waits for the camera and a 120 ms quiet gap before treating momentum as a separate gesture. `hero-scroll.ts` lets the page scroll away at either end and restores a saved zone at the hero. There is no extra page height for the tour. `garage-session.ts` releases the renderer when the hero leaves the viewport, and `garage-inspection.ts` hands it off to the product viewer during a 3D preview.

Below the hero, `category-stages-motion.ts` links card entrances and background parallax to normal scrolling. Category headings stay in the regular page flow, with compact spacing and standard product cards. Section links use the measured store header height.

## Home content and accessibility

New Arrivals reads the latest products from the same catalog API as the home category sections. The home FAQ selects five questions from `faq-content.ts`, which the support page uses in full. Both use the keyboard-operable `FaqList`. Empty-state artwork only moves while visible and respects the reduced-motion setting. The app shell leaves out the custom cursor and floating shapes on cart, checkout, sign-in, account creation, order, tracking, and admin routes.

The home route fetches the first garage zone immediately. It fetches the other zones after the first paint or as soon as the shopper selects one. The active 3D bench prioritizes its photo and optional GLB. The other bench photos load during idle time, and their models wait until selected. For the RC bench, a sign with the listing name or an empty-catalog message stays visible if there is no usable product photo or model. Phones and constrained devices keep the static hero until the shopper chooses **Explore the garage**.

The hero paints its copy over the scene's dark palette while the renderer starts after the first paint and after the entry dialog closes. Room, lighting, benches, and media setup run across separate animation frames. A CSS display case provides the static view for reduced motion, manual opt-in and unavailable WebGL. The canvas fades in after its first frame. The camera fits the active display case according to the viewport and makes one eased move per selection. The static and mobile hero scroll normally, with direct category selection. The compact renderer caps the pixel ratio at 1 and uses fewer lights. Bench photos use a small WebP variant where one exists and are capped at 256 pixels per side on the compact renderer. The bundled car uses `EXT_meshopt_compression`, which the lazy GLTF loader decodes.

Global ambient visuals start in an idle slot, and the hero and category headings share the sticky header size reported by `ResizeObserver`. Category headings render with the home page. Later category data still loads after the first paint, and product images load lazily with reserved space. The RC display prefers a featured product and queries the full RC catalog for the newest listing if there are no featured products.

## Storefront metadata

`metadata.mjs` defines page titles, summaries, canonical URLs, social previews, and JSON-LD. The Angular SEO service updates them on navigation and when product details arrive. The production SEO command uses the same definitions and public product API to write HTML with metadata already in the head, plus the sitemap and robots link. Angular still renders the interactive storefront. No private routes are included in the sitemap.

## Cart

The Angular cart store refreshes its signals from the API after each write. Guests receive a secure-in-production, HTTP-only guest cookie on their first add. Signed-in customers use a separate HTTP-only session cookie. The server merges eligible guest quantities into the signed-in cart and keeps them within current stock and the quantity limit. Cart values are computed from the current product records.

## COD orders

The checkout asks for a server quote based on current prices, inventory, delivery, discounts, and the COD fee. The quote hash helps detect changes between review and submission, and the checkout key lets a retry return the original order. The server checks the cart again inside a MongoDB transaction, creates the order, decrements inventory, and clears the purchased cart entries. Prices are stored in paise in order responses.

Customers can cancel orders while they are placed or confirmed. Cancellation restores stock in a transaction, and a repeated cancellation returns the already-cancelled order. Admin order status and payment changes use their own transition rules.

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
