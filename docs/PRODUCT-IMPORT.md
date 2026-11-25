# Product import and export

Open **Admin → Products → Import and export**. The uploader uses the existing administrator permission. Give that permission only to owners or managers who can change the catalog. Customer or unprivileged staff sessions cannot use these endpoints.

## Prepare the sheet

1. Choose CSV or XLSX and download the template. Keep the header names. You can leave the notes row in place and remove both examples before uploading real products.
2. Use a UTF-8 CSV or an XLSX with one worksheet. Keep identifiers such as SKUs, barcodes, and HSN codes as text so spreadsheet software preserves leading zeros. Format list cells as JSON arrays such as `["Plane","Remote"]` or enter one item per line within the cell.
3. Choose **Create only** for a new catalog or **Create and update by SKU** to change existing products. Every row needs a unique SKU within the file. Existing slugs stay fixed. Blank cells preserve existing values. Use the editor to clear optional fields. Blank opening stock means zero. In update mode, a stock value is the new quantity, and the difference is logged as an import movement.
4. Upload the file and select **Preview import**. Read the row statuses and field errors. To continue, choose **Confirm draft import** within 15 minutes. Changed rows are saved as drafts, including updates to previously published listings. A row that matches the catalog remains unchanged. Review changed drafts in the product editor before publishing.
5. Download the failed-row report for row numbers and reasons, correct the original file, and preview it again. A repeat upload of the same files skips rows already applied. If a product changes after preview, preview the sheet again.

The sheet limit is 5 MB and 500 product rows, excluding the header and optional notes row. Exports include the whole catalog; split a larger export into batches before importing it. Export omits cost price unless you opt in. Formula cells and text beginning with formula characters are read as text. CSV exports quote and neutralize that text; XLSX exports write literal string cells. Macros, external workbook links, and embedded objects are rejected.

## Column reference

| Columns | Format |
| --- | --- |
| `sku`, `slug`, `name`, `brand`, `description`, `barcode` | Text. Slugs use lowercase words separated by hyphens. |
| `productType`, `category`, `scale`, `status` | Diecast or RC type and a matching category. Scale is a ratio like `1:64`. Export includes listing status; imports assign draft to changed rows. |
| `price`, `mrp`, `costPrice` | INR amounts, without the currency symbol. Cost price is admin-only. |
| `stock`, `lowStockThreshold`, `warrantyDays`, `returnWindowDays` | Whole units or days. |
| `weightGrams`, `dimensionsMm.length`, `dimensionsMm.width`, `dimensionsMm.height` | Grams and millimetres. |
| `gstRatePercent`, `hsnCode`, `countryOfOrigin`, `genericName`, `netQuantity`, `ageGradeMin` | GST percentage, HSN as text, country, generic name, quantity description and minimum age in years. |
| `manufacturerName`, `manufacturerAddress`, `importerName`, `importerAddress`, `bisCertified`, `bisLicenceNumber`, `isiMarkImageUrl` | Use the actual label details. Boolean cells accept TRUE or FALSE. The existing publishing checklist applies. |
| `hasLithiumBattery`, `batteryWh`, `shippingNote` | TRUE or FALSE, watt-hours, shipping notes. |
| `images`, `imageFiles`, `imageAlts`, `glbUrl` | Lists of image URLs, ZIP filenames and alt text, plus an optional GLB URL. |
| `featured`, `placeholder`, `tags`, `seoTitle`, `seoDescription` | TRUE or FALSE for flags, a list for tags, and text for SEO. |
| `batteryType`, `batteryIncluded`, `runTime`, `chargeTime`, `topSpeed`, `controlRange` | RC battery type, TRUE or FALSE for included, minutes, km/h and metres. |
| `controlType`, `terrain`, `skillLevel`, `recommendedAge`, `readyToRun`, `boxContents` | See allowed values in the notes row. Age uses years. Use TRUE or FALSE and a list for the last two columns. |
| `ratingCount`, `ratingTotal`, `sales` | Read-only exports. Imports ignore these columns. |

## Match images

Use HTTP(S) URLs or paths starting with a single `/` in `images`. The server does not fetch those URLs during import.

To upload photos, attach a ZIP containing only JPG, PNG or WebP files with unique basenames. Use the product SKU or slug as the basename, or put an ordered list of exact filenames in `imageFiles`, such as `["front.webp","side.webp"]`. Matches are case-insensitive. If a row has both URLs and ZIP images, URLs come first. Put alt text in that same order. The archive limit is 20 MB compressed and 40 MB expanded, and each photo is limited to 5 MB. Do not include duplicate filenames in subfolders.

Source files are held in memory for each request and discarded afterward. Confirmed photos use the existing product image storage. For hosted image uploads in production, configure Cloudinary.

## Prefill one product

On **Create product**, open **Prefill from file** and choose a one-row CSV or XLSX, or a JSON object with product fields. Review the suggested values, then fill the form. The editor highlights the filled fields and rechecks what is missing. You can edit everything before saving. The product list also offers **Duplicate product** with a suggested slug and SKU. With photos selected it creates a zero-stock draft; without photos it opens a prefilled form so you can add an image before saving.

The optional document extraction feature starts disabled. To enable it, set `PRODUCT_AI_PREFILL=true` and configure `PRODUCT_AI_PREFILL_URL` with an HTTPS endpoint. An optional `PRODUCT_AI_PREFILL_TOKEN` is sent as a bearer credential. The provider receives only the selected PDF or image bytes as the body, with the corresponding Content-Type. It returns a JSON object with `suggestions`, each containing `field`, `value` and a numeric `confidence` from 0 to 1. The admin must select and review suggested values against the actual label. This is also required for suggested BIS licence numbers and HSN codes.
