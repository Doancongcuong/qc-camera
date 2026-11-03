// Ép gửi lúc đang tự gửi: phải chờ lượt hiện tại xong rồi gửi nốt phần còn lại (trước đây bị bỏ qua).
const fs = require('fs'), vm = require('vm'), assert = require('assert'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const a = html.indexOf('let retryTimer'), b = html.indexOf("pushBtn.addEventListener('click'");
const code = html.slice(a, b);

function setup() {
  const posts = []; const pend = [];                       // mỗi POST = 1 promise do test điều khiển
  const ctx = {
    queue: [], sending: false, sent: 0, BATCH_SEND: 5, KEY: 'k', GAS: 'g', navigator: {}, console,
    st: { textContent: '' }, cntEl: { textContent: '' }, saveQ: () => {},
    retryTimer: null, flushTimer: null, clearTimeout, setTimeout,
    fetch: (url, opt) => new Promise((res, rej) => { const n = JSON.parse(opt.body).images.length; posts.push(n); pend.push({ ok: () => res({ json: async () => ({ ok: true, ms: 1 }) }), fail: () => rej(new Error('net')), n }); }),
  };
  vm.createContext(ctx); vm.runInContext(code + ';this.pump=pump;', ctx);
  return { ctx, posts, pend };
}
const tick = () => new Promise(r => setImmediate(r));

(async () => {
  // 7 ảnh: tự gửi 5, bấm ép gửi khi đang gửi → gửi nốt 2 sau lượt đầu
  let t = setup(); t.ctx.queue = ['1','2','3','4','5','6','7'];
  t.ctx.pump(false); await tick();
  assert.deepStrictEqual(t.posts, [5], 'lượt tự gửi 5 ảnh');
  t.ctx.pump(true); await tick();
  assert.deepStrictEqual(t.posts, [5], 'ép gửi lúc đang gửi: chưa gửi chồng lên');
  t.pend[0].ok(); await tick(); await tick();
  assert.deepStrictEqual(t.posts, [5, 2], 'xong lượt 1 thì gửi nốt 2 ảnh còn lại');
  t.pend[1].ok(); await tick(); await tick();
  assert.strictEqual(t.ctx.queue.length, 0); assert.strictEqual(t.ctx.sent, 7); assert.strictEqual(t.ctx.sending, false);
  // Không bấm ép gửi: 2 ảnh dư vẫn nằm lại đợi (hành vi cũ giữ nguyên)
  t = setup(); t.ctx.queue = ['1','2','3','4','5','6','7'];
  t.ctx.pump(false); await tick(); t.pend[0].ok(); await tick(); await tick();
  assert.deepStrictEqual(t.posts, [5]); assert.strictEqual(t.ctx.queue.length, 2);
  // Ép gửi khi rảnh vẫn hoạt động
  t.ctx.pump(true); await tick(); assert.deepStrictEqual(t.posts, [5, 2]); t.pend[1].ok(); await tick(); await tick();
  assert.strictEqual(t.ctx.queue.length, 0);
  // Lỗi mạng giữa chừng: yêu cầu ép gửi không mất, thử lại vẫn gửi nốt
  t = setup(); t.ctx.queue = ['1','2','3','4','5','6','7'];
  t.ctx.pump(false); await tick(); t.ctx.pump(true); t.pend[0].fail(); await tick(); await tick();
  assert.strictEqual(t.ctx.sending, false, 'lỗi → nhả khóa để thử lại');
  await new Promise(r => setTimeout(r, 3100)); await tick();
  assert.deepStrictEqual(t.posts, [5, 5], 'thử lại lượt 5 ảnh');
  t.pend[1].ok(); await tick(); await tick(); assert.deepStrictEqual(t.posts, [5, 5, 2], 'vẫn nhớ ép gửi → gửi nốt 2');
  t.pend[2].ok(); await tick(); await tick(); assert.strictEqual(t.ctx.queue.length, 0);
  console.log('Ép gửi sau tự gửi: ĐẠT');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
