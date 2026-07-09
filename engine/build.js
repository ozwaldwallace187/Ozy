#!/usr/bin/env node
/* ============================================================
   BABETTE — FORM ENGINE
   Reads forms/*.json → emits dist/<slug>/index.html.
   A new form is a new JSON config, nothing else.
   Zero dependencies. `node engine/build.js`
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FORMS_DIR = path.join(ROOT, "forms");
const KIT_DIR = path.join(ROOT, "kit");
const DIST = path.join(ROOT, "dist");
const SOCIAL_DIR = path.join(ROOT, "social");

/* ---------- helpers ---------- */

const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const attr = (s) => esc(s);

let idCounter = 0;
const uid = (prefix) => `${prefix}_${++idCounter}`;

function fail(file, message) {
  console.error(`✗ ${file}: ${message}`);
  process.exitCode = 1;
}

/* ---------- field renderers ---------- */

function renderLabel(field, forId, tag = "label") {
  const cls = field.prompt ? "bb-label bb-prompt" : "bb-label";
  const req = field.required ? ' <span class="bb-req" aria-hidden="true">*</span>' : "";
  const forAttr = tag === "label" && forId ? ` for="${forId}"` : "";
  return `<${tag} class="${cls}"${forAttr}>${esc(field.label)}${req}</${tag}>`;
}

function renderInput(field) {
  const id = uid("f");
  const type = field.kind === "text" ? "text" : field.kind;
  const parts = [`<div class="bb-field"${field.error ? ` data-error="${attr(field.error)}"` : ""}>`];
  parts.push(renderLabel(field, id));
  parts.push(
    `<input class="bb-input" id="${id}" name="${attr(field.name)}" type="${type}"` +
    (field.required ? " required" : "") +
    (field.placeholder ? ` placeholder="${attr(field.placeholder)}"` : "") +
    (field.autocomplete ? ` autocomplete="${attr(field.autocomplete)}"` : "") +
    (field.requiredUnless ? ` data-required-unless="${attr(field.requiredUnless)}"` : "") +
    (field.error ? ` data-error="${attr(field.error)}"` : "") +
    (field.errorFormat ? ` data-error-format="${attr(field.errorFormat)}"` : "") +
    ">"
  );
  if (field.hint) parts.push(`<p class="bb-hint">${esc(field.hint)}</p>`);
  parts.push("</div>");
  return parts.join("\n");
}

function renderTextarea(field) {
  const id = uid("f");
  return [
    `<div class="bb-field">`,
    renderLabel(field, id),
    `<textarea class="bb-textarea" id="${id}" name="${attr(field.name)}" rows="${field.rows || 3}"` +
      (field.required ? " required" : "") +
      (field.placeholder ? ` placeholder="${attr(field.placeholder)}"` : "") +
      (field.error ? ` data-error="${attr(field.error)}"` : "") +
      `></textarea>`,
    field.hint ? `<p class="bb-hint">${esc(field.hint)}</p>` : "",
    `</div>`
  ].filter(Boolean).join("\n");
}

function renderCards(field, file) {
  if (!Array.isArray(field.options) || !field.options.length) {
    fail(file, `cards field "${field.name}" needs options`);
    return "";
  }
  const type = field.multiple ? "checkbox" : "radio";
  const slim = field.kind === "chips" ? " slim" : "";
  const cols = field.columns === 1 ? " cols-1" : field.columns === 3 ? " cols-3" : "";
  const reveals = [];

  const cards = field.options.map((opt) => {
    const value = opt.value != null ? opt.value : opt;
    const label = opt.label != null ? opt.label : value;
    let revealAttr = "";
    if (opt.reveal) {
      const rid = uid("reveal");
      revealAttr = ` data-reveals="#${rid}"`;
      reveals.push(
        `<div class="bb-reveal" id="${rid}" hidden>` +
        `<input class="bb-input" name="${attr(opt.reveal.name)}" type="text"` +
        (opt.reveal.placeholder ? ` placeholder="${attr(opt.reveal.placeholder)}"` : "") +
        ` aria-label="${attr(opt.reveal.label || label)}"></div>`
      );
    }
    return (
      `<label class="bb-card${slim}"${revealAttr}>` +
      `<input type="${type}" name="${attr(field.name)}" value="${attr(value)}">` +
      `<span class="bb-card-title">${esc(label)}</span>` +
      (opt.note ? `<span class="bb-card-note">${esc(opt.note)}</span>` : "") +
      `</label>`
    );
  }).join("\n");

  return [
    `<fieldset class="bb-field"` +
      (field.required ? ` data-group-required` : "") +
      (field.requiredUnless ? ` data-required-unless="${attr(field.requiredUnless)}"` : "") +
      (field.error ? ` data-error="${attr(field.error)}"` : "") + `>`,
    renderLabel(field, null, "legend"),
    `<div class="bb-card-grid${cols}">`,
    cards,
    `</div>`,
    reveals.join("\n"),
    field.hint ? `<p class="bb-hint">${esc(field.hint)}</p>` : "",
    `</fieldset>`
  ].filter(Boolean).join("\n");
}

function renderCheck(field) {
  const linked = field.text.replace("{privacy}", "__PRIVACY__");
  return [
    `<div class="bb-field"${field.error ? ` data-error="${attr(field.error)}"` : ""}>`,
    field.label ? renderLabel(field, null, "span") : "",
    `<label class="bb-check">`,
    `<input type="checkbox" name="${attr(field.name)}" value="${attr(field.value || "Yes")}"` +
      (field.required ? " required" : "") + ">",
    `<span class="bb-box" aria-hidden="true"></span>`,
    `<span class="bb-check-text">${esc(linked).replace("__PRIVACY__",
      `<a href="__PRIVACY_URL__">privacy notice</a>`)}</span>`,
    `</label>`,
    `</div>`
  ].filter(Boolean).join("\n");
}

function renderChecks(field) {
  const items = field.items.map((item) =>
    `<label class="bb-check">` +
    `<input type="checkbox" name="${attr(item.name)}" value="${attr(item.value || "Yes")}">` +
    `<span class="bb-box" aria-hidden="true"></span>` +
    `<span class="bb-check-text">${esc(item.text)}</span>` +
    `</label>`
  ).join("\n");
  return [
    `<fieldset class="bb-field">`,
    renderLabel(field, null, "legend"),
    items,
    field.hint ? `<p class="bb-hint">${esc(field.hint)}</p>` : "",
    `</fieldset>`
  ].join("\n");
}

function renderNote(field) {
  return `<p class="bb-caption">${esc(field.text)}</p>`;
}

function renderField(field, file) {
  switch (field.kind) {
    case "text": case "email": case "tel": case "date": return renderInput(field);
    case "textarea": return renderTextarea(field);
    case "cards": case "chips": return renderCards(field, file);
    case "check": return renderCheck(field);
    case "checks": return renderChecks(field);
    case "note": return renderNote(field);
    case "hidden":
      return `<input type="hidden" name="${attr(field.name)}" value="${attr(field.value || "")}">`;
    default:
      fail(file, `unknown field kind "${field.kind}"`);
      return "";
  }
}

/* ---------- page shells ---------- */

/* the site's header pair: legend top-left, live status top-right */
function slate(config) {
  const num = config.number ? `Nº ${config.number}` : "";
  return [
    `<header class="bb-slate">`,
    `<div class="bb-legend">Babette <em>— ${esc(config.slateLabel).toLowerCase()}</em></div>`,
    `<div class="bb-status"><span><span class="bb-dot"></span>${esc(num)}</span></div>`,
    `</header>`
  ].join("\n");
}

/* the site's fixed background wordmark + the shared SVG symbol it uses */
const MARK_SYMBOL = fs.readFileSync(path.join(KIT_DIR, "babette-mark.svg.html"), "utf8").trim();
function bgmark() {
  return [
    MARK_SYMBOL,
    `<div class="bb-bgmark" aria-hidden="true">`,
    `<svg viewBox="0 0 1244 380" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><use href="#babette-mark"/></svg>`,
    `</div>`
  ].join("\n");
}

function masthead(config) {
  const lines = (config.heading || []).map((line, i) =>
    config.headingAccent === i ? `<span class="accent">${esc(line)}</span>` : esc(line)
  ).join("<br>");
  const greeting = config.personalization
    ? `<p class="bb-greeting" hidden data-personalize="${attr(config.personalization.param)}">` +
      `${esc(config.personalization.prefix || "For ")}<span class="name"></span>${esc(config.personalization.suffix || " —")}</p>`
    : "";
  return [
    `<section class="bb-masthead">`,
    `<h1 class="bb-display">${lines}</h1>`,
    greeting,
    config.intro ? `<p class="bb-intro">${esc(config.intro)}</p>` : "",
    config.caption ? `<p class="bb-caption">${esc(config.caption)}</p>` : "",
    `</section>`
  ].filter(Boolean).join("\n");
}

function footer(config) {
  const links = [`<a class="bb-wick" href="${attr(config.privacyUrl || "#")}">Privacy</a>`];
  if (config.homeUrl) links.unshift(`<a class="bb-wick" href="${attr(config.homeUrl)}">haveyoumetbabette.com</a>`);
  return [
    `<footer class="bb-foot">`,
    `<p class="bb-signoff">Have You Met Babette?</p>`,
    `<nav class="bb-foot-links">${links.join("\n")}</nav>`,
    `</footer>`
  ].join("\n");
}

function successTakeover(config) {
  const s = config.success || {};
  return [
    `<div class="bb-success" role="status" hidden>`,
    `<div class="bb-success-inner">`,
    `<p class="bb-success-slate">Received</p>`,
    `<p class="bb-success-msg">${esc(s.message || "Enchanté. We’ll be in touch within two days.")}</p>`,
    `<div class="bb-gold-rule"></div>`,
    `<p class="bb-success-sub">${esc(s.sub || "HAVE YOU MET BABETTE?")}</p>`,
    `</div>`,
    `</div>`
  ].join("\n");
}

function shell(config, body) {
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(config.title)}</title>
<meta name="description" content="${attr(config.metaDescription || "")}">
<meta name="robots" content="${attr(config.robots || "index,follow")}">
<link rel="icon" href="data:,">
<link rel="preload" href="../kit/fonts/CormorantGaramond-Italic-Var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="../kit/fonts/Inter-Var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="../kit/babette.css">
</head>
<body class="bb-page">
${body}
</body>
</html>
`;
}

/* ---------- form page ---------- */

function buildFormPage(config, file) {
  const steps = config.steps || [];
  const multi = steps.length > 1;

  const stepsHtml = steps.map((step, i) => {
    const num = String(i + 1).padStart(2, "0");
    const fields = (step.fields || []).map((f) => renderField(f, file)).join("\n\n");
    return [
      `<section class="bb-step${i === 0 ? " is-active" : ""}" aria-label="${attr(step.marker)}">`,
      `<header class="bb-step-head"><span class="bb-step-marker"><span class="num">${num}</span> — ${esc(step.marker)}</span></header>`,
      fields,
      `</section>`
    ].join("\n");
  }).join("\n\n");

  const captures = (config.captureParams || []).map((p) =>
    `<input type="hidden" name="${attr(p)}" data-capture-param="${attr(p)}">`
  ).join("\n");

  const nav = [
    `<div class="bb-nav">`,
    multi ? `<button type="button" class="bb-btn ghost bb-back">← Back</button>` : `<span></span>`,
    multi ? `<button type="button" class="bb-btn bb-next">Continue →</button>` : "",
    `<button type="submit" class="bb-btn bb-submit"${multi ? ` style="display:none"` : ""}>${esc(config.submitLabel || "Send")}</button>`,
    `</div>`
  ].filter(Boolean).join("\n");

  const body = [
    multi ? `<div class="bb-progress" aria-hidden="true"><span></span></div>` : "",
    bgmark(),
    slate(config),
    `<main class="bb-main">`,
    masthead(config),
    `<form class="bb-form" novalidate`,
    `  data-endpoint="${attr(config.endpoint || "")}"`,
    `  data-subject="${attr(config.subject || config.title)}"`,
    config.cc ? `  data-cc="${attr(config.cc)}"` : "",
    `  data-fallback-email="${attr(config.fallbackEmail || "ozy@haveyoumetbabette.com")}">`,
    `<p class="bb-form-alert" role="alert" hidden></p>`,
    `<input type="hidden" name="form" value="${attr(config.slug)}">`,
    captures,
    `<input class="bb-hp" type="text" name="bb_website" tabindex="-1" autocomplete="off" aria-hidden="true">`,
    stepsHtml,
    nav,
    `</form>`,
    `</main>`,
    footer(config),
    successTakeover(config),
    `<script src="../kit/babette-forms.js"></script>`
  ].filter(Boolean).join("\n")
   .replace(/__PRIVACY_URL__/g, attr(config.privacyUrl || "#"));

  return shell(config, body);
}

/* ---------- links (bio hub) page ---------- */

function buildLinksPage(config) {
  const rows = (config.links || []).map((link, i) =>
    `<a class="bb-link-row" href="${attr(link.href)}">` +
    `<span class="bb-link-num">${String(i + 1).padStart(2, "0")}</span>` +
    `<span class="bb-link-body"><span class="bb-link-title">${esc(link.title)}</span>` +
    (link.note ? `<div class="bb-link-note">${esc(link.note)}</div>` : "") +
    `</span><span class="bb-link-arrow">→</span></a>`
  ).join("\n");

  const body = [
    bgmark(),
    slate(config),
    `<main class="bb-main">`,
    masthead(config),
    `<nav class="bb-links">`,
    rows,
    `</nav>`,
    `</main>`,
    footer(config)
  ].join("\n");

  return shell(config, body);
}

/* ---------- dist index (internal preview directory) ---------- */

function buildIndex(entries) {
  const rows = entries.map((e) =>
    `<li><a href="${attr(e.slug)}/"><span class="num">${esc(e.number || "—")}</span> ${esc(e.slateLabel || e.slug)}</a></li>`
  ).join("\n");
  const config = {
    title: "Babette — The Enquiry Suite",
    slateLabel: "THE SUITE",
    number: "000",
    robots: "noindex",
    heading: ["THE", "ENQUIRY", "SUITE"],
    intro: "Every page in the system. Internal directory — not for the public.",
  };
  const body = [
    bgmark(),
    slate(config),
    `<main class="bb-main">`,
    masthead(config),
    `<ul class="bb-index-list">`,
    rows,
    `</ul>`,
    `</main>`,
    footer({}),
  ].join("\n");
  return shell(config, body).replace(/\.\.\/kit\//g, "kit/");
}

/* ---------- main ---------- */

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    entry.isDirectory() ? copyDir(from, to) : fs.copyFileSync(from, to);
  }
}

function main() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  copyDir(KIT_DIR, path.join(DIST, "kit"));

  const files = fs.readdirSync(FORMS_DIR).filter((f) => f.endsWith(".json")).sort();
  const entries = [];

  for (const file of files) {
    let config;
    try {
      config = JSON.parse(fs.readFileSync(path.join(FORMS_DIR, file), "utf8"));
    } catch (e) {
      fail(file, `invalid JSON — ${e.message}`);
      continue;
    }
    if (!config.slug || !config.title) { fail(file, "config needs slug + title"); continue; }

    const html = config.type === "links" ? buildLinksPage(config) : buildFormPage(config, file);
    const dir = path.join(DIST, config.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), html);
    entries.push(config);
    console.log(`✓ ${file} → dist/${config.slug}/index.html`);
  }

  entries.sort((a, b) => String(a.number || "").localeCompare(String(b.number || "")));
  fs.writeFileSync(path.join(DIST, "index.html"), buildIndex(entries));
  console.log(`✓ dist/index.html (directory)`);

  /* social studio: one self-contained file — fonts inlined so PNG export
     works from file://, card markup/css/script injected from the canonical
     template so the studio can never drift from render.js output */
  const studioSrc = path.join(SOCIAL_DIR, "studio-template.html");
  if (fs.existsSync(studioSrc)) {
    const cardHtml = fs.readFileSync(path.join(SOCIAL_DIR, "templates", "card.html"), "utf8");
    const cardCss = fs.readFileSync(path.join(SOCIAL_DIR, "templates", "card.css"), "utf8");
    const between = (s, a, b) => {
      const i = s.indexOf(a), j = s.indexOf(b);
      if (i === -1 || j === -1) throw new Error(`card.html markers ${a}…${b} not found`);
      return s.slice(i + a.length, j);
    };
    const studio = fs.readFileSync(studioSrc, "utf8")
      .replace("/*__FONTS_CSS__*/", buildInlineFontsCss())
      .replace("/*__CARD_CSS__*/", cardCss)
      .replace("<!--__CARD_MARKUP__-->", between(cardHtml, "<!--CARD-->", "<!--/CARD-->"))
      .replace("/*__CARD_SCRIPT__*/", between(cardHtml, "/*CARD-SCRIPT*/", "/*/CARD-SCRIPT*/"));
    const dir = path.join(DIST, "studio");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), studio);
    fs.writeFileSync(path.join(SOCIAL_DIR, "studio.html"), studio);
    console.log(`✓ social/studio-template.html → dist/studio/index.html (+ social/studio.html)`);
  }
}

function buildInlineFontsCss() {
  const font = (file) =>
    fs.readFileSync(path.join(KIT_DIR, "fonts", file)).toString("base64");
  return `
@font-face{font-family:"Cormorant Garamond";src:url(data:font/woff2;base64,${font("CormorantGaramond-Italic-Var.woff2")}) format("woff2");font-style:italic;font-weight:300 700;font-display:block;}
@font-face{font-family:"Inter";src:url(data:font/woff2;base64,${font("Inter-Var.woff2")}) format("woff2");font-weight:100 900;font-display:block;}
`;
}

main();
