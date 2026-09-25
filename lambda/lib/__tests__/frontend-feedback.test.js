const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../../../frontend/index.html'), 'utf8');
const begin = html.indexOf('// BEGIN REVIEW_HEURISTIC_TEST');
const end = html.indexOf('// END REVIEW_HEURISTIC_TEST');
assert.ok(begin >= 0 && end > begin, 'inline review functions must remain testable');
const context = vm.createContext({});
vm.runInContext(html.slice(begin, end) + '\nthis.check = (text) => ({ notes: bulletAdvice(text), value: hasValueSignal(text) });', context);
const check = (text) => context.check(text);

const clear = [
  'Built a Kafka-based event pipeline that replaced the polling system used by the order team',
  'Owned the on-call rotation and wrote the runbook new engineers still use',
  'Configured Workday payroll integrations across 12 countries',
  'Developed Apex triggers for Sales Cloud lead routing',
  'Delivered the migration, resulting in lower support burden',
  'Resolved customer-reported defects in Python services',
  'Built Node.js API endpoints for order workflows',
  'Interviewed 40 backend candidates',
  'Mentored three junior engineers',
  'Maintained Terraform modules for AWS',
  'Presented quarterly roadmaps to executives',
  'Ran the weekly architecture review',
];
const flagged = [
  ['Responsible for maintaining the payment API', 'passive or vague'],
  ['Built an API', 'Too brief'],
  ['Updated Python services as part of ongoing upkeep', 'generic filler'],
  ['Spearheaded a transformative migration resulting in cost reduction', 'stock language'],
  ['Leveraged Terraform to provision the production environment for three teams', 'stock language'],
  ['Utilized Kubernetes to deploy services for the platform team', 'stock language'],
  ['Designed a service with detailed retries and fallback routes for three teams, plus comprehensive operational documentation that was shared across the engineering group and maintained through successive migrations and platform updates over several years', 'easier to scan'],
];

describe('human-readable frontend review', () => {
  it('does not penalize concrete work merely for lacking a magic outcome verb', () => {
    for (const bullet of clear) assert.deepEqual([...check(bullet).notes], [], bullet);
    assert.match(html, /const label = notes\.length \? "Review" : "No quick flag"/);
    assert.doesNotMatch(html, /bullets do not state a clear outcome/);
  });

  it('reserves Review for concrete, explainable writing problems', () => {
    for (const [bullet, reason] of flagged) {
      assert.ok(check(bullet).notes.some(note => note.includes(reason)), `${bullet}: ${check(bullet).notes}`);
    }
  });

  it('never flags absent bullets as too brief', () => {
    assert.deepEqual([...check('').notes], []);
    assert.deepEqual([...check(null).notes], []);
  });

  it('recognizes qualitative impact without demanding a number', () => {
    assert.equal(check('Built a Kafka pipeline that replaced polling').value, true);
    assert.equal(check('Owned a runbook new engineers still use').value, true);
    assert.equal(check('Configured payroll integrations across 12 countries').value, true);
    assert.equal(check('Built an API').value, false);
  });
});
