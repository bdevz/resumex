// ============================================================================
// docx-builder.js — Generate ATS-compliant DOCX resumes
// ============================================================================

const { Document, Packer, Paragraph, TextRun, TabStopPosition, TabStopType, AlignmentType } = require("docx");
const config = require("./config");

async function buildResume(resumeData, customContact = null) {
  // Use contact from resume data (optimize mode), custom contact, or config default
  const contact = resumeData.contact || customContact || config.CONTACT;

  // Use education from resume data (optimize mode) or fall back to config defaults
  const education = resumeData.education || null;

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: config.FORMAT.page.margins.top,
            bottom: config.FORMAT.page.margins.bottom,
            left: config.FORMAT.page.margins.left,
            right: config.FORMAT.page.margins.right,
          },
        },
      },
      children: [
        // Header with name and contact
        createNameHeader(contact),
        createContactLine(contact),
        createSpacing(),

        // Professional Summary
        createSectionHeader("PROFESSIONAL SUMMARY"),
        createParagraph(resumeData.professional_summary || "Experienced software engineer with expertise in full-stack development."),
        createSpacing(),

        // Technical Skills
        createSectionHeader("TECHNICAL SKILLS"),
        ...createSkillsSection(resumeData.technical_skills || {}),
        createSpacing(),

        // Professional Experience
        createSectionHeader("PROFESSIONAL EXPERIENCE"),
        ...createExperienceSection(resumeData.experience || []),
        createSpacing(),

        // Education
        createSectionHeader("EDUCATION"),
        ...createEducationSection(education),
      ],
    }],
  });

  return await Packer.toBuffer(doc);
}

function createNameHeader(contact) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({
        text: contact.name,
        font: config.FORMAT.fonts.name.face,
        size: config.FORMAT.fonts.name.size,
        bold: true,
      }),
    ],
  });
}

function createContactLine(contact) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({
        text: `${contact.phone} • ${contact.email} • ${contact.linkedin} • ${contact.github}`,
        font: config.FORMAT.fonts.contact.face,
        size: config.FORMAT.fonts.contact.size,
      }),
    ],
  });
}

function createSectionHeader(title) {
  return new Paragraph({
    children: [
      new TextRun({
        text: title,
        font: config.FORMAT.fonts.section_heading.face,
        size: config.FORMAT.fonts.section_heading.size,
        bold: true,
      }),
    ],
    spacing: {
      before: 240, // 12pt
      after: 120,  // 6pt
    },
  });
}

function createParagraph(text, options = {}) {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        font: options.font || config.FORMAT.fonts.body.face,
        size: options.size || config.FORMAT.fonts.body.size,
        bold: options.bold || false,
        italics: options.italics || false,
      }),
    ],
    spacing: options.spacing || { after: 120 },
  });
}

function createSpacing() {
  return new Paragraph({
    children: [new TextRun({ text: "" })],
    spacing: { after: 120 },
  });
}

function createSkillsSection(skills) {
  const paragraphs = [];
  
  for (const [category, items] of Object.entries(skills)) {
    if (items && items.trim()) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${category}: `,
              font: config.FORMAT.fonts.skills_category.face,
              size: config.FORMAT.fonts.skills_category.size,
              bold: true,
            }),
            new TextRun({
              text: items,
              font: config.FORMAT.fonts.skills_items.face,
              size: config.FORMAT.fonts.skills_items.size,
            }),
          ],
          spacing: { after: 80 },
        })
      );
    }
  }
  
  return paragraphs;
}

function createExperienceSection(experience) {
  const paragraphs = [];
  
  for (const exp of experience) {
    // Company and dates line
    paragraphs.push(
      new Paragraph({
        tabStops: [
          {
            type: TabStopType.RIGHT,
            position: config.FORMAT.right_tab,
          },
        ],
        children: [
          new TextRun({
            text: exp.company,
            font: config.FORMAT.fonts.company.face,
            size: config.FORMAT.fonts.company.size,
            bold: true,
          }),
          new TextRun({
            text: `\t${exp.start_date} — ${exp.end_date}`,
            font: config.FORMAT.fonts.body.face,
            size: config.FORMAT.fonts.body.size,
          }),
        ],
        spacing: { before: 120, after: 40 },
      })
    );
    
    // Title and location
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${exp.title} • ${exp.location}`,
            font: config.FORMAT.fonts.title.face,
            size: config.FORMAT.fonts.title.size,
            italics: true,
          }),
        ],
        spacing: { after: 80 },
      })
    );
    
    // Bullets
    for (const bullet of exp.bullets || []) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `• ${bullet}`,
              font: config.FORMAT.fonts.body.face,
              size: config.FORMAT.fonts.body.size,
            }),
          ],
          spacing: { after: 60 },
          indent: { left: 360 }, // 0.25 inch
        })
      );
    }
  }
  
  return paragraphs;
}

function createEducationSection(education) {
  const paragraphs = [];

  // If dynamic education array provided (optimize mode), use it
  if (education && Array.isArray(education) && education.length > 0) {
    for (const edu of education) {
      const dates = [edu.start_date, edu.end_date].filter(Boolean).join(" — ");
      paragraphs.push(
        new Paragraph({
          tabStops: [
            { type: TabStopType.RIGHT, position: config.FORMAT.right_tab },
          ],
          children: [
            new TextRun({
              text: edu.school || "",
              font: config.FORMAT.fonts.company.face,
              size: config.FORMAT.fonts.company.size,
              bold: true,
            }),
            new TextRun({
              text: dates ? `\t${dates}` : "",
              font: config.FORMAT.fonts.education.face,
              size: config.FORMAT.fonts.education.size,
            }),
          ],
          spacing: { before: 120, after: 40 },
        })
      );

      const detail = [edu.degree, edu.location].filter(Boolean).join(" • ");
      if (detail) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: detail,
                font: config.FORMAT.fonts.education.face,
                size: config.FORMAT.fonts.education.size,
                italics: true,
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
  paragraphs.push(
    new Paragraph({
      tabStops: [
        { type: TabStopType.RIGHT, position: config.FORMAT.right_tab },
      ],
      children: [
        new TextRun({
          text: config.EDUCATION.masters.school,
          font: config.FORMAT.fonts.company.face,
          size: config.FORMAT.fonts.company.size,
          bold: true,
        }),
        new TextRun({
          text: `\t${config.EDUCATION.masters.start} — ${config.EDUCATION.masters.end}`,
          font: config.FORMAT.fonts.education.face,
          size: config.FORMAT.fonts.education.size,
        }),
      ],
      spacing: { before: 120, after: 40 },
    })
  );

  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${config.EDUCATION.masters.degree} • ${config.EDUCATION.masters.location}`,
          font: config.FORMAT.fonts.education.face,
          size: config.FORMAT.fonts.education.size,
          italics: true,
        }),
      ],
      spacing: { after: 80 },
    })
  );

  paragraphs.push(
    new Paragraph({
      tabStops: [
        { type: TabStopType.RIGHT, position: config.FORMAT.right_tab },
      ],
      children: [
        new TextRun({
          text: config.EDUCATION.bachelors.school,
          font: config.FORMAT.fonts.company.face,
          size: config.FORMAT.fonts.company.size,
          bold: true,
        }),
        new TextRun({
          text: `\t${config.EDUCATION.bachelors.start} — ${config.EDUCATION.bachelors.end}`,
          font: config.FORMAT.fonts.education.face,
          size: config.FORMAT.fonts.education.size,
        }),
      ],
      spacing: { after: 40 },
    })
  );

  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${config.EDUCATION.bachelors.degree} • ${config.EDUCATION.bachelors.location}`,
          font: config.FORMAT.fonts.education.face,
          size: config.FORMAT.fonts.education.size,
          italics: true,
        }),
      ],
      spacing: { after: 80 },
    })
  );

  return paragraphs;
}

module.exports = {
  buildResume
};