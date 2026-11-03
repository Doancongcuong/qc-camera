// Chế độ tắt màn hình giả: giữ màn hình thức khi còn ảnh/đang gửi, nhả khoá khi gửi hết, vào chế độ thì ép gửi nốt.
const fs = require('fs'), vm = require('vm'), assert = require('assert'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const code = html.slice(html.indexOf('// DIM-BEGIN'), html.indexOf('// DIM-END'));
function setup(queue = []) {
  const log = [], el = () => ({ style: {}, textContent: '', addEventListener() {} });
  const ctx = { queue, sent: 3, sending: false, dimMode: false, console,
    document: { getElementById: () => el() },
    keepAwake: () => log.push('keep'), releaseAwake: () => log.push('release'), stopCam: () => log.push('stopCam'), pump: f => log.push('pump:' + f) };
  vm.createContext(ctx); vm.runInContext(code + ';this.api={dimSync,enterDim,exitDim,dimEl,dimInfo};', ctx);
  return { ctx, log, api: ctx.api };
}
// Vào chế độ đen khi còn 2 ảnh: dừng camera, ép gửi nốt, giữ màn hình thức
let t = setup(['a', 'b']); t.api.enterDim();
assert.deepStrictEqual(t.log, ['stopCam', 'pump:true', 'keep']);
assert.strictEqual(t.api.dimEl.style.display, 'flex');
assert.ok(/còn 2 ảnh/.test(t.api.dimInfo.textContent));
// Gửi hết → nhả khoá, báo an toàn tắt máy
t.ctx.queue.length = 0; t.log.length = 0; t.api.dimSync();
assert.deepStrictEqual(t.log, ['release']); assert.ok(/an toàn tắt máy/.test(t.api.dimInfo.textContent));
// Đang gửi dở dù hàng đợi tạm rỗng → vẫn giữ thức
t = setup([]); t.api.enterDim(); t.ctx.sending = true; t.log.length = 0; t.api.dimSync();
assert.deepStrictEqual(t.log, ['keep']);
// Hàng đợi rỗng ngay từ đầu: không ép gửi, không giữ thức
t = setup([]); t.api.enterDim(); assert.deepStrictEqual(t.log, ['stopCam', 'release']);
// Ngoài chế độ đen: dimSync không làm gì
t = setup(['a']); t.api.dimSync(); assert.deepStrictEqual(t.log, []);
// Thoát: ẩn lớp đen, nhả khoá (camera bật lại sẽ xin khoá mới)
t = setup(['a']); t.api.enterDim(); t.log.length = 0; t.api.exitDim();
assert.strictEqual(t.api.dimEl.style.display, 'none'); assert.deepStrictEqual(t.log, ['release']); assert.strictEqual(t.ctx.dimMode, false);
console.log('Chế độ đen: ĐẠT');
