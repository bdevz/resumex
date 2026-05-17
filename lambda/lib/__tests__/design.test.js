const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { TEMPLATES } = require("../templates");
const {
  resolveDesign,
  composeDesign,
  specToTmpl,
  normalizeSpec,
  PALETTES,
  TYPOGRAPHY,
  LAYOUTS,
  HEADER_STYLES,
  DENSITY,
  DEFAULT_SECTION_ORDER,
} = require("../design");

describe("preset designs are regression-locked", () => {
  for (const presetId of Object.keys(TEMPLATES)) {
    it(`specToTmpl(resolveDesign("${presetId}")) deep-equals TEMPLATES["${presetId}"]`, () => {
      const design = resolveDesign(presetId);
      assert.equal(design.isPreset, true);
      assert.equal(design.presetId, presetId);
      assert.deepEqual(specToTmpl(design), TEMPLATES[presetId]);
    });
  }

  it("undefined input falls back to the classic preset", () => {
    assert.deepEqual(specToTmpl(resolveDesign(undefined)), TEMPLATES.classic);
  });

  it("unknown string falls back to the classic preset", () => {
    assert.deepEqual(specToTmpl(resolveDesign("does-not-exist")), TEMPLATES.classic);
  });

  it("presets carry legacy section order and all elements off", () => {
    const d = resolveDesign("classic");
    assert.deepEqual(d.sectionOrder, DEFAULT_SECTION_ORDER);
    assert.deepEqual(d.elements, {
      skillBars: false, headshot: false, icons: false, dividers: false, callout: false,
    });
  });
});

describe("composeDesign is deterministic and coherent", () => {
  it("same seed → identical spec", () => {
    assert.deepEqual(composeDesign("alpha"), composeDesign("alpha"));
  });

  it("different seeds → generally different specs", () => {
    const seeds = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const sigs = new Set(
      seeds.map((s) => JSON.stringify(composeDesign(s)))
    );
    assert.ok(sigs.size > 1, "composition should vary across seeds");
  });

  it("only emits known tokens", () => {
    for (const s of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]) {
      const d = composeDesign(s);
      assert.ok(PALETTES[d.palette], `palette ${d.palette}`);
      assert.ok(TYPOGRAPHY[d.typography], `typography ${d.typography}`);
      assert.ok(LAYOUTS.includes(d.layout), `layout ${d.layout}`);
      assert.ok(HEADER_STYLES.includes(d.headerStyle), `headerStyle ${d.headerStyle}`);
      assert.ok(DENSITY[d.density], `density ${d.density}`);
    }
  });

  it("user overrides win over composed choices", () => {
    const d = composeDesign("alpha", { palette: "maroon", layout: "two-column-left", elements: { skillBars: true } });
    assert.equal(d.palette, "maroon");
    assert.equal(d.layout, "two-column-left");
    assert.equal(d.elements.skillBars, true);
  });

  it("composed spec produces a renderable tmpl shape", () => {
    const tmpl = specToTmpl(composeDesign("xyz"));
    for (const k of ["colors", "fonts", "sectionHeader", "page", "nameAlignment", "layout"]) {
      assert.ok(k in tmpl, `tmpl missing ${k}`);
    }
    assert.ok(tmpl.fonts.body.face && tmpl.fonts.body.size);
    assert.ok(/^[0-9A-F]{6}$/i.test(tmpl.colors.primary));
  });
});

describe("normalizeSpec fills defaults and honors section order/visibility", () => {
  it("invalid tokens fall back to defaults", () => {
    const d = normalizeSpec({ palette: "nope", layout: "nope", typography: "nope" });
    assert.equal(d.palette, "royal");
    assert.equal(d.layout, "single-centered");
    assert.equal(d.typography, "calibri-clean");
  });

  it("custom section order is preserved (filtered to known sections)", () => {
    const d = normalizeSpec({ sectionOrder: ["summary", "experience", "bogus", "skills"] });
    assert.deepEqual(d.sectionOrder, ["summary", "experience", "skills"]);
  });

  it("section visibility merges over defaults", () => {
    const d = normalizeSpec({ sectionVisibility: { projects: true, education: false } });
    assert.equal(d.sectionVisibility.projects, true);
    assert.equal(d.sectionVisibility.education, false);
    assert.equal(d.sectionVisibility.experience, true);
  });

  it("headshot/icons mark the composed tmpl as ATS-warning", () => {
    const tmpl = specToTmpl(normalizeSpec({ layout: "single-column", elements: { icons: true } }));
    assert.equal(tmpl.atsWarning, true);
  });
});

describe("single-column is the ATS-safe default", () => {
  const { SINGLE_VARIANTS, TWO_COLUMN, isTwoColumn } = require("../design");

  it("composeDesign only ever picks single-column variants", () => {
    for (let i = 0; i < 60; i++) {
      const d = composeDesign("seed-" + i);
      assert.ok(SINGLE_VARIANTS[d.layout], `compose returned non-single layout: ${d.layout}`);
      assert.ok(!isTwoColumn(d.layout));
      assert.equal(specToTmpl(d).layout, "single-column");
      assert.equal(specToTmpl(d).atsWarning, false, "default compose must be ATS-safe");
    }
  });

  it("composed default targets a 4-5 page (extended) design", () => {
    assert.equal(composeDesign("x").density, "extended");
  });

  it("each single variant maps to a header treatment + alignment", () => {
    for (const [name, v] of Object.entries(SINGLE_VARIANTS)) {
      const d = normalizeSpec({ layout: name });
      assert.equal(d.headerTreatment, v.headerTreatment);
      assert.equal(specToTmpl(d).nameAlignment, v.nameAlignment);
      assert.equal(specToTmpl(d).layout, "single-column");
    }
  });

  it("legacy 'single-column' / 'single' aliases resolve to a single variant", () => {
    assert.equal(normalizeSpec({ layout: "single-column" }).layout, "single-centered");
    assert.equal(normalizeSpec({ layout: "single" }).layout, "single-centered");
  });

  it("two-column stays available as an explicit opt-in (with ATS warning)", () => {
    const d = normalizeSpec({ layout: "two-column-left" });
    assert.ok(isTwoColumn(d.layout));
    const tmpl = specToTmpl(d);
    assert.equal(tmpl.layout, "two-column");
    assert.equal(tmpl.atsWarning, true);
    assert.ok(tmpl.sidebar);
  });
});
