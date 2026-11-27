const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../core.js');

test('normalizeUsername trims and lowercases', () => {
  assert.equal(C.normalizeUsername(' Hwangning '), 'hwangning');
  assert.equal(C.normalizeUsername(null), '');
});

test('validUsername', () => {
  assert.equal(C.validUsername('ab'), false);
  assert.equal(C.validUsername('a b c'), false);
  assert.equal(C.validUsername('Ning.2026'), true);
  assert.equal(C.validUsername('a'.repeat(31)), false);
  assert.equal(C.validUsername('ning@x'), false);
});

test('username <-> email', () => {
  assert.equal(C.usernameToEmail(' Hwangning '), 'hwangning@travel.local');
  assert.equal(C.emailToUsername('ning@travel.local'), 'ning');
  assert.equal(C.ADMIN_EMAIL, 'hwangning@travel.local');
  assert.equal(C.isAdminEmail('HWANGNING@travel.local'), true);
  assert.equal(C.isAdminEmail('ning@travel.local'), false);
  assert.equal(C.isAdminEmail(null), false);
});

test('authErrorText', () => {
  const bad = 'username หรือรหัสผ่านไม่ถูกต้อง';
  assert.equal(C.authErrorText('auth/invalid-credential'), bad);
  assert.equal(C.authErrorText('auth/wrong-password'), bad);
  assert.equal(C.authErrorText('auth/user-not-found'), bad);
  assert.equal(C.authErrorText('auth/invalid-login-credentials'), bad);
  assert.equal(C.authErrorText('auth/too-many-requests'), 'ลองผิดหลายครั้งเกินไป รอสักครู่แล้วลองใหม่');
  assert.equal(C.authErrorText('auth/network-request-failed'), 'เชื่อมต่ออินเทอร์เน็ตไม่ได้');
  assert.equal(C.authErrorText('auth/something-else'), 'เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง');
});

const T = (id, start, end) => ({ id, name: id, start, end, theme: 'sea' });
const barsOf = (m, id) => m.weeks.flatMap((w, wi) => w.bars.filter(b => b.tripId === id).map(b => Object.assign({ week: wi }, b)));

test('layoutMonth grid for Dec 2026 starts on Monday 30 Nov', () => {
  const m = C.layoutMonth([], 2026, 11);
  assert.equal(m.weeks.length, 5);
  assert.equal(m.weeks[0].days[0], '2026-11-30');
  assert.equal(m.weeks[0].days.length, 7);
  assert.equal(m.weeks[4].days[6], '2027-01-03');
});

test('layoutMonth single-week trip', () => {
  const m = C.layoutMonth([T('a', '2026-12-10', '2026-12-12')], 2026, 11);
  const b = barsOf(m, 'a');
  assert.equal(b.length, 1);
  assert.deepEqual([b[0].week, b[0].col, b[0].span, b[0].startsHere, b[0].endsHere], [1, 3, 3, true, true]);
});

test('layoutMonth trip crossing a week is split', () => {
  const b = barsOf(C.layoutMonth([T('a', '2026-12-12', '2026-12-15')], 2026, 11), 'a');
  assert.equal(b.length, 2);
  assert.deepEqual([b[0].week, b[0].col, b[0].span, b[0].startsHere, b[0].endsHere], [1, 5, 2, true, false]);
  assert.deepEqual([b[1].week, b[1].col, b[1].span, b[1].startsHere, b[1].endsHere], [2, 0, 2, false, true]);
});

test('layoutMonth overlapping trips get different lanes', () => {
  const m = C.layoutMonth([T('a', '2026-12-10', '2026-12-12'), T('b', '2026-12-11', '2026-12-13')], 2026, 11);
  assert.equal(barsOf(m, 'a')[0].lane, 0);
  assert.equal(barsOf(m, 'b')[0].lane, 1);
  const n = C.layoutMonth([T('a', '2026-12-07', '2026-12-08'), T('b', '2026-12-10', '2026-12-11')], 2026, 11);
  assert.equal(barsOf(n, 'b')[0].lane, 0);
});

test('layoutMonth clips trips that run past the grid', () => {
  const b = barsOf(C.layoutMonth([T('a', '2026-12-28', '2027-01-10')], 2026, 11), 'a');
  assert.equal(b.length, 1);
  assert.deepEqual([b[0].week, b[0].col, b[0].span, b[0].startsHere, b[0].endsHere], [4, 0, 7, true, false]);
  const c = barsOf(C.layoutMonth([T('x', '2026-11-01', '2026-12-01')], 2026, 11), 'x');
  assert.deepEqual([c[0].week, c[0].col, c[0].span, c[0].startsHere, c[0].endsHere], [0, 0, 2, false, true]);
});

test('layoutMonth undated and reversed trips', () => {
  const m = C.layoutMonth([T('u', '', ''), T('r', '2026-12-10', '2026-12-05')], 2026, 11);
  assert.deepEqual(m.undated, ['u']);
  const r = barsOf(m, 'r');
  assert.equal(r.length, 1);
  assert.equal(r[0].span, 1);
  assert.equal(r[0].col, 3);
});

test('layoutMonth ignores trips outside the grid', () => {
  const m = C.layoutMonth([T('far', '2027-03-01', '2027-03-02')], 2026, 11);
  assert.equal(barsOf(m, 'far').length, 0);
  assert.deepEqual(m.undated, []);
});

test('passwordProblem', () => {
  assert.equal(C.passwordProblem('oldpass12', '1234567', '1234567'), 'รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัว');
  assert.equal(C.passwordProblem('oldpass12', 'newpass123', 'newpass124'), 'รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน');
  assert.equal(C.passwordProblem('samepass1', 'samepass1', 'samepass1'), 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม');
  assert.equal(C.passwordProblem('oldpass12', 'newpass123', 'newpass123'), '');
  assert.equal(C.passwordProblem(null, 'newpass123', 'newpass123'), '');
});

test('mergeHolidays: admin edits rename, add and hide built-in days', () => {
  const file = { '2026-01-01': 'วันขึ้นปีใหม่', '2026-04-13': 'วันสงกรานต์' };
  const db = {
    '2026-04-13': { name: 'สงกรานต์ (แก้)' },
    '2026-01-01': { off: true },
    '2026-11-30': { name: 'วันหยุดพิเศษ' },
    'bad-key': { name: 'x' },
    '2026-02-02': { name: '' }
  };
  assert.deepEqual(C.mergeHolidays(file, db), { '2026-04-13': 'สงกรานต์ (แก้)', '2026-11-30': 'วันหยุดพิเศษ' });
  assert.deepEqual(C.mergeHolidays(file, null), file);
  assert.deepEqual(C.mergeHolidays(null, null), {});
});

test('layoutMonth with Sunday-first weeks', () => {
  const m = C.layoutMonth([T('a', '2026-12-10', '2026-12-12'), T('b', '2026-12-12', '2026-12-15')], 2026, 11, 0);
  assert.equal(m.weeks.length, 5);
  assert.equal(m.weeks[0].days[0], '2026-11-29');
  assert.equal(m.weeks[4].days[6], '2027-01-02');
  const a = barsOf(m, 'a');
  assert.deepEqual([a[0].week, a[0].col, a[0].span, a[0].startsHere, a[0].endsHere], [1, 4, 3, true, true]);
  const b = barsOf(m, 'b');
  assert.equal(b.length, 2);
  assert.deepEqual([b[0].week, b[0].col, b[0].span, b[0].endsHere], [1, 6, 1, false]);
  assert.deepEqual([b[1].week, b[1].col, b[1].span, b[1].startsHere], [2, 0, 3, false]);
  assert.equal(b[0].lane, 1);
});
