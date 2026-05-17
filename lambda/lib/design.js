// ============================================================================
// design.js — Composable resume design engine
//
// The 15 entries in templates.js are kept as named *presets*. A design is
// resolved to:
//   { tmpl, elements, sectionOrder, sectionVisibility, density, isPreset }
//
// - `tmpl` is the exact shape docx-builder.js already consumes. For a preset
//   it is a deep clone of TEMPLATES[id] (byte-identical → regression-locked).
// - `elements` / `sectionOrder` / `sectionVisibility` carry the NEW composable
//   behavior. Defaults are all-off / legacy order so presets render unchanged.
//
// composeDesign(seed, overrides) deterministically assembles a coherent unique
// design from design tokens (no fixed template).
// ============================================================================

const { TEMPLATES } = require("./templates");

// ── Legacy section order (preset default — must not change preset output) ──
const DEFAULT_SECTION_ORDER = [
  "contact",
  "summary",
  "skills",
  "experience",
  "education",
  "certifications",
];

const ALL_SECTIONS = [
  "contact",
  "summary",
  "skills",
  "experience",
  "projects",
  "education",
  "certifications",
];

// Element defaults: every visual extra OFF ⇒ preset output is unchanged.
function defaultElements() {
  return {
    skillBars: false,
    headshot: false,
    icons: false,
    dividers: false,
    callout: false,
  };
}

function defaultSectionVisibility() {
  return {
    contact: true,
    summary: true,
    skills: true,
    experience: true,
    projects: false,
    education: true,
    certifications: true,
  };
}

// ── Design tokens (sourced from values already used across TEMPLATES) ──

const PALETTES = {
  ink:      { primary: "000000", accent: "000000", bodyText: "333333", subtleText: "666666", sidebarBg: "1B2A4A", sidebarText: "FFFFFF" },
  teal:     { primary: "1A7A7A", accent: "1A7A7A", bodyText: "333333", subtleText: "666666", sidebarBg: "1A7A7A", sidebarText: "FFFFFF" },
  royal:    { primary: "2B579A", accent: "2B579A", bodyText: "333333", subtleText: "666666", sidebarBg: "F0F4F8", sidebarText: "333333" },
  navy:     { primary: "1B2A4A", accent: "1B2A4A", bodyText: "333333", subtleText: "555555", sidebarBg: "1B2A4A", sidebarText: "FFFFFF" },
  amber:    { primary: "B8860B", accent: "B8860B", bodyText: "333333", subtleText: "666666", sidebarBg: "2D2D2D", sidebarText: "FFFFFF" },
  maroon:   { primary: "8B0000", accent: "8B0000", bodyText: "333333", subtleText: "666666", sidebarBg: "8B0000", sidebarText: "FFFFFF" },
  slate:    { primary: "444444", accent: "444444", bodyText: "333333", subtleText: "777777", sidebarBg: "2D2D2D", sidebarText: "FFFFFF" },
  sky:      { primary: "4A90D9", accent: "4A90D9", bodyText: "333333", subtleText: "666666", sidebarBg: "2D2D2D", sidebarText: "FFFFFF" },
};

// Heading + body font pairings, with normal and compact size scales.
const TYPOGRAPHY = {
  "calibri-clean": {
    headingFace: "Calibri", bodyFace: "Calibri",
    sizes: {
      normal:  { name: 28, contact: 20, sectionHeading: 22, company: 21, title: 21, body: 20, skillsCategory: 20, skillsItems: 20, education: 20 },
      compact: { name: 24, contact: 18, sectionHeading: 20, company: 19, title: 19, body: 18, skillsCategory: 18, skillsItems: 18, education: 18 },
    },
  },
  "georgia-serif": {
    headingFace: "Georgia", bodyFace: "Calibri",
    sizes: {
      normal:  { name: 28, contact: 20, sectionHeading: 22, company: 21, title: 21, body: 20, skillsCategory: 20, skillsItems: 20, education: 20 },
      compact: { name: 24, contact: 18, sectionHeading: 20, company: 19, title: 19, body: 18, skillsCategory: 18, skillsItems: 18, education: 18 },
    },
  },
  "georgia-exec": {
    headingFace: "Georgia", bodyFace: "Calibri",
    sizes: {
      normal:  { name: 30, contact: 20, sectionHeading: 22, company: 21, title: 21, body: 20, skillsCategory: 20, skillsItems: 20, education: 20 },
      compact: { name: 26, contact: 18, sectionHeading: 20, company: 19, title: 19, body: 18, skillsCategory: 18, skillsItems: 18, education: 18 },
    },
  },
};

// Single-column is the ATS-safe default. Each variant differs only in the
// name/contact header treatment — the body stays a clean single column.
const SINGLE_VARIANTS = {
  "single-centered": { nameAlignment: "CENTER", headerTreatment: "centered" },
  "single-left":     { nameAlignment: "LEFT",   headerTreatment: "left" },
  "single-split":    { nameAlignment: "LEFT",   headerTreatment: "split" },
  "single-banner":   { nameAlignment: "CENTER", headerTreatment: "banner" },
};
// Two-column is kept but is an explicit opt-in (ATS-risky).
const TWO_COLUMN = ["two-column-left", "two-column-right"];
const LAYOUTS = [...Object.keys(SINGLE_VARIANTS), ...TWO_COLUMN];

// Back-compat aliases for older payloads / saved specs.
const LAYOUT_ALIASES = { "single-column": "single-centered", single: "single-centered" };

function isTwoColumn(layout) {
  return TWO_COLUMN.includes(layout);
}
function resolveLayout(layout) {
  if (LAYOUT_ALIASES[layout]) return LAYOUT_ALIASES[layout];
  return LAYOUTS.includes(layout) ? layout : "single-centered";
}

const HEADER_STYLES = ["plain", "bottom-border", "top-bottom", "shading", "thick-bottom"];

// Density → page margins + section-header spacing + size scale.
const DENSITY = {
  standard: { margins: { top: 720, bottom: 720, left: 1080, right: 1080 }, scale: "normal",  spacing: { before: 260, after: 100 } },
  xl:       { margins: { top: 576, bottom: 576, left: 720,  right: 720  }, scale: "normal",  spacing: { before: 220, after: 90  } },
  extended: { margins: { top: 540, bottom: 540, left: 720,  right: 720  }, scale: "compact", spacing: { before: 200, after: 80  } },
};

// ── Seeded PRNG (deterministic composition) ──

function hashSeed(str) {
  let h = 1779033703 ^ String(str).length;
  for (let i = 0; i < String(str).length; i++) {
    h = Math.imul(h ^ String(str).charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// ── Build a tmpl object from composable tokens ──

function lightenFill(hex) {
  // Derive a soft section-header background from an accent color.
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const mix = (c) => Math.round(c + (255 - c) * 0.86)
    .toString(16)
    .padStart(2, "0");
  return (mix(r) + mix(g) + mix(b)).toUpperCase();
}

function buildFonts(typographyKey, scaleName) {
  const t = TYPOGRAPHY[typographyKey];
  const s = t.sizes[scaleName] || t.sizes.normal;
  return {
    name:           { face: t.headingFace, size: s.name },
    contact:        { face: t.bodyFace,    size: s.contact },
    sectionHeading: { face: t.headingFace, size: s.sectionHeading, allCaps: true },
    company:        { face: t.bodyFace,    size: s.company },
    title:          { face: t.bodyFace,    size: s.title },
    body:           { face: t.bodyFace,    size: s.body },
    skillsCategory: { face: t.bodyFace,    size: s.skillsCategory },
    skillsItems:    { face: t.bodyFace,    size: s.skillsItems },
    education:      { face: t.bodyFace,    size: s.education },
  };
}

function buildSectionHeader(headerStyle, palette, spacing) {
  const h = {
    bottomBorder: null,
    topBorder: null,
    shading: null,
    spacing: { ...spacing },
  };
  switch (headerStyle) {
    case "bottom-border":
      h.bottomBorder = { style: "single", color: palette.accent, size: 6 };
      break;
    case "thick-bottom":
      h.bottomBorder = { style: "single", color: palette.accent, size: 10 };
      break;
    case "top-bottom":
      h.bottomBorder = { style: "single", color: palette.accent, size: 4 };
      h.topBorder = { style: "single", color: palette.accent, size: 4 };
      break;
    case "shading":
      h.shading = { fill: lightenFill(palette.accent) };
      break;
    case "plain":
    default:
      break;
  }
  return h;
}

function buildSidebar(layout) {
  if (layout === "two-column-left") {
    return {
      position: "left",
      widthDxa: 3200,
      mainWidthDxa: 7200,
      sidebarSections: ["contact", "skills", "education"],
      mainSections: ["summary", "experience"],
    };
  }
  if (layout === "two-column-right") {
    return {
      position: "right",
      widthDxa: 3200,
      mainWidthDxa: 7200,
      sidebarSections: ["contact", "skills", "education"],
      mainSections: ["summary", "experience"],
    };
  }
  return null;
}

function specToTmpl(spec) {
  // Preset path: byte-identical clone of the original template object.
  if (spec.isPreset) {
    return JSON.parse(JSON.stringify(TEMPLATES[spec.presetId]));
  }

  const palette = PALETTES[spec.palette] || PALETTES.royal;
  const density = DENSITY[spec.density] || DENSITY.standard;
  const layout = resolveLayout(spec.layout);
  const isTwoCol = isTwoColumn(layout);
  const variant = SINGLE_VARIANTS[layout];

  // Two-column layouts flush the sidebar to the page edge (mirrors presets).
  let margins = { ...density.margins };
  if (layout === "two-column-left") margins = { ...margins, left: 0 };
  if (layout === "two-column-right") margins = { ...margins, right: 0 };

  return {
    id: "__composed__",
    name: "Composed",
    layout: isTwoCol ? "two-column" : "single-column",
    atsWarning: isTwoCol || !!spec.elements.headshot || !!spec.elements.icons,
    description: "Composed design",
    colors: {
      primary: palette.primary,
      accent: palette.accent,
      bodyText: palette.bodyText,
      subtleText: palette.subtleText,
      sidebarBg: isTwoCol ? palette.sidebarBg : null,
      sidebarText: isTwoCol ? palette.sidebarText : null,
    },
    fonts: buildFonts(spec.typography, density.scale),
    sectionHeader: buildSectionHeader(spec.headerStyle, palette, density.spacing),
    page: { margins },
    nameAlignment: spec.nameAlignment || (variant ? variant.nameAlignment : "LEFT"),
    sidebar: buildSidebar(layout),
  };
}

// ── Resolve any input (preset name | spec object | undefined) to a design ──

function isPresetName(input) {
  return typeof input === "string" && Object.prototype.hasOwnProperty.call(TEMPLATES, input);
}

function normalizeSpec(spec) {
  const layout = resolveLayout(spec.layout);
  const variant = SINGLE_VARIANTS[layout];
  return {
    isPreset: false,
    palette: PALETTES[spec.palette] ? spec.palette : "royal",
    typography: TYPOGRAPHY[spec.typography] ? spec.typography : "calibri-clean",
    layout,
    headerTreatment: variant ? variant.headerTreatment : "left",
    headerStyle: HEADER_STYLES.includes(spec.headerStyle) ? spec.headerStyle : "bottom-border",
    density: DENSITY[spec.density] ? spec.density : "standard",
    nameAlignment: spec.nameAlignment === "CENTER" || spec.nameAlignment === "LEFT" ? spec.nameAlignment : null,
    elements: { ...defaultElements(), ...(spec.elements || {}) },
    sectionVisibility: { ...defaultSectionVisibility(), ...(spec.sectionVisibility || {}) },
    sectionOrder: Array.isArray(spec.sectionOrder) && spec.sectionOrder.length
      ? spec.sectionOrder.filter((s) => ALL_SECTIONS.includes(s))
      : DEFAULT_SECTION_ORDER.slice(),
  };
}

function presetDesign(presetId) {
  return {
    isPreset: true,
    presetId,
    headerTreatment: "centered",
    elements: defaultElements(),
    sectionVisibility: defaultSectionVisibility(),
    sectionOrder: DEFAULT_SECTION_ORDER.slice(),
  };
}

// composeDesign(seed, overrides): deterministic, coherent unique design.
function composeDesign(seed, overrides = {}) {
  const rng = mulberry32(hashSeed(seed == null ? "resumex" : seed));

  // ATS-safe by default: compose only picks single-column variants. A user can
  // still explicitly opt into two-column via `overrides.layout`.
  const layout = pick(rng, Object.keys(SINGLE_VARIANTS));
  const palette = pick(rng, Object.keys(PALETTES));
  const typography = pick(rng, Object.keys(TYPOGRAPHY));
  const headerStyle = pick(rng, HEADER_STYLES);

  const spec = {
    palette,
    typography,
    layout,
    headerStyle,
    density: "extended",
    // Default compose stays strictly ATS-safe: no tables (skill bands /
    // callout), no icons, no headshot. Only paragraph-border dividers vary.
    // The richer elements remain available via explicit customization.
    elements: {
      ...defaultElements(),
      dividers: rng() < 0.5,
    },
  };

  // User overrides win over composed choices.
  return normalizeSpec({ ...spec, ...overrides, elements: { ...spec.elements, ...(overrides.elements || {}) } });
}

function resolveDesign(input) {
  if (input == null) return presetDesign("classic");
  if (isPresetName(input)) return presetDesign(input);
  if (typeof input === "object") {
    if (input.compose) return composeDesign(input.seed, input.overrides || input);
    return normalizeSpec(input);
  }
  // Unknown string → fall back to the classic preset (backward compatible).
  return presetDesign("classic");
}

module.exports = {
  TEMPLATES,
  PALETTES,
  TYPOGRAPHY,
  LAYOUTS,
  SINGLE_VARIANTS,
  TWO_COLUMN,
  isTwoColumn,
  HEADER_STYLES,
  DENSITY,
  ALL_SECTIONS,
  DEFAULT_SECTION_ORDER,
  defaultElements,
  defaultSectionVisibility,
  resolveDesign,
  composeDesign,
  normalizeSpec,
  specToTmpl,
};
