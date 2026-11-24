# Change guide

## Add a product category

1. Add the category to the appropriate product type in `server/src/utils/product-input.js`. The model and query validators use those values.
2. Update the corresponding category list and label in `client/src/app/catalog/product.ts`. The catalog reads these values for its filters.
3. Add sample data in `server/scripts/products.js` or `server/scripts/rc-products.js` if needed. If the category belongs in the garage, update its zone mapping in `garage-path.ts` and its featured query in `home.ts`.
4. Verify listing, filtering, and detail responses. Keep existing category IDs stable for saved URLs.

## Change theme colors

Start with the dark amber palette in `client/src/styles.css`. Change a shared variable such as `--accent`, `--amber`, or `--background`, then check text and control contrast. If you change the page background, update the browser bar color in `client/src/index.html` as well. The Three.js garage has its own material palette in `garage-renderer.ts`.

## Change animation speed

Edit `hero.config.ts` for the canvas fade and camera animations. The `heroSteps` settings control the dolly, cooldown, wheel sample window, quiet period, swipe threshold, 24 px anchor tolerance and 700 ms handoff. In a development build, add `?debugScroll=1` and open the browser console to inspect wheel units, deltas, timestamps, and pinch signals. Test a mouse notch, a light two-finger swipe, a long swipe with momentum, a reversal, and scrolling back into RC from below. Focus a hero link and verify normal browser key handling. Leave the stall timeout longer than the move so the page returns to normal scroll if rendering stops. Edit `category-stages.css` for category heading size and section spacing, and `category-scenes.config.ts` for the reveal timings. Test both normal motion and reduced motion.

The `heroScene` values in `hero.config.ts` control the zoom and emphasis of the active case. `activeZoneFill` sets the case width as a fraction of the garage opening beside the headline, and `signTopMargin` sets the minimum clearance in CSS pixels. `desktopFrame` and `compactFrame` set the case's screen position. The projection test covers all four zones at 1366×768, 1440×900, 1920×1080, and 2560×1440. `inactiveBrightness` controls the dimming, and the dolly distances use Three.js world units. Check all four zone centers and the transitions on a wide and narrow screen after changing these values.

## Populate an empty RC bench

Run `npm.cmd run seed` from `server` to load the sample listings into the database configured in `server/.env`. The seed includes 15 RC products. Check `GET /products?productType=rc&sort=featured&limit=8` on the running API. The home category uses the RC product type, which includes all supported `rc-*` categories. Use End to reach the RC display in the 3D hero, or choose RC in the static hero, after the seed completes.

## Check the home category layouts

With a seeded API and the production preview running, install the optional browser test dependency from `client` and run the check. It needs an installed copy of Chrome.

```powershell
npm.cmd install --no-save --package-lock=false playwright-core
node scripts/check-category-layout.mjs
```

Set `PREVIEW_URL` when using a different preview port. The check measures the last product and View all card on all four sections, then simulates loading and an empty inventory. Keep bottom padding on the section and clipping on its decorative backdrop so the card shadows and tilt stay visible.

## Publish products and manage inventory

Use an existing administrator account with the admin API. Create a product with `POST /admin/products`, read it by slug with `GET /admin/products/:slug`, and send changed fields using `PATCH /admin/products/:slug`. To publish, set `status` to `published`. A 400 response includes a `details` array with each missing or invalid field. Use `PATCH /admin/products/:slug/stock` with a signed integer `delta` for a stock adjustment. The order, product and stock APIs do not physically delete inventory records.

## Dispatch and handle returns

- Send `PATCH /admin/orders/:orderNumber/status` with `status: "shipped"` and optional `shipment` fields `courier`, `awb` and `trackingUrl`. This creates the invoice or bill, available from order tracking or `GET /orders/:orderNumber/invoice`.
- A failed delivery uses `status: "undelivered"` with `reasonCode` set to `refused`, `unreachable`, or `failed_attempts`. Once the parcel arrives back, send `status: "returned_to_seller"` and a `condition` of `resalable` or `damaged`.
- Customers submit `POST /orders/:orderNumber/returns` with a reason such as `damaged` and `items: [{ "slug": "product-slug", "quantity": 1 }]`. Use the same endpoint with GET to see their requests. Staff review with `GET /admin/orders/:orderNumber/returns` and update with `PATCH /admin/orders/:orderNumber/returns/:id`. When receiving, include the condition for each item as `items: [{ "slug": "product-slug", "condition": "resalable" }]`. After recording COD collection, a refund can be recorded in paise with `refundAmountPaise`.
- Use `POST /admin/orders/:orderNumber/notes` and `PATCH /admin/orders/:orderNumber/confirmation` for internal notes and customer confirmation. The customer return workflow is available through the API.

## Create the first administrator

From an interactive terminal in `server`, run `npm.cmd run create-admin` on Windows or `npm run create-admin` on macOS or Linux. Use the target database’s `MONGODB_URI`. Enter the email and type the new password twice. The password is hidden and must be at least 12 characters and at most 72 UTF-8 bytes. If that email already belongs to an account, the command promotes it, sets the password you entered, and requires the account to sign in again.

Sign in at `/admin/login`. The store login keeps using its separate customer session. Admin sessions require a fresh sign-in after 30 minutes without activity or after 12 hours at most. The dashboard warns shortly before expiry.

Production requires an authenticator. Set `ADMIN_REQUIRE_2FA=true` to test the same flow in development. Sign in with your password, generate the QR code, scan it in an authenticator app, and enter the current six-digit code. Store the recovery codes offline. On future sign-ins, enter a current authenticator code or one unused recovery code. Keep `ADMIN_TOTP_KEY` stable if configured. It must be 64 hex characters from a secure random source. Without it, the key is derived from `JWT_SECRET`.

From `server`, run `npm.cmd run remove-admin` on Windows or `npm run remove-admin` on macOS or Linux. Enter the email and type `REMOVE` to confirm. This revokes admin sessions immediately and removes the old authenticator enrollment. The account can still use the storefront. An operator with database access can use the remove and create commands to re-enroll an administrator who has lost both the authenticator and all recovery codes.

For direct admin API requests, sign in using `POST /auth/admin/login`, keep the admin cookie, and send the returned token as `X-Admin-CSRF` on writes. A non-renewing session check is available at `GET /auth/admin/session`. The dashboard shows the latest audit entries, including account lockouts and changes to settings, products, orders, and refunds.

## Complete seller details and policies before launch

Use `GET /admin/settings`, edit the JSON, and save it with `PUT /admin/settings`. If the production check blocks startup, use the development API on the host’s loopback interface to fix the settings and hide or archive published placeholders. In PowerShell, run `$env:NODE_ENV = 'development'` in the server terminal before `npm.cmd start`. Keep that maintenance process private. Restart with `NODE_ENV=production` once the check passes. Review the result on `/seller-information`, in the footer, and at `/api/store-info`.

- Set the seller’s legal name, trade name and full business address. Verify the seller state and the GST registration setting. Supply the GSTIN if registered.
- Fill in the customer care phone, email and hours, plus the grievance officer’s name, designation, email, phone and address.
- Fill `policyDetails.returnConditions`, `nonReturnableItems`, `refundTimeline`, `exchangeTerms`, `warrantyTerms`, and `otherDataRetention` with the store’s actual terms. Verify the default return window, delivery estimate, pincode rules, and configured anonymized-order retention.
- Replace demo listings with real product data. Verify the MRP inclusive of taxes, selling price, net quantity, origin, manufacturer or importer details, age grade, warranty, return window, and battery transport notes. Supply the actual BIS licence and an authorized packaging image in `isiMarkImageUrl` where applicable. The storefront displays the image only with a declared certification and licence.
- Update the checkout policy version in `server/src/config/store-policy.js` when substantially changing what buyers agree to. Checkout records the version and time on the order. Direct `POST /orders` callers must send `acceptPolicies: true` after obtaining the customer’s agreement. Update the newsletter consent version in the server and home signup together if its consent wording changes.

## Change store settings and COD rules

Read the complete settings using an administrator session with `GET /admin/settings`. Update that JSON with `PUT /admin/settings`. Amounts in the settings API are integer paise. Keep currency values in rupees in the initial environment defaults. Changes take effect when saved on the current API instance. Other instances refresh within 30 seconds.

- By default, the store allows two open COD orders per normalized mobile number and three per normalized address over the last 24 hours. The first-order cap is ₹2,500 until there is a delivered COD order for that phone or account. A total over ₹4,000 needs customer confirmation. Both risk thresholds use the final payable amount.
- The default repeated-failure rule flags three undelivered COD orders within 90 days. Set `risk.repeatedUndeliveredAction` to `block` to refuse subsequent COD orders. Use `/admin/blocked-contacts` to add or remove manual blocks by phone, pincode, or both. For flagged or high-value orders, record customer confirmation using `PATCH /admin/orders/:orderNumber/confirmation` before packing.
- Set `codFeePaise`, `codMinPaise`, `codMaxPaise`, `deliveryFeePaise`, and `freeDeliveryThresholdPaise` in settings. Checkout uses the **merchandise subtotal after discount** for free delivery, before shipping and COD fees. The cart’s estimate is based on the cart contents before checkout discounts.
- Use `serviceablePincodeRules` for exceptions. The longest matching prefix wins. Set `serviceable: false` to turn off checkout for a prefix. A product-specific return window overrides the store default on new orders.

## Manage coupons

Use `GET /admin/coupons` and `PUT /admin/coupons`. The PUT body includes `code` and either `percent` or `amountPaise`, with optional `minimumPaise`, `startsAt`, `endsAt`, `totalLimit` and `perCustomerLimit`. Set `active: false` to retire an offer while preserving redemption history. Coupon use is recorded when an order is placed. A coupon replaces the separate automatic discount on an eligible first signed-in order. Guest usage is checked with the shipping phone at checkout.

## Manage tickets, consent and account data

- Customers submit tickets and check status from the support page or via `POST /support/status` with `ticketNumber` and `email`. Staff can list or update tickets from `/admin/support`. Acknowledge within 48 hours and resolve within one month. New tickets use the earlier of one calendar month and 30 days for their resolution deadline.
- Newsletter sign-up records consent for the text shown at signup. An authorized sender can request a token from `POST /admin/newsletter/unsubscribe-token` with `email`. Configure the sender to POST to `/api/newsletter/unsubscribe/:token` for one-click unsubscribe. A human-readable email link can open `/newsletter/unsubscribe#<token>` on the storefront. Sign-up tokens and the sender’s list stay private.
- Signed-in customers can download their linked data and close their account from `/account/privacy`. Closing requires the current password and completion of open orders or returns. Tickets and newsletter records are linked when submitted while signed in using the account email. For older or guest records, use the support channel where ownership can be checked. MongoDB expires anonymized order records after the configured retention period.

## Add a page

Create a standalone component under the relevant `client/src/app` folder. Register it with `loadComponent` and a title in `app.routes.ts` before the wildcard route. Add a navigation link where shoppers need it. Use the auth guard if the page requires an account. Verify navigation by link and by opening the URL directly.

For a public page, add its title and description in `client/src/app/seo/metadata.mjs`, then regenerate the deployment files and check the URL in `sitemap.xml`. The same file controls canonical catalog categories. Add new category IDs there when adding categories that should be discoverable in search.

## Update the FAQ and New Arrivals

Edit question text and answers in `client/src/app/ui/faq-content.ts`. The home page chooses its questions by ID, and the support page shows the full list. Adjust the New Arrivals count in `client/src/app/home/home-content.config.ts`. Verify that the accordion opens by keyboard and the latest listings still appear first.

## Tune the ambient background

Edit the layered artwork in `client/src/app/ui/garage-ambience.css` and the SVGs in `client/public/images/ambient`. The reusable `Parallax` directive controls how decorative layers move.

