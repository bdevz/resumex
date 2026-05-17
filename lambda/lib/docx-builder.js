// ============================================================================
// docx-builder.js — Generate DOCX resumes with multiple template support
// ============================================================================

const {
  Document, Packer, Paragraph, TextRun, TabStopType, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  VerticalAlign, ImageRun,
} = require("docx");
const config = require("./config");
const { TEMPLATES } = require("./templates");
const { resolveDesign, specToTmpl } = require("./design");

// ── Utilities ──

function isDarkColor(hex) {
  if (!hex) return false;
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  return (r * 0.299 + g * 0.587 + b * 0.114) < 128;
}

function getAlignment(tmpl) {
  if (tmpl.nameAlignment === "LEFT") return AlignmentType.LEFT;
  return AlignmentType.CENTER;
}

const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

// ── Paragraph Builders (all accept tmpl for styling) ──

function createNameHeader(contact, tmpl, colorOverride) {
  const f = tmpl.fonts.name;
  return new Paragraph({
    alignment: getAlignment(tmpl),
    children: [
      new TextRun({
        text: contact.name,
        font: f.face,
        size: f.size,
        bold: true,
        color: colorOverride || tmpl.colors.primary,
      }),
    ],
  });
}

function createContactLine(contact, tmpl, colorOverride) {
  const f = tmpl.fonts.contact;
  const parts = [contact.phone, contact.email, contact.linkedin, contact.github].filter(Boolean);
  return new Paragraph({
    alignment: getAlignment(tmpl),
    children: [
      new TextRun({
        text: parts.join(" \u2022 "),
        font: f.face,
        size: f.size,
        color: colorOverride || tmpl.colors.subtleText,
      }),
    ],
    spacing: { after: 40 },
  });
}

function createSectionHeader(title, tmpl, colorOverride) {
  const f = tmpl.fonts.sectionHeading;
  const dec = tmpl.sectionHeader;
  const displayText = f.allCaps ? title.toUpperCase() : title;

  const opts = {
    children: [
      new TextRun({
        text: displayText,
        font: f.face,
        size: f.size,
        bold: true,
        color: colorOverride || tmpl.colors.primary,
      }),
    ],
    spacing: dec.spacing,
  };

  // Build border object from template config
  const border = {};
  if (dec.bottomBorder) {
    border.bottom = {
      style: BorderStyle.SINGLE,
      color: colorOverride || dec.bottomBorder.color,
      size: dec.bottomBorder.size,
      space: 1,
    };
  }
  if (dec.topBorder) {
    border.top = {
      style: BorderStyle.SINGLE,
      color: colorOverride || dec.topBorder.color,
      size: dec.topBorder.size,
      space: 1,
    };
  }
  if (Object.keys(border).length > 0) {
    opts.border = border;
  }

  // Shading (colored background bar on section headers)
  if (dec.shading) {
    opts.shading = {
      type: ShadingType.CLEAR,
      fill: dec.shading.fill,
      color: "auto",
    };
  }

  return new Paragraph(opts);
}

function createParagraph(text, tmpl, colorOverride) {
  const f = tmpl.fonts.body;
  return new Paragraph({
    children: [
      new TextRun({
        text,
        font: f.face,
        size: f.size,
        color: colorOverride || tmpl.colors.bodyText,
      }),
    ],
    spacing: { after: 120 },
  });
}

// Certifications: rendered only when the LLM emitted a non-empty list
// (the "Add certifications" flag is on). Absent ⇒ section omitted entirely.
function createCertificationsBlock(certs, tmpl, colorOverride) {
  if (!Array.isArray(certs) || certs.length === 0) return [];
  return [
    createSpacing(),
    createSectionHeader(config.ATS_HEADERS.certifications, tmpl, colorOverride),
    createParagraph(certs.join("  •  "), tmpl, colorOverride),
  ];
}

function createSpacing() {
  return new Paragraph({
    children: [new TextRun({ text: "" })],
    spacing: { after: 120 },
  });
}

function createSkillsSection(skills, tmpl, colorOverride) {
  const paragraphs = [];
  const fCat = tmpl.fonts.skillsCategory;
  const fItems = tmpl.fonts.skillsItems;

  for (const [category, items] of Object.entries(skills)) {
    if (items && items.trim()) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${category}: `,
              font: fCat.face,
              size: fCat.size,
              bold: true,
              color: colorOverride || tmpl.colors.bodyText,
            }),
            new TextRun({
              text: items,
              font: fItems.face,
              size: fItems.size,
              color: colorOverride || tmpl.colors.bodyText,
            }),
          ],
          spacing: { after: 80 },
        })
      );
    }
  }

  return paragraphs;
}

function createExperienceSection(experience, tmpl, colorOverride) {
  const paragraphs = [];
  const fCompany = tmpl.fonts.company;
  const fTitle = tmpl.fonts.title;
  const fBody = tmpl.fonts.body;
  const textColor = colorOverride || tmpl.colors.bodyText;

  // Calculate right tab position from page content width
  const margins = tmpl.page.margins;
  const contentWidth = 12240 - margins.left - margins.right;
  // For two-column templates, right tab needs to fit in the main column
  const rightTab = tmpl.sidebar ? tmpl.sidebar.mainWidthDxa - 400 : contentWidth;

  for (const exp of experience) {
    // Company + dates line
    const companyPara = {
      tabStops: [{ type: TabStopType.RIGHT, position: rightTab }],
      children: [
        new TextRun({
          text: exp.company,
          font: fCompany.face,
          size: fCompany.size,
          bold: true,
          color: colorOverride || tmpl.colors.primary,
        }),
        new TextRun({
          text: `\t${exp.start_date} \u2014 ${exp.end_date}`,
          font: fBody.face,
          size: fBody.size,
          color: textColor,
        }),
      ],
      spacing: { before: 120, after: 40 },
    };

    // Timeline template: left border on experience entries
    if (tmpl.id === "timeline") {
      companyPara.border = {
        left: {
          style: BorderStyle.SINGLE,
          color: tmpl.colors.accent,
          size: 6,
          space: 8,
        },
      };
      companyPara.indent = { left: 120 };
    }

    paragraphs.push(new Paragraph(companyPara));

    // Title + location
    const titleOpts = {
      children: [
        new TextRun({
          text: `${exp.title} \u2022 ${exp.location}`,
          font: fTitle.face,
          size: fTitle.size,
          italics: true,
          color: textColor,
        }),
      ],
      spacing: { after: 80 },
    };

    if (tmpl.id === "timeline") {
      titleOpts.border = {
        left: {
          style: BorderStyle.SINGLE,
          color: tmpl.colors.accent,
          size: 6,
          space: 8,
        },
      };
      titleOpts.indent = { left: 120 };
    }

    paragraphs.push(new Paragraph(titleOpts));

    // Bullets
    for (const bullet of exp.bullets || []) {
      const bulletOpts = {
        children: [
          new TextRun({
            text: `\u2022 ${bullet}`,
            font: fBody.face,
            size: fBody.size,
            color: textColor,
          }),
        ],
        spacing: { after: 60 },
        indent: { left: 360 },
      };

      if (tmpl.id === "timeline") {
        bulletOpts.border = {
          left: {
            style: BorderStyle.SINGLE,
            color: tmpl.colors.accent,
            size: 6,
            space: 8,
          },
        };
        bulletOpts.indent = { left: 480 };
      }

      paragraphs.push(new Paragraph(bulletOpts));
    }
  }

  return paragraphs;
}

function createEducationSection(education, tmpl, colorOverride) {
  const paragraphs = [];
  const fCompany = tmpl.fonts.company;
  const fEdu = tmpl.fonts.education;
  const textColor = colorOverride || tmpl.colors.bodyText;

  const margins = tmpl.page.margins;
  const contentWidth = 12240 - margins.left - margins.right;
  const rightTab = tmpl.sidebar ? tmpl.sidebar.mainWidthDxa - 400 : contentWidth;

  // Dynamic education array (from optimize mode or LLM output)
  if (education && Array.isArray(education) && education.length > 0) {
    for (const edu of education) {
      const dates = edu.graduated || edu.end_date || "";
      paragraphs.push(
        new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: rightTab }],
          children: [
            new TextRun({
              text: edu.school || "",
              font: fCompany.face,
              size: fCompany.size,
              bold: true,
              color: colorOverride || tmpl.colors.primary,
            }),
            new TextRun({
              text: dates ? `\t${dates}` : "",
              font: fEdu.face,
              size: fEdu.size,
              color: textColor,
            }),
          ],
          spacing: { before: 120, after: 40 },
        })
      );

      const detail = [edu.degree, edu.location].filter(Boolean).join(" \u2022 ");
      if (detail) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: detail,
                font: fEdu.face,
                size: fEdu.size,
                italics: true,
                color: textColor,
              }),
            ],
            spacing: { after: 80 },
          })
        );
      }
    }
    return paragraphs;
  }

  // Fallback: hardcoded education from config (generate mode)
  for (const level of ["masters", "bachelors"]) {
    const edu = config.EDUCATION[level];
    if (!edu) continue;

    paragraphs.push(
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: rightTab }],
        children: [
          new TextRun({
            text: edu.school,
            font: fCompany.face,
            size: fCompany.size,
            bold: true,
            color: colorOverride || tmpl.colors.primary,
          }),
          new TextRun({
            text: `\t${edu.graduated || edu.end}`,
            font: fEdu.face,
            size: fEdu.size,
            color: textColor,
          }),
        ],
        spacing: { before: 120, after: 40 },
      })
    );

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${edu.degree} \u2022 ${edu.location}`,
            font: fEdu.face,
            size: fEdu.size,
            italics: true,
            color: textColor,
          }),
        ],
        spacing: { after: 80 },
      })
    );
  }

  return paragraphs;
}

// ── Single-Column Document Builder ──

function buildSingleColumnDoc(resumeData, contact, education, tmpl) {
  const children = [
    createNameHeader(contact, tmpl),
    createContactLine(contact, tmpl),
    createSpacing(),
    createSectionHeader(config.ATS_HEADERS.summary, tmpl),
    createParagraph(
      resumeData.professional_summary || "Experienced software engineer with expertise in full-stack development.",
      tmpl
    ),
    createSpacing(),
    createSectionHeader(config.ATS_HEADERS.skills, tmpl),
    ...createSkillsSection(resumeData.technical_skills || {}, tmpl),
    createSpacing(),
    createSectionHeader(config.ATS_HEADERS.experience, tmpl),
    ...createExperienceSection(resumeData.experience || [], tmpl),
  ];

  if (education) {
    children.push(
      createSpacing(),
      createSectionHeader(config.ATS_HEADERS.education, tmpl),
      ...createEducationSection(education, tmpl),
    );
  }

  children.push(...createCertificationsBlock(resumeData.certifications, tmpl));

  return new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: tmpl.page.margins.top,
            bottom: tmpl.page.margins.bottom,
            left: tmpl.page.margins.left,
            right: tmpl.page.margins.right,
          },
        },
      },
      children,
    }],
  });
}

// ── Two-Column Document Builder ──

function buildSectionContent(sections, resumeData, contact, education, tmpl, colorOverride) {
  const children = [];

  for (const section of sections) {
    switch (section) {
      case "contact":
        children.push(createNameHeader(contact, tmpl, colorOverride));
        children.push(createContactLine(contact, tmpl, colorOverride));
        children.push(createSpacing());
        break;
      case "summary":
        children.push(createSectionHeader(config.ATS_HEADERS.summary, tmpl, colorOverride));
        children.push(createParagraph(
          resumeData.professional_summary || "Experienced software engineer with expertise in full-stack development.",
          tmpl, colorOverride
        ));
        children.push(createSpacing());
        break;
      case "skills":
        children.push(createSectionHeader(config.ATS_HEADERS.skills, tmpl, colorOverride));
        children.push(...createSkillsSection(resumeData.technical_skills || {}, tmpl, colorOverride));
        children.push(createSpacing());
        break;
      case "experience":
        children.push(createSectionHeader(config.ATS_HEADERS.experience, tmpl, colorOverride));
        children.push(...createExperienceSection(resumeData.experience || [], tmpl, colorOverride));
        children.push(createSpacing());
        break;
      case "education":
        if (education) {
          children.push(createSectionHeader(config.ATS_HEADERS.education, tmpl, colorOverride));
          children.push(...createEducationSection(education, tmpl, colorOverride));
          children.push(createSpacing());
        }
        break;
      case "certifications":
        children.push(...createCertificationsBlock(resumeData.certifications, tmpl, colorOverride));
        break;
    }
  }

  return children;
}

function buildTwoColumnDoc(resumeData, contact, education, tmpl) {
  const sidebar = tmpl.sidebar;
  const isLeft = sidebar.position === "left";

  // Sidebar content — override text color for dark backgrounds
  const sidebarColor = isDarkColor(tmpl.colors.sidebarBg) ? "FFFFFF" : null;
  const sidebarChildren = buildSectionContent(
    sidebar.sidebarSections, resumeData, contact, education, tmpl, sidebarColor
  );
  // Main content — always default colors
  const mainChildren = buildSectionContent(
    sidebar.mainSections, resumeData, contact, education, tmpl, null
  );

  // Ensure non-empty cells (docx library requires at least one child)
  if (sidebarChildren.length === 0) sidebarChildren.push(new Paragraph(""));
  if (mainChildren.length === 0) mainChildren.push(new Paragraph(""));

  const sidebarShading = tmpl.colors.sidebarBg ? {
    type: ShadingType.CLEAR,
    fill: tmpl.colors.sidebarBg,
    color: "auto",
  } : undefined;

  const sidebarCell = new TableCell({
    width: { size: sidebar.widthDxa, type: WidthType.DXA },
    children: sidebarChildren,
    shading: sidebarShading,
    borders: noBorders,
    margins: { top: 300, bottom: 300, left: 300, right: 200 },
    verticalAlign: VerticalAlign.TOP,
  });

  const mainCell = new TableCell({
    width: { size: sidebar.mainWidthDxa, type: WidthType.DXA },
    children: mainChildren,
    borders: noBorders,
    margins: { top: 300, bottom: 300, left: 300, right: 300 },
    verticalAlign: VerticalAlign.TOP,
  });

  const row = new TableRow({
    children: isLeft ? [sidebarCell, mainCell] : [mainCell, sidebarCell],
  });

  const table = new Table({
    rows: [row],
    width: { size: sidebar.widthDxa + sidebar.mainWidthDxa, type: WidthType.DXA },
    borders: {
      top: noBorder,
      bottom: noBorder,
      left: noBorder,
      right: noBorder,
      insideHorizontal: noBorder,
      insideVertical: noBorder,
    },
  });

  return new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: tmpl.page.margins.top,
            bottom: tmpl.page.margins.bottom,
            left: tmpl.page.margins.left,
            right: tmpl.page.margins.right,
          },
        },
      },
      children: [table],
    }],
  });
}

// ── Composable element renderers (new design engine) ──

function contentWidthOf(tmpl) {
  const m = tmpl.page.margins;
  return tmpl.sidebar ? tmpl.sidebar.mainWidthDxa - 600 : 12240 - m.left - m.right;
}

// A thin horizontal rule between sections (elements.dividers).
function createDivider(tmpl, colorOverride) {
  return new Paragraph({
    children: [new TextRun({ text: "" })],
    spacing: { before: 60, after: 120 },
    border: {
      bottom: {
        style: BorderStyle.SINGLE,
        color: colorOverride || tmpl.colors.subtleText,
        size: 4,
        space: 1,
      },
    },
  });
}

// Headshot image paragraph (elements.headshot + contact.photo data URL/base64).
function createHeadshot(contact, tmpl) {
  if (!contact || !contact.photo) return null;
  try {
    const m = String(contact.photo).match(/^data:image\/(png|jpe?g|gif);base64,(.+)$/i);
    const b64 = m ? m[2] : contact.photo;
    const type = m ? (m[1].toLowerCase().startsWith("jp") ? "jpg" : m[1].toLowerCase()) : "png";
    const data = Buffer.from(b64, "base64");
    if (!data.length) return null;
    return new Paragraph({
      alignment: getAlignment(tmpl),
      spacing: { after: 80 },
      children: [
        new ImageRun({ data, type, transformation: { width: 96, height: 96 } }),
      ],
    });
  } catch {
    return null;
  }
}

// Skills as accent-banded rows (elements.skillBars). No fabricated proficiency
// values — the bar is a decorative accent band, not a fake skill rating.
function createSkillBars(skills, tmpl, colorOverride) {
  const rows = [];
  const fCat = tmpl.fonts.skillsCategory;
  const fItems = tmpl.fonts.skillsItems;
  const width = contentWidthOf(tmpl);
  const bandFill = (tmpl.sectionHeader.shading && tmpl.sectionHeader.shading.fill) || "EEEEEE";

  for (const [category, items] of Object.entries(skills)) {
    if (!items || !items.trim()) continue;
    rows.push(new TableRow({
      children: [
        new TableCell({
          width: { size: width, type: WidthType.DXA },
          borders: noBorders,
          shading: { type: ShadingType.CLEAR, fill: bandFill, color: "auto" },
          margins: { top: 40, bottom: 40, left: 120, right: 120 },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: `${category}: `,
                  font: fCat.face, size: fCat.size, bold: true,
                  color: colorOverride || tmpl.colors.primary,
                }),
                new TextRun({
                  text: items,
                  font: fItems.face, size: fItems.size,
                  color: colorOverride || tmpl.colors.bodyText,
                }),
              ],
            }),
          ],
        }),
      ],
    }));
  }
  if (rows.length === 0) return [];
  return [new Table({
    rows,
    width: { size: width, type: WidthType.DXA },
    borders: {
      top: noBorder, bottom: noBorder, left: noBorder, right: noBorder,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 6, color: "FFFFFF" },
      insideVertical: noBorder,
    },
  })];
}

// Highlighted summary block (elements.callout).
function createCallout(text, tmpl, colorOverride) {
  const f = tmpl.fonts.body;
  const width = contentWidthOf(tmpl);
  const fill = (tmpl.sectionHeader.shading && tmpl.sectionHeader.shading.fill) || "F2F4F7";
  return new Table({
    width: { size: width, type: WidthType.DXA },
    borders: {
      top: noBorder, bottom: noBorder,
      left: { style: BorderStyle.SINGLE, size: 18, color: colorOverride || tmpl.colors.accent },
      right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder,
    },
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: width, type: WidthType.DXA },
        borders: noBorders,
        shading: { type: ShadingType.CLEAR, fill, color: "auto" },
        margins: { top: 160, bottom: 160, left: 220, right: 220 },
        children: [new Paragraph({
          children: [new TextRun({
            text, font: f.face, size: f.size,
            color: colorOverride || tmpl.colors.bodyText,
          })],
        })],
      })],
    })],
  });
}

function createProjectsSection(projects, tmpl, colorOverride) {
  const out = [];
  const fCompany = tmpl.fonts.company;
  const fBody = tmpl.fonts.body;
  const textColor = colorOverride || tmpl.colors.bodyText;
  for (const p of projects || []) {
    out.push(new Paragraph({
      children: [
        new TextRun({
          text: p.name || p.title || "Project",
          font: fCompany.face, size: fCompany.size, bold: true,
          color: colorOverride || tmpl.colors.primary,
        }),
        ...(p.tech ? [new TextRun({
          text: `  •  ${p.tech}`,
          font: fBody.face, size: fBody.size, italics: true, color: textColor,
        })] : []),
      ],
      spacing: { before: 120, after: 40 },
    }));
    if (p.description) {
      out.push(new Paragraph({
        children: [new TextRun({ text: p.description, font: fBody.face, size: fBody.size, color: textColor })],
        spacing: { after: 60 },
      }));
    }
    for (const b of p.bullets || []) {
      out.push(new Paragraph({
        children: [new TextRun({ text: `• ${b}`, font: fBody.face, size: fBody.size, color: textColor })],
        spacing: { after: 60 }, indent: { left: 360 },
      }));
    }
  }
  return out;
}

// Name + contact on one line, contact right-aligned (single-split variant).
function createSplitHeader(contact, tmpl, colorOverride) {
  const fn = tmpl.fonts.name;
  const fc = tmpl.fonts.contact;
  const parts = [contact.phone, contact.email, contact.linkedin, contact.github].filter(Boolean);
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: contentWidthOf(tmpl) }],
    spacing: { after: 80 },
    children: [
      new TextRun({
        text: contact.name, font: fn.face, size: fn.size, bold: true,
        color: colorOverride || tmpl.colors.primary,
      }),
      new TextRun({
        text: `\t${parts.join("  •  ")}`,
        font: fc.face, size: fc.size,
        color: colorOverride || tmpl.colors.subtleText,
      }),
    ],
  });
}

// Full-width accent rule beneath the header block (single-banner variant).
function createAccentRule(tmpl, colorOverride) {
  return new Paragraph({
    children: [new TextRun({ text: "" })],
    spacing: { after: 140 },
    border: {
      bottom: {
        style: BorderStyle.SINGLE,
        color: colorOverride || tmpl.colors.accent,
        size: 12,
        space: 1,
      },
    },
  });
}

// Contact line with optional leading icon glyphs (elements.icons).
function createContactLineIcons(contact, tmpl, colorOverride) {
  const f = tmpl.fonts.contact;
  const parts = [
    contact.phone   ? `☎ ${contact.phone}` : null,
    contact.email   ? `✉ ${contact.email}` : null,
    contact.linkedin ? `in: ${contact.linkedin}` : null,
    contact.github  ? `gh: ${contact.github}` : null,
  ].filter(Boolean);
  return new Paragraph({
    alignment: getAlignment(tmpl),
    children: [new TextRun({
      text: parts.join("   "),
      font: f.face, size: f.size,
      color: colorOverride || tmpl.colors.subtleText,
    })],
    spacing: { after: 40 },
  });
}

// Build one section's nodes (no surrounding spacing — caller adds separators).
function sectionNodes(section, resumeData, contact, education, tmpl, design, colorOverride) {
  const el = design.elements;
  switch (section) {
    case "contact": {
      const out = [];
      const head = el.headshot ? createHeadshot(contact, tmpl) : null;
      if (head) out.push(head);
      const treatment = design.headerTreatment || "left";
      // split/banner only make sense in a full-width single column.
      if (treatment === "split" && tmpl.layout !== "two-column") {
        out.push(createSplitHeader(contact, tmpl, colorOverride));
      } else {
        out.push(createNameHeader(contact, tmpl, colorOverride));
        out.push(el.icons
          ? createContactLineIcons(contact, tmpl, colorOverride)
          : createContactLine(contact, tmpl, colorOverride));
        if (treatment === "banner" && tmpl.layout !== "two-column") {
          out.push(createAccentRule(tmpl, colorOverride));
        }
      }
      return out;
    }
    case "summary": {
      const text = resumeData.professional_summary
        || "Experienced software engineer with expertise in full-stack development.";
      return [
        createSectionHeader(config.ATS_HEADERS.summary, tmpl, colorOverride),
        el.callout ? createCallout(text, tmpl, colorOverride) : createParagraph(text, tmpl, colorOverride),
      ];
    }
    case "skills": {
      const skills = resumeData.technical_skills || {};
      return [
        createSectionHeader(config.ATS_HEADERS.skills, tmpl, colorOverride),
        ...(el.skillBars
          ? createSkillBars(skills, tmpl, colorOverride)
          : createSkillsSection(skills, tmpl, colorOverride)),
      ];
    }
    case "experience":
      return [
        createSectionHeader(config.ATS_HEADERS.experience, tmpl, colorOverride),
        ...createExperienceSection(resumeData.experience || [], tmpl, colorOverride),
      ];
    case "projects": {
      const projects = resumeData.projects || [];
      if (!projects.length) return [];
      return [
        createSectionHeader(config.ATS_HEADERS.projects, tmpl, colorOverride),
        ...createProjectsSection(projects, tmpl, colorOverride),
      ];
    }
    case "education":
      if (!education) return [];
      return [
        createSectionHeader(config.ATS_HEADERS.education, tmpl, colorOverride),
        ...createEducationSection(education, tmpl, colorOverride),
      ];
    case "certifications": {
      const block = createCertificationsBlock(resumeData.certifications, tmpl, colorOverride);
      // Strip the leading createSpacing() — the generalized path owns separators.
      return block.length ? block.slice(1) : [];
    }
    default:
      return [];
  }
}

function emitSections(sectionList, resumeData, contact, education, tmpl, design, colorOverride) {
  const children = [];
  let first = true;
  for (const section of sectionList) {
    if (design.sectionVisibility[section] === false) continue;
    const nodes = sectionNodes(section, resumeData, contact, education, tmpl, design, colorOverride);
    if (nodes.length === 0) continue;
    if (!first) {
      children.push(design.elements.dividers
        ? createDivider(tmpl, colorOverride)
        : createSpacing());
    }
    children.push(...nodes);
    first = false;
  }
  return children;
}

function buildComposedSingleColumn(resumeData, contact, education, tmpl, design) {
  const children = emitSections(
    design.sectionOrder, resumeData, contact, education, tmpl, design, null
  );
  return new Document({
    sections: [{
      properties: { page: { margin: { ...tmpl.page.margins } } },
      children,
    }],
  });
}

function buildComposedTwoColumn(resumeData, contact, education, tmpl, design) {
  const sidebar = tmpl.sidebar;
  const isLeft = sidebar.position === "left";
  const vis = (s) => design.sectionVisibility[s] !== false;

  const sidebarList = sidebar.sidebarSections.filter(vis);
  const sidebarSet = new Set(sidebar.sidebarSections);
  const mainList = design.sectionOrder.filter((s) => vis(s) && !sidebarSet.has(s));

  const sidebarColor = isDarkColor(tmpl.colors.sidebarBg) ? "FFFFFF" : null;
  const sidebarChildren = emitSections(sidebarList, resumeData, contact, education, tmpl, design, sidebarColor);
  const mainChildren = emitSections(mainList, resumeData, contact, education, tmpl, design, null);

  if (sidebarChildren.length === 0) sidebarChildren.push(new Paragraph(""));
  if (mainChildren.length === 0) mainChildren.push(new Paragraph(""));

  const sidebarShading = tmpl.colors.sidebarBg ? {
    type: ShadingType.CLEAR, fill: tmpl.colors.sidebarBg, color: "auto",
  } : undefined;

  const sidebarCell = new TableCell({
    width: { size: sidebar.widthDxa, type: WidthType.DXA },
    children: sidebarChildren,
    shading: sidebarShading,
    borders: noBorders,
    margins: { top: 300, bottom: 300, left: 300, right: 200 },
    verticalAlign: VerticalAlign.TOP,
  });
  const mainCell = new TableCell({
    width: { size: sidebar.mainWidthDxa, type: WidthType.DXA },
    children: mainChildren,
    borders: noBorders,
    margins: { top: 300, bottom: 300, left: 300, right: 300 },
    verticalAlign: VerticalAlign.TOP,
  });
  const table = new Table({
    rows: [new TableRow({ children: isLeft ? [sidebarCell, mainCell] : [mainCell, sidebarCell] })],
    width: { size: sidebar.widthDxa + sidebar.mainWidthDxa, type: WidthType.DXA },
    borders: {
      top: noBorder, bottom: noBorder, left: noBorder, right: noBorder,
      insideHorizontal: noBorder, insideVertical: noBorder,
    },
  });
  return new Document({
    sections: [{
      properties: { page: { margin: { ...tmpl.page.margins } } },
      children: [table],
    }],
  });
}

// ── Main Entry Point ──

// A preset with all extras off and the legacy section order/visibility renders
// through the original (regression-locked) builders, byte-for-byte unchanged.
function isLegacyDefault(design) {
  if (!design.isPreset) return false;
  const e = design.elements;
  if (e.skillBars || e.headshot || e.icons || e.dividers || e.callout) return false;
  const order = design.sectionOrder;
  const legacy = ["contact", "summary", "skills", "experience", "education", "certifications"];
  if (order.length !== legacy.length || order.some((s, i) => s !== legacy[i])) return false;
  for (const [k, v] of Object.entries(design.sectionVisibility)) {
    if (k === "projects") continue; // off by default, never rendered by legacy path
    if (v === false) return false;
  }
  return true;
}

async function buildResume(resumeData, customContact = null, options = {}) {
  const {
    template: templateId,
    design: designInput,
    includeEducation = true,
    xlMode = false,
    length,
  } = options;

  // Resolve the design: explicit spec/preset, else template name, else classic.
  const design = resolveDesign(designInput != null ? designInput : (templateId || "classic"));

  let tmpl = design.isPreset
    ? (TEMPLATES[design.presetId] || TEMPLATES.classic)
    : specToTmpl(design);

  // Length/density: extended ⊃ xl (narrower margins for 3-4 page resumes).
  const wantXL = xlMode || length === "xl" || length === "extended";
  const fmt = (length === "extended" && config.FORMAT_EXTENDED)
    ? config.FORMAT_EXTENDED
    : (wantXL ? config.FORMAT_XL : null);
  if (fmt) {
    tmpl = { ...tmpl, page: { ...tmpl.page, margins: fmt.page.margins } };
  }

  const contact = resumeData.contact || customContact || config.CONTACT;
  const education = includeEducation ? (resumeData.education || []) : null;

  let doc;
  if (isLegacyDefault(design)) {
    // Original, untouched code paths (regression-locked).
    doc = tmpl.layout === "two-column"
      ? buildTwoColumnDoc(resumeData, contact, education, tmpl)
      : buildSingleColumnDoc(resumeData, contact, education, tmpl);
  } else {
    doc = tmpl.layout === "two-column"
      ? buildComposedTwoColumn(resumeData, contact, education, tmpl, design)
      : buildComposedSingleColumn(resumeData, contact, education, tmpl, design);
  }

  return await Packer.toBuffer(doc);
}

module.exports = { buildResume };
