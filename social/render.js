#!/usr/bin/env node
/* ============================================================
   BABETTE — QUOTE → PNG RENDERER
   Typesets human-approved words into ARTWORLD social assets.
   It renders only — it never rewrites, embellishes or generates.

   Single card:
     node social/render.js --quote "It felt like a film." \
       --attribution "HANNAH & ANGUS" --event "LA BELLE ÉCO — AUGUST 2026" \
       --variant paper --size feed --out out/hannah-feed.png

   Carousel set (title card + one slide per quote + closing card):
     node social/render.js --set my-set.json --out-dir out/

   set JSON: { "variant": "paper", "size": "feed",
               "attribution": "HANNAH & ANGUS", "event": "…",
               "quotes": ["…", "…"], "enquiryUrl": "HAVEYOUMETBABETTE.COM/ENQUIRE" }
   …or       { "cards": [ { "mode": "announce", "heading": ["NOW","BOOKING","2027"],
               "sub": "…", "out": "booking.png" } ] }

   Uses Playwright's Chromium if installed (local or global),
   else puppeteer / puppeteer-core (+ CHROME_PATH).
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const SIZES = {
  feed:   { width: 1080, height: 1350 },
  story:  { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
};
const VARIANTS = ["paper", "ink", "blush", "gold"];
const TEMPLATE = "file://" + path.join(__dirname, "templates", "card.html");

/* ---------- args ---------- */

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) args[key] = true;
      else { args[key] = next; i++; }
    }
  }
  return args;
}

/* ---------- browser resolution ---------- */

function tryRequire(name) {
  try { return require(name); } catch (_) {}
  try {
    const globalRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
    return require(path.join(globalRoot, name));
  } catch (_) { return null; }
}

async function launchBrowser() {
  const playwright = tryRequire("playwright") || tryRequire("playwright-core");
  if (playwright) {
    const browser = await playwright.chromium.launch();
    return {
      newPage: async (viewport) => {
        const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
        return page;
      },
      close: () => browser.close(),
      flavour: "playwright",
    };
  }
  const puppeteer = tryRequire("puppeteer") || tryRequire("puppeteer-core");
  if (puppeteer) {
    const options = {};
    if (process.env.CHROME_PATH) options.executablePath = process.env.CHROME_PATH;
    const browser = await puppeteer.launch(options);
    return {
      newPage: async (viewport) => {
        const page = await browser.newPage();
        await page.setViewport(Object.assign({ deviceScaleFactor: 1 }, viewport));
        return page;
      },
      close: () => browser.close(),
      flavour: "puppeteer",
    };
  }
  throw new Error(
    "No browser driver found. Install one: `npm i -D playwright` (recommended) " +
    "or `npm i -D puppeteer-core` with CHROME_PATH pointing at a Chrome binary."
  );
}

/* ---------- card rendering ---------- */

async function renderCard(browser, card, outFile) {
  const size = SIZES[card.size || "feed"];
  if (!size) throw new Error(`unknown size "${card.size}" (feed | story | square)`);
  if (card.variant && !VARIANTS.includes(card.variant)) {
    throw new Error(`unknown variant "${card.variant}" (${VARIANTS.join(" | ")})`);
  }

  const page = await browser.newPage(size);
  await page.goto(TEMPLATE, { waitUntil: "networkidle0" }).catch(async () => {
    await page.goto(TEMPLATE, { waitUntil: "networkidle" }); // playwright name
  });
  await page.evaluate(async () => { await document.fonts.ready; });

  await page.evaluate((c) => {
    window.BabetteCard.set(
      { variant: c.variant, size: c.size, mode: c.mode },
      c
    );
  }, {
    variant: card.variant || "paper",
    size: card.size || "feed",
    mode: card.mode || (card.quote ? "quote" : "announce"),
    quote: card.quote || "",
    heading: card.heading || [],
    sub: card.sub || "",
    attribution: card.attribution || "",
    event: card.event || "",
    kicker: card.kicker,
    index: card.index || "",
    url: card.url,
  });

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  await page.screenshot({ path: outFile, clip: { x: 0, y: 0, ...size } });
  await page.close();
  console.log(`✓ ${outFile} (${size.width}×${size.height}, ${card.variant || "paper"}/${card.mode || "quote"})`);
}

/* ---------- carousel expansion ---------- */

function expandSet(config) {
  if (Array.isArray(config.cards)) return config.cards;
  if (!Array.isArray(config.quotes)) {
    throw new Error("set file needs either `cards: []` or `quotes: []`");
  }
  const base = {
    variant: config.variant || "paper",
    size: config.size || "feed",
    kicker: config.kicker || "IN THEIR WORDS",
    event: config.event || "",
  };
  const cards = [];
  cards.push(Object.assign({}, base, {
    mode: "title",
    heading: ["IN", "THEIR", "WORDS"],
    attribution: config.attribution,
    out: "01-title.png",
  }));
  config.quotes.forEach((quote, i) => {
    cards.push(Object.assign({}, base, {
      mode: "quote",
      quote,
      attribution: config.attribution,
      index: `Nº ${String(i + 1).padStart(2, "0")}`,
      out: `${String(i + 2).padStart(2, "0")}-quote.png`,
    }));
  });
  cards.push(Object.assign({}, base, {
    mode: "closing",
    /* no heading → the closing card shows the real wordmark */
    sub: "Begin your own story —",
    url: config.enquiryUrl || "HAVEYOUMETBABETTE.COM/ENQUIRE",
    kicker: "THE INVITATION",
    out: `${String(config.quotes.length + 2).padStart(2, "0")}-closing.png`,
  }));
  return cards;
}

/* ---------- main ---------- */

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let cards, outDir;

  if (args.set) {
    cards = expandSet(JSON.parse(fs.readFileSync(args.set, "utf8")));
    outDir = args["out-dir"] || "social/out";
  } else {
    if (!args.quote && !args.heading && !args.sub) {
      console.error("Give me --quote (or --heading/--sub for announcement cards), or --set file.json. See header of this file.");
      process.exit(1);
    }
    cards = [{
      mode: args.mode,
      variant: args.variant,
      size: args.size,
      quote: args.quote,
      heading: args.heading ? String(args.heading).split("|") : undefined,
      sub: args.sub,
      attribution: args.attribution,
      event: args.event,
      kicker: args.kicker,
      index: args.index,
      url: args.url,
      out: path.basename(args.out || "card.png"),
    }];
    outDir = path.dirname(args.out || "social/out/card.png");
  }

  const browser = await launchBrowser();
  try {
    for (const card of cards) {
      await renderCard(browser, card, path.join(outDir, card.out));
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error("✗ " + e.message); process.exit(1); });
