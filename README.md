# Contract Sender — Prop Hunters Investor CRM

Florida real estate investor CRM MVP (Prop Hunters style). Add MLS-listed properties, attach listing agents, create offers, generate contract PDFs from a custom AS-IS template, mark/send email to the agent, and track the deal pipeline.

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
- This is a local MVP — no auth. Do not expose publicly without securing it.

## First-time Windows setup

Copy `.env.example` to `.env` (sets `DATABASE_URL` for SQLite), then `npm install && npm run setup && npm run dev`.
