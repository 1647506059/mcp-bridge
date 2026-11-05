const assert = require('node:assert/strict');
const { test } = require('node:test');
const { EventEmitter } = require('node:events');
const { loadSource, fakeClock } = require('./sourceHarness');

function serverRequest() {
  const { HttpServer } = loadSource('core/HttpServer.ts', {}, { './Logger': { Logger: { error() {} } } });
  const req = new EventEmitter(); req.destroy = () => {}; req.resume = () => {};
  const responses = [], received = [];
  const res = { setHeader() {}, writeHead(code) { responses.push(code); }, end() {} };
  HttpServer.handleRawRequest(req, res, r => received.push(r.bodyString));
  return { req, responses, received };
}

test('HTTP 请求跨中文/emoji UTF-8 字节边界仍保持原文', () => {
  const s = serverRequest(), original = JSON.stringify({ text: '中文🧶\n完整保留' }), bytes = Buffer.from(original);
  for (let i = 0; i < bytes.length; i++) s.req.emit('data', bytes.subarray(i, i + 1));
  s.req.emit('end'); assert.equal(s.received[0], original);
});

test('HTTP 5MiB 上限按字节计算，超限只拒绝一次且不进入路由', () => {
  const s = serverRequest(), bytes = Buffer.from(JSON.stringify({ text: '中'.repeat(2 * 1024 * 1024) }));
  assert.ok(bytes.length > 5 * 1024 * 1024);
  s.req.emit('data', bytes); s.req.emit('data', bytes); s.req.emit('end');
  assert.deepEqual(s.responses, [413]); assert.deepEqual(s.received, []);
});

test('HTTP 未收完就中断的请求不能进入路由', () => {
  const s = serverRequest(); s.req.emit('data', Buffer.from('{')); s.req.emit('aborted'); s.req.emit('end');
  assert.deepEqual(s.received, []);
});

function clientRequest() {
  const clock = fakeClock(), replies = [];
  let respond, destroyed = 0;
  const req = new EventEmitter(); req.write = () => {}; req.end = () => {};
  req.destroy = () => { destroyed++; req.emit('error', new Error('destroyed')); };
  const transport = loadSource('utils/HttpTransport.ts', clock, { http: { request(options, cb) { respond = cb; return req; } } });
  transport.requestJson({ timeout: 50 }, '', (...r) => replies.push(r));
  function response(status = 200) {
    const res = new EventEmitter(); res.statusCode = status; respond(res); return res;
  }
  return { clock, req, replies, response, destroyed: () => destroyed };
}

test('HTTP 响应分片不损坏中文和emoji，HTTP状态错误与非法JSON明确失败', () => {
  const s = clientRequest(), res = s.response(), expected = { content: [{ text: '中文🧶' }] }, bytes = Buffer.from(JSON.stringify(expected));
  for (const byte of bytes) res.emit('data', Buffer.from([byte]));
  res.emit('end'); assert.equal(s.replies[0][0], null); assert.equal(JSON.stringify(s.replies[0][1]), JSON.stringify(expected));
  for (const [status, body, pattern] of [[503, '{"error":"service unavailable"}', /503.*service unavailable/],
    [200, 'not-json', /非 JSON/], [200, 'null', /JSON 对象/]]) {
    const f = clientRequest(), r = f.response(status); r.emit('data', Buffer.from(body)); r.emit('end');
    assert.match(f.replies[0][0].message, pattern); assert.equal(f.replies.length, 1);
  }
});

test('HTTP 连接、慢响应、中断均只结算一次，超时销毁请求且不自动重放', () => {
  for (const phase of ['connecting', 'slow-response', 'aborted-response']) {
    const s = clientRequest(); let r;
    if (phase !== 'connecting') { r = s.response(); r.emit('data', Buffer.from('{')); }
    if (phase === 'aborted-response') r.emit('aborted');
    else s.clock.tick(50);
    assert.ok(s.replies[0][0]); assert.equal(s.destroyed(), 1);
    s.req.emit('timeout'); if (r) { r.emit('end'); r.emit('error', new Error('late')); }
    assert.equal(s.replies.length, 1);
  }
});
