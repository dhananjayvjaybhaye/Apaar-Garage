# Change guide

## Add a product category

1. Add the category to the appropriate product type in `server/src/utils/product-input.js`. The model and query validators use those values.
2. Update the corresponding category list and label in `client/src/app/catalog/product.ts`. The catalog reads these values for its filters.
3. Add sample data in `server/scripts/products.js` or `server/scripts/rc-products.js` if needed. If the category belongs in the garage, update its zone mapping in `garage-path.ts` and its featured query in `home.ts`.
4. Verify listing, filtering, and detail responses. Keep existing category IDs stable for saved URLs.

## Change theme colors

Start with the dark amber palette in `client/src/styles.css`. Change a shared variable such as `--accent`, `--amber`, or `--background`, then check text and control contrast. If you change the page background, update the browser bar color in `client/src/index.html` as well. The Three.js garage has its own material palette in `garage-renderer.ts`.

## Change animation speed

Edit `hero.config.ts` for the canvas fade and camera animations. The `heroSteps` settings control the dolly, cooldown, wheel sample window, quiet period, and swipe threshold. In a development build, add `?debugScroll=1` and open the browser console to inspect wheel units, deltas, timestamps, and pinch signals. Test a mouse notch, a light two-finger swipe, a long swipe with momentum, and a reversal. Leave the stall timeout longer than the move so the page returns to normal scroll if rendering stops. Edit `category-stages.css` for category heading size and section spacing, and `category-scenes.config.ts` for the reveal timings. Test both normal motion and reduced motion.

The `heroScene` values in `hero.config.ts` control the zoom and emphasis of the active case. `activeZoneFill` sets the case width as a fraction of the garage opening beside the headline, and `signTopMargin` sets the minimum clearance in CSS pixels. `desktopFrame` and `compactFrame` set the case's screen position. The projection test covers all four zones at 1366×768, 1440×900, 1920×1080, and 2560×1440. `inactiveBrightness` controls the dimming, and the dolly distances use Three.js world units. Check all four zone centers and the transitions on a wide and narrow screen after changing these values.

## Populate an empty RC bench

Run `npm.cmd run seed` from `server` to load the sample listings into the database configured in `server/.env`. The seed includes 15 RC products. Use End to reach the RC display in the 3D hero, or choose RC in the static hero, after the seed completes.

## Change the COD fee

Set `COD_FEE` in `server/.env` to a nonnegative rupee amount with up to two decimal places, then restart the API. Use `COD_MIN_ORDER_VALUE` and `COD_MAX_ORDER_VALUE` for merchandise subtotal limits. The server recalculates the fee in the cart quote and on checkout.

## Add a page

Create a standalone component under the relevant `client/src/app` folder. Register it with `loadComponent` and a title in `app.routes.ts` before the wildcard route. Add a navigation link where shoppers need it. Use the auth guard if the page requires an account. Verify navigation by link and by opening the URL directly.

For a public page, add its title and description in `client/src/app/seo/metadata.mjs`, then regenerate the deployment files and check the URL in `sitemap.xml`. The same file controls canonical catalog categories. Add new category IDs there when adding categories that should be discoverable in search.

## Update the FAQ and New Arrivals

Edit question text and answers in `client/src/app/ui/faq-content.ts`. The home page chooses its questions by ID, and the support page shows the full list. Adjust the New Arrivals count in `client/src/app/home/home-content.config.ts`. Verify that the accordion opens by keyboard and the latest listings still appear first.

## Tune the ambient background

Edit the layered artwork in `client/src/app/ui/garage-ambience.css` and the SVGs in `client/public/images/ambient`. The reusable `Parallax` directive controls how decorative layers move.

