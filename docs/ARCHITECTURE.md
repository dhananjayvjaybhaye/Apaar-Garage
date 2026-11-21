# Architecture

## Garage scene

The home hero shows an image until the WebGL scene loads and keeps that fallback for unsupported or reduced-motion environments. `garage-renderer.ts` builds and draws the room, lights, and products. The original animated door opens from the Enter button or can be skipped for the rest of the session.

The hero pins while the camera moves through Cars, Trucks, Bikes, and RC Toys. The tabs scroll to the matching zone. `hero.config.ts` defines the zone order and scroll length. `garage-session.ts` releases the renderer when the hero leaves the viewport, and `garage-inspection.ts` hands it off to the product viewer during a 3D preview.

Below the hero, `category-stages-motion.ts` links card entrances and background parallax to normal scrolling. Each category uses a CSS sticky heading and the standard product cards.

## Home content and accessibility

New Arrivals reads the latest products from the same catalog API as the home category sections. The home FAQ selects five questions from `faq-content.ts`, which the support page uses in full. Both use the keyboard-operable `FaqList`. Empty-state artwork only moves while visible and respects the reduced-motion setting. The app shell leaves out the custom cursor and floating shapes on cart, checkout, sign-in, account creation, order, tracking, and admin routes.

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
