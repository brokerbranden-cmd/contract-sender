# Contract Sender — Prop Hunters Investor CRM

Florida real estate investor CRM MVP (Prop Hunters style). Add MLS-listed properties, attach listing agents, create offers, generate contract PDFs from a custom AS-IS template, mark/send email to the agent, and track the deal pipeline.

**New: bulk MLS workflow** — import a Matrix/Reifax export, search & filter listings, tick many, create offers in bulk (PDF + email per listing), then send from your own mailbox via the Outbox. See [MLS bulk-offer workflow](#mls-bulk-offer-workflow-matrix--import--listings--offers--outbox).

## Stack

- **Next.js 14** (App Router) + TypeScript + Tailwind CSS
- **SQLite** via Prisma
- **pdf-lib** for contract PDF generation
- Email MVP: mark sent + mailto / preview (Resend hook stubbed for later)

## Quick start

```bash
cd /workspace/contract-sender
npm install
npm run dev            # http://localhost:3000
```

`predev` runs `prisma generate`, pushes the SQLite schema, and seeds sample data if the DB is empty.

For a clean re-seed anytime:

```bash
npm run setup          # generate + db push + seed
# or
npm run db:seed
```

## Happy path

1. **Dashboard** — pipeline overview and recent activity  
2. **Properties** — add an MLS-listed property  
3. **Agents** — add the listing agent  
4. **Deals → New Deal** — attach property + agent, set offer terms  
5. **Deal detail** — edit offer → **Generate PDF** → **Mark / Send Email**  
6. Activity log records contract generation and email sent; stage moves to `sent`

## Screens

| Route | Purpose |
|-------|---------|
| `/` | Dashboard |
| `/deals` | Kanban + list pipeline |
| `/deals/new` | Create deal |
| `/deals/[id]` | Offer terms, PDF, email, activity |
| `/import` | **MLS import** — upload Matrix/Reifax CSV or XLSX, map columns, preview, commit |
| `/listings` | **Listings search** — filters, sortable table, bulk “Create offers” |
| `/offers/bulk` | **Bulk offer builder** — template, offer %, per-row price/subject/body preview |
| `/outbox` | **Outbox** — mailto, mark sent, export `outbox-batch.json`, mark batch sent |
| `/properties` | MLS property inventory |
| `/agents` | Listing agents |
| `/templates` | Contract templates (editable) |
| `/settings` | Buyer defaults (Prop Hunters / Branden) |

## Deal stages

`new` → `researching` → `offer_drafted` → `sent` → `negotiating` → `under_contract` → `closed` / `dead`

## Seed data

- Custom **Florida Investor AS-IS Offer** template (not FAR/BAR verbatim)
- 5 sample properties, 4 agents, 5 deals across stages
- Buyer defaults: Prop Hunters LLC / Branden (editable in Settings)

## MLS bulk-offer workflow (Matrix → Import → Listings → Offers → Outbox)

### 1. Export from Matrix (sef.mlsmatrix.com, Miami Realtors)

1. Run your search in Matrix (criteria, statuses, counties, price range…).
2. On the results page, tick the listings (or “Select All” — all pages) you want.
3. Click **Export** (top of the results grid).
4. Choose an export format that includes the fields below — **“Agent Full” / a custom export layout** works best — and the **CSV** file type (Excel `.xlsx` also works).
5. Fields the importer understands (header names are matched loosely, so Matrix’s exact wording is fine):
   ML#, Status, Address (or Street Number/Name/Suffix/Unit), City, Zip/Postal Code, County, Area, Subdivision, List Price, Original List Price, Beds, Full Baths, Half Baths (or Total Baths), SqFt Living, Lot SqFt, Year Built, Property Type, Pool, Waterfront, DOM, List Date, Short Sale (Y/N), REO (Y/N), Broker/Internet/Public Remarks, Showing Instructions, **List Agent Name, List Agent Email, List Agent Phone**, List Office Name, List Office Phone.
   Tip: create and save one Matrix export layout with all of these so each export is one click.
6. Save the file (Matrix downloads a `.csv`).

> The agent **email** column is what makes bulk sending possible. If your Matrix export layout doesn’t include it, add “List Agent Email” to the layout. Rows without an email are still imported, flagged, and can be given an email in the Outbox before sending.

### 2. Import (`/import`)

1. Upload the CSV/XLSX. Columns are auto-detected from common aliases (Matrix, Reifax-style, generic).
2. Check/fix the mapping (any field can be remapped by hand; Address is required).
3. Review the **preview** (what will be created/updated/skipped — nothing is saved yet).
4. Click **Import**. Properties upsert by **MLS#** (fallback address + zip); agents upsert by **email** (fallback name + phone); a Deal at stage `new` is created for each property that has none. Re-importing the same file is safe (updates, no duplicates).
5. The summary shows created / updated / skipped, agents/deals created, and how many rows are missing an agent email.

A fictional **sample file** is at [`public/sample-mls-listings.csv`](public/sample-mls-listings.csv) (also downloadable from the import page). It is **EXAMPLE DATA ONLY** — made-up addresses, `example.com` email addresses and 555 phone numbers. It deliberately includes a duplicate MLS# row (tests update-not-duplicate), a row with no address (skipped), rows with no agent email, REO and short-sale listings.

### 3. Search & select (`/listings`)

Filter by text (address / MLS# / city / subdivision / agent), status, county, city, zip, list price min/max, beds min, baths min, property type, max DOM, REO, short sale, has agent email, not-yet-offered. Sort by clicking headers; paginate (25–200 rows). Tick rows, or **Select all N filtered** (selection persists across pages), then **Create offers**.

### 4. Bulk offers (`/offers/bulk`)

* Choose the contract template (PDF) — default is the seeded “Florida Investor AS-IS Offer”.
* Offer rule: **% of list price** (default 75%, change the default in Settings), **rounded to the nearest $1,000**, editable per row (manual edits are kept when you change the %).
* Earnest money, closing days, inspection days default from **Settings** (As-Is, Cash).
* Email subject/body start from the Settings templates and are shown rendered per listing; expand a row to edit its subject/body. Placeholders (existing `{{...}}` engine; both styles work): `{{address}}`, `{{street}}`, `{{city}}`, `{{zip}}`, `{{mls_number}}`, `{{list_price}}`, `{{offer_price}}`, `{{earnest_money}}`, `{{closing_days}}`, `{{inspection_days}}`, `{{agent_first_name}}`, `{{agent_name}}`, `{{buyer_name}}`, `{{buyer_signatory}}`, `{{buyer_phone}}`, `{{buyer_email}}` (camelCase such as `{{offerPrice}}` / `{{agentName}}` also work).
* **Generate** creates a PDF per listing in `public/contracts/`, moves each deal to `offer_drafted`, logs activity, and queues an Outbox item. **Nothing is emailed from this screen.**
* Duplicate guard: a property that already had an offer sent in the last N days (Settings → *Duplicate guard*, default 30; 0 = off) or already has an offer waiting in the Outbox is skipped, with the reason shown. Tick *Override duplicate guard* to force. Deals already `under_contract`/`closed` are always skipped.

### 5. Send (`/outbox`)

* **Open in email (mailto)** opens your default mail app with To/Subject/Body filled. `mailto:` can’t attach files, so use the **PDF** link to attach the offer. Then click **Mark sent** (moves the deal to `sent`, logs activity, counts toward today’s cap).
* The “To” address and subject/body can be edited in the Outbox before sending.
* **Daily send cap** (Settings, default 25/day): shown as “Sent today X / 25”. Batch export stops at the cap; single **Mark sent** asks for confirmation when the cap is reached.
* **Export batch for sending** downloads `outbox-batch.json` for an external sender (e.g. a script using Microsoft 365 / Graph):

```json
{
  "schemaVersion": 1,
  "batchId": "batch-2026-10-17T19-00-00-000Z-ab12cd34",
  "generatedAt": "2026-10-17T19:00:00.000Z",
  "from": { "name": "Branden", "email": "branden@prop-hunters.com" },
  "dailyCap": 25, "sentToday": 0, "count": 1, "skippedNoEmail": 0, "skippedByCap": 0,
  "note": "…",
  "items": [
    {
      "dealId": "cm…", "outboxId": "cm…",
      "to": "agent@example.com",
      "subject": "Offer on 1200 Example Palm Ave, Miami — Prop Hunters LLC",
      "body": "Hi Alex Sample,\n\nPlease find attached our offer…",
      "pdfPath": "C:\\path\\to\\contract-sender\\public\\contracts\\contract-….pdf",
      "pdfFileName": "contract-….pdf",
      "pdfUrlPath": "/contracts/contract-….pdf",
      "mlsNumber": "EX100001", "address": "1200 Example Palm Ave, Miami",
      "offerPrice": 292000, "agentName": "Alex Sample"
    }
  ]
}
```

  Each item = one plain-text email to send with the PDF at `pdfPath` attached. Only ready items with an agent email are exported, up to the remaining daily cap; items already exported are not re-exported unless you tick *include already-exported*.
* **Mark batch sent**: after the sender finishes, upload that same file (or any JSON with `{"dealIds": ["…"]}`, or a bare array of deal ids). Those deals’ items become `sent`, deals move to `sent`, contracts get `sentAt`. The sender can add `"status": "failed"` (or `"sent": false`) to any item to leave it unsent, and an optional `"sentAt"` ISO time. It’s idempotent (already-sent items are reported, not duplicated). API equivalents: `GET /api/outbox/export`, `POST /api/outbox/batch-sent`.

> Real sending through your Microsoft 365 mailbox is a separate step — this app never sends email itself. Only use real agent data when you intend to contact them; the sample CSV is fictional.

### Upgrading an existing install (keeps your data)

The schema changes are additive (new columns with defaults, new `OutboxItem` table), so your existing local DB and its data are preserved:

```powershell
git pull
npm install
npx prisma db push
npm run dev
```

(`npm run dev` also runs `npx prisma db push` automatically via `predev`.) Do **not** run `npm run setup` / `npm run db:seed` on a DB you want to keep — the seed wipes and re-creates sample data.

## FAR/BAR AS IS contract (official form)

Offers can be generated on the official **Florida Realtors/Florida Bar "AS IS" Residential Contract For Sale And Purchase** (FloridaRealtors/FloridaBar-ASIS-7x, Rev 2/26) instead of the built-in custom AS-IS contract.

The form is licensed to Florida Realtors members, so **it is not in this repo**. Use your own copy:

1. In Form Simplicity, print/download a blank "AS IS" contract to PDF (13 pages, letter size).
2. Save it as **`forms\farbar-asis.pdf`** inside the project folder (the `forms/` folder exists; `forms/*.pdf` is gitignored and never committed).
   - Or set a different path in **Settings → FAR/BAR AS IS contract → Form PDF path**, or the env var `FARBAR_ASIS_PATH`.
3. Restart `npm run dev`. Settings and Templates show a yellow warning while the file is missing (offers then fall back to the custom contract).

How it works: the form is flattened (no fields), so `src/lib/farbar/fill.ts` (`fillFarBarAsIs(deal, settings)`) overlays Helvetica text at fixed coordinates stored in `src/lib/farbar/asis-field-map.json` (coordinates only, no form content), auto-shrinking to fit each blank and drawing an X in checkboxes.

**Filled automatically:** Seller (from the property's *Seller name*, if entered), Buyer (Settings → Entity), street/city/zip, county, Tax ID, legal description, purchase price, initial deposit, "(ii) made within __ days" checkbox + days (Settings, default 3), escrow agent name/address/phone/email/fax (Settings), additional deposit (if any), loan amount (financed deals), balance to close (price − deposits − loan), acceptance deadline (today + Settings days), closing date (today + closing days), paragraph 7 assignability (Settings), paragraph 8(a) cash / 8(b) financing checkbox, paragraph 12 inspection period days, paragraph 20 additional terms (Settings), buyer printed name + date on the signature page, buyer notice address, cooperating sales associate/broker (Settings), listing sales associate/broker (listing agent / office).
**Always left blank:** all Buyer/Seller initials, signatures, seller notice address, personal property included/excluded, "Other" (2d), loan details in 8(b), title/closing-cost options and all other optional paragraphs, riders/addenda checkboxes, counter-offer section.

Choosing the contract type: Settings → *Default contract type*, per template (Templates → *Contract type*), per deal (deal page → *Contract type*) and in the bulk offer builder. **Auto** = FAR/BAR when the form file exists, otherwise custom. Seller name, county, Tax ID and legal description can be edited on the deal page; MLS imports also map *Tax ID / Parcel / Folio* and *Legal Description* columns.

`npm run farbar:sample -- out.pdf` writes a filled example (uses `forms/farbar-asis.pdf` or `FARBAR_ASIS_PATH`).

If a future form revision moves the blanks, re-measure and update `asis-field-map.json` (PDF points, origin bottom-left; text `y` = baseline).

## Email / Resend

The send endpoint (`POST /api/contracts/[id]/send`) marks the contract sent, logs activity, and returns a mailto + email preview. To wire Resend later, see the comment in that route:

```ts
// import { Resend } from "resend";
// const resend = new Resend(process.env.RESEND_API_KEY);
// await resend.emails.send({ from, to, subject, html, attachments: [pdf] });
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Next.js |
| `npm run setup` | Generate client, push schema, seed |
| `npm run db:push` | Apply Prisma schema |
| `npm run db:seed` | Re-seed sample data |
| `npm run build` | Production build |
| `npm test` | Unit tests (CSV parser, header detection, offer rounding, placeholders, batch parsing) |
| `npm run smoke` | End-to-end smoke test on a throwaway DB: imports the sample CSV, filters, creates offers + PDFs, exports/marks a batch, checks the cap and duplicate guard |
| `npm run farbar:sample` | Fill the FAR/BAR AS IS form with example data (needs `forms/farbar-asis.pdf`) |
| `npm run test:all` | `npm test` + `npm run smoke` |

## Project layout

```
src/app/           # Pages + API routes
src/components/    # Sidebar + UI primitives
src/lib/           # prisma, utils, pdf
prisma/            # schema + seed
public/contracts/  # Generated PDFs
```

## Notes

- Generated PDFs land in `public/contracts/` and are downloadable from deal detail.
- Template placeholders use `{{fieldName}}` merge syntax.
- Import/search/outbox are local-only with no auth. XLSX parsing uses the `xlsx` (SheetJS) npm package — only import files you exported yourself.
- Known limits: selection for bulk offers is capped at 500 per batch; search filters are single-select for status/county/type; `mailto:` cannot attach PDFs; the daily cap uses the app machine's calendar day.
- This is a local MVP — no auth. Do not expose publicly without securing it.

## First-time Windows setup

Copy `.env.example` to `.env` (sets `DATABASE_URL` for SQLite), then `npm install && npm run setup && npm run dev`.
