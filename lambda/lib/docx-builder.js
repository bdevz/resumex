// ============================================================================
// docx-builder.js — Generate DOCX resumes with multiple template support
// ============================================================================

const {
  Document, Packer, Paragraph, TextRun, TabStopType, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  VerticalAlign,
} = require("docx");
const config = require("./config");
const { TEMPLATES } = require("./templates");

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

  if (dec.bottomBorder) {
    opts.border = {
      bottom: {
        style: BorderStyle.SINGLE,
        color: colorOverride || dec.bottomBorder.color,
        size: dec.bottomBorder.size,
        space: 1,
      },
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
      const dates = [edu.start_date, edu.end_date].filter(Boolean).join(" \u2014 ");
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
            text: `\t${edu.start} \u2014 ${edu.end}`,
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
    createSectionHeader("Professional Summary", tmpl),
    createParagraph(
      resumeData.professional_summary || "Experienced software engineer with expertise in full-stack development.",
      tmpl
    ),
    createSpacing(),
    createSectionHeader("Technical Skills", tmpl),
    ...createSkillsSection(resumeData.technical_skills || {}, tmpl),
    createSpacing(),
    createSectionHeader("Professional Experience", tmpl),
    ...createExperienceSection(resumeData.experience || [], tmpl),
  ];

  if (education) {
    children.push(
      createSpacing(),
      createSectionHeader("Education", tmpl),
      ...createEducationSection(education, tmpl),
    );
  }

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
        children.push(createSectionHeader("Professional Summary", tmpl, colorOverride));
        children.push(createParagraph(
          resumeData.professional_summary || "Experienced software engineer with expertise in full-stack development.",
          tmpl, colorOverride
        ));
        children.push(createSpacing());
        break;
      case "skills":
        children.push(createSectionHeader("Technical Skills", tmpl, colorOverride));
        children.push(...createSkillsSection(resumeData.technical_skills || {}, tmpl, colorOverride));
        children.push(createSpacing());
        break;
      case "experience":
        children.push(createSectionHeader("Professional Experience", tmpl, colorOverride));
        children.push(...createExperienceSection(resumeData.experience || [], tmpl, colorOverride));
        children.push(createSpacing());
        break;
      case "education":
        if (education) {
          children.push(createSectionHeader("Education", tmpl, colorOverride));
          children.push(...createEducationSection(education, tmpl, colorOverride));
          children.push(createSpacing());
        }
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

// ── Main Entry Point ──

async function buildResume(resumeData, customContact = null, options = {}) {
  const {
    template: templateId = "classic",
    includeEducation = true,
    xlMode = false,
  } = options;

  let tmpl = TEMPLATES[templateId] || TEMPLATES.classic;

  // XL mode: override margins to narrow for 3-page keyword-heavy resumes
  if (xlMode) {
    tmpl = { ...tmpl, page: { ...tmpl.page, margins: config.FORMAT_XL.page.margins } };
  }
  const contact = resumeData.contact || customContact || config.CONTACT;
  const education = includeEducation
    ? (resumeData.education || null)
    : null;

  let doc;
  if (tmpl.layout === "two-column") {
    doc = buildTwoColumnDoc(resumeData, contact, education, tmpl);
  } else {
    doc = buildSingleColumnDoc(resumeData, contact, education, tmpl);
  }

  return await Packer.toBuffer(doc);
}

module.exports = { buildResume };
