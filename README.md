# BABETTE — The Enquiry Suite

Every outward-facing form and social asset Babette needs to generate and
capture work, produced by one engine and one design kit (ARTWORLD).

**Governing principle:** this system captures, structures and presents.
It never generates creative concepts and sends them to clients.
Taste stays human. AI does plumbing only.

---

## Quickstart

```bash
node engine/build.js     # regenerates dist/ from forms/*.json
```

Open `dist/index.html` for the internal directory of every page.
Deploy the `dist/` folder to any static host — no server required.

## What's in the box

| Page | URL path | Purpose |
|---|---|---|
| Enquiry | `/enquire/` | 3-step lead qualification (event, world, practicals) |
| Testimonial | `/in-their-words/` | 5 sharp prompts + consent block, personalised via `?c=Hannah+%26+Angus` |
| Feedback | `/feedback/` | post-event afterword (internal; feeds the testimonial ask) |
| Check a date | `/check-a-date/` | 2-field availability micro-form — link-in-bio's best converter |
| Waitlist | `/waitlist/` | captures clashing dates for future seasons |
| Press | `/press/` | filters press/brand enquiries away from the wedding funnel |
| Suppliers | `/suppliers/` | public supplier self-registration (discipline tagging) |
| Bio hub | `/bio/` | on-brand Linktree replacement — every route ends at a form |
| Studio | `/studio/` | internal quote→PNG tool (also at `social/studio.html`) |

## Structure

```
kit/            babette.css (all ARTWORLD tokens) · babette-forms.js · fonts/
engine/         build.js — reads a form config, emits a page
forms/          one JSON config per form ← adding a form starts and ends here
social/         templates/ (card.html + card.css) · render.js · studio-template.html
dist/           generated output, ready to deploy
```

## Adding a form

Copy any config in `forms/`, change `slug`, `number`, `slateLabel`, `heading`,
and the `steps` array, then run `node engine/build.js`. No CSS, no layout code.

Field kinds: `text` `email` `tel` `date` `textarea` (set `"prompt": true` for
Cormorant-italic editorial questions) · `cards` / `chips` (tappable selectors;
options may carry a `note` and a `reveal` free-text follow-up; `"multiple": true`
for multi-select) · `check` (single checkbox; `{privacy}` in the text becomes the
privacy link) · `checks` (grouped consent items, one name each) · `note` ·
`hidden`. Validation is inline and editorial — set `error` per field.
`requiredUnless` waives a requirement when a named checkbox is ticked
(see the enquiry date + "we're flexible" pair). `captureParams` copies URL
params (e.g. `?theme=long-table` from a story poll) into hidden fields.

## Backend (Phase 1)

Forms POST JSON to the `endpoint` in each config — currently
`https://formsubmit.co/ajax/ozy@haveyoumetbabette.com` with `cc` to sarah@.
FormSubmit requires a one-time activation: submit any form once after first
deploy and click the confirmation link it emails. To switch to Formspree,
change `endpoint` to your form's URL (e.g. `https://formspree.io/f/XXXX`)
and rebuild.

Spam: honeypot field + 5-second time-to-submit check, both silent. No CAPTCHA.
GDPR: consent checkboxes travel in every payload; a privacy link sits in each
footer; testimonial consent flags stay attached to the quotes.

Phase 2 (planned): one serverless function switching on the `form` field —
email + Notion write (Clients DB / Testimonials DB) + notification.

## Quote → social pipeline

Renders human-approved words into ARTWORLD PNGs. It typesets only — it never
rewrites, embellishes or generates.

**Day-to-day:** open `dist/studio/index.html` (works from a local file, use
Chrome). Paste the quote, pick ground (paper/ink/blush/gold rule), size
(feed 1080×1350 / story 1080×1920 / square), download the PNG.

**Batch / carousels:**

```bash
node social/render.js --quote "It felt like a film." \
  --attribution "HANNAH & ANGUS" --event "LA BELLE ÉCO — AUGUST 2026" \
  --variant paper --size feed --out out/hannah.png

node social/render.js --set social/sets/example-set.json --out-dir out/
```

A `--set` file with a `quotes` array expands to a full carousel: title card →
one slide per quote → closing card ("HAVE YOU MET BABETTE?" + enquiry URL).
Announcement cards (`--mode announce --heading "NOW|BOOKING|*2027"`) come from
the same templates — `*` marks the splash-red line. Requires `playwright`
(or `puppeteer-core` + `CHROME_PATH`) — the templates and studio need nothing.

## Fonts

Cormorant Garamond (italic, variable), Inter (variable) and Archivo Black are
self-hosted in `kit/fonts/`. Archivo Black stands in for **Druk Wide Trial**;
if you have the licensed Druk woff2, drop it in as
`kit/fonts/DrukWideTrial-Heavy.woff2` and rebuild — the kit picks it up
automatically, no CSS changes.

## Acceptance criteria

- Same hand as `babette-artworld.html`: same tokens, type voices, slate motif ✓
- Both core forms complete on a phone in under 90 seconds ✓
- Testimonial → approved quote → 1080×1350 PNG without touching Canva ✓
- A new form = a new JSON config only ✓

---

*Have You Met Babette?*
