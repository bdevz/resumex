const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { S3Client } = require('@aws-sdk/client-s3');
const { llmEndpoint } = require('../llm-endpoints');

global.awslambda = {
  streamifyResponse: handler => handler,
  HttpResponseStream: { from: stream => stream },
};
const { handler, streamHandler } = require('../../index');
delete global.awslambda;

const resume = {
  contact: { name: 'Synthetic Candidate' },
  professional_summary: 'Backend engineer building customer support services.',
  technical_skills: { Languages: ['Python'] },
  experience: [{ company: 'Example Co', title: 'Engineer', start_date: '2022', end_date: 'Present', bullets: ['Built Python services for customer support teams.'] }],
  education: [],
};
const jd = 'We need a backend engineer with Python experience to build and maintain customer support services.';
const envNames = ['OPENAI_BASE_URL', 'ANTHROPIC_BASE_URL', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'SHARED_PASSPHRASE'];

describe('compatible LLM endpoints', () => {
  let server, base, requests;
  const originalEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));

  before(async () => {
    requests = [];
    server = http.createServer(async (req, res) => {
      let wire = '';
      for await (const chunk of req) wire += chunk;
      const body = JSON.parse(wire);
      requests.push({ path: req.url, headers: req.headers, body });
      const text = JSON.stringify(resume);
      const openai = req.url.endsWith('/chat/completions');
      if (body.stream) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        const event = openai
          ? { choices: [{ delta: { content: text } }] }
          : { type: 'content_block_delta', delta: { type: 'text_delta', text } };
        res.end(`data: ${JSON.stringify(event)}\n\ndata: [DONE]\n\n`);
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(openai
          ? { model: body.model, choices: [{ message: { content: text }, finish_reason: 'stop' }] }
          : { model: body.model, content: [{ type: 'text', text }], stop_reason: 'end_turn' }));
      }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
    process.env.OPENAI_API_KEY = 'synthetic-openai-key';
    process.env.ANTHROPIC_API_KEY = 'synthetic-anthropic-key';
    process.env.SHARED_PASSPHRASE = 'synthetic-passphrase';
  });

  after(async () => {
    await new Promise(resolve => server.close(resolve));
    for (const [name, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it('retains direct-provider defaults when base URLs are absent or blank', () => {
    delete process.env.OPENAI_BASE_URL;
    process.env.ANTHROPIC_BASE_URL = '  ';
    assert.equal(llmEndpoint('openai'), 'https://api.openai.com/v1/chat/completions');
    assert.equal(llmEndpoint('anthropic'), 'https://api.anthropic.com/v1/messages');
  });

  for (const [provider, model, suffix] of [
    ['openai', 'gpt-5.6-terra', 'chat/completions'],
    ['openai', 'gpt-4.1', 'chat/completions'],
    ['anthropic', 'claude-sonnet-4.6', 'messages'],
    ['anthropic', 'claude-opus-5.5', 'messages'],
  ]) {
    for (const streaming of [false, true]) {
      it(`routes ${model} ${streaming ? 'streaming' : 'async optimization'} through the proxy`, async t => {
        process.env[`${provider.toUpperCase()}_BASE_URL`] = streaming ? ` ${base}/proxy/v1/// ` : `${base}/proxy/`;
        const payload = { model, resume: JSON.stringify(resume), jd };
        let completed;
        if (streaming) {
          global.awslambda = { HttpResponseStream: { from: stream => stream } };
          t.after(() => { delete global.awslambda; });
          let output = '';
          await streamHandler({ rawPath: '/optimize', httpMethod: 'POST', headers: { 'x-passphrase': 'synthetic-passphrase' }, body: JSON.stringify(payload) }, {
            write: chunk => { output += chunk; },
            end() {},
          });
          completed = output.split('\n').filter(line => line.startsWith('data: {'))
            .map(line => JSON.parse(line.slice(6))).find(event => event.type === 'complete');
          assert.ok(completed, output);
        } else {
          const writes = [];
          t.mock.method(S3Client.prototype, 'send', async command => { writes.push(command.input); return {}; });
          await handler({ __asyncJob: true, body: JSON.stringify({ ...payload, __route: 'optimize', __jobId: 'synthetic-proxy-test', __userName: 'Synthetic Test' }) });
          completed = JSON.parse(writes.filter(write => write.Key.startsWith('jobs/')).at(-1).Body);
          assert.equal(completed.status, 'complete', JSON.stringify(completed));
        }
        assert.equal(completed.resumeData.contact.name, 'Synthetic Candidate');
        const sent = requests.at(-1);
        assert.equal(sent.path, `/proxy/v1/${suffix}`);
        assert.equal(sent.body.model, model.replace('sonnet-4.6', 'sonnet-4-6').replace('opus-5.5', 'opus-5-5'));
        if (provider !== 'anthropic') {
          assert.equal(sent.headers.authorization, `Bearer synthetic-${provider}-key`);
          assert.equal(sent.body.response_format.type, 'json_object');
        } else {
          assert.equal(sent.headers['x-api-key'], 'synthetic-anthropic-key');
          assert.equal(sent.headers['anthropic-version'], '2023-06-01');
        }
      });
    }
  }
});
