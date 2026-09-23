const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const JSZip = require('jszip');
const { handler } = require('../../index');
const { buildResume } = require('../docx-builder');
const { buildOptimizeSystemPrompt, buildRevisePrompt } = require('../prompts');
const { composeDesign } = require('../design');

describe('human-readable ResumeX release', () => {
  it('offers current balanced models and defaults to GPT-6 Sol, not Astra or Fable', async () => {
    const response = await handler({ rawPath: '/models', requestContext: { http: { method: 'GET' } } });
    assert.equal(response.statusCode, 200);
    const { default: selected, models } = JSON.parse(response.body);
    assert.equal(selected, 'gpt-6-sol');
    const byAlias = Object.fromEntries(models.map(m => [m.alias, m]));
    assert.equal(byAlias['gpt-6-sol'].id, 'gpt-6-sol');
    assert.equal(byAlias['gpt-6-luna'].id, 'gpt-6-luna');
    assert.equal(byAlias['claude-opus-5.5'].id, 'claude-opus-5-5');
    assert.ok(byAlias['claude-fable-5.1'] && byAlias['gpt-6-astra'], 'preserve existing production options');
  });

  it('keeps optimization grounded in supplied experience rather than inventing metrics', () => {
    const prompt = buildOptimizeSystemPrompt();
    assert.match(prompt, /Never invent a number/);
    assert.match(prompt, /4-6 distinct, relevant achievement bullets/);
    assert.match(prompt, /keep the result qualitative/);
    assert.match(buildRevisePrompt('software', 'standard'), /Never replace it with an invented/);
  });

  it('defaults composed design to standard length', () => {
    assert.equal(composeDesign('example').density, 'standard');
  });

  it('exports consistent hanging indents for wrapped experience bullets', async () => {
    const resume = {
      contact: { name: 'Test Candidate', email: 'test@example.com', phone: '555-0000' },
      professional_summary: 'Backend engineer',
      technical_skills: { Languages: 'Python' },
      experience: [{ company: 'Example Co', title: 'Engineer', location: 'New York, NY', start_date: 'Jan 2023', end_date: 'Present', bullets: ['Built a Python API that made customer case routing faster'] }],
      education: [],
    };
    const buffer = await buildResume(resume, null, {
      design: { layout: 'single-centered', palette: 'ink', typography: 'calibri-clean', headerStyle: 'plain', density: 'standard' },
    });
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file('word/document.xml').async('string');
    assert.match(xml, /w:hanging="240"/);
    assert.match(xml, /w:pos="360"/);
    assert.match(xml, /Built a Python API/);
  });
});
