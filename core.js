/* ฟังก์ชันที่ไม่ยุ่งกับหน้าเว็บ ใช้ได้ทั้งในเบราว์เซอร์ (window.TripCore) และใน Node (สำหรับ test) */
(function (root) {
  'use strict';
  var DOMAIN = '@travel.local';
  var ADMIN_EMAIL = 'hwangning' + DOMAIN;

  function normalizeUsername(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function validUsername(s) { return /^[a-z0-9._-]{3,30}$/.test(normalizeUsername(s)); }
  function usernameToEmail(s) { return normalizeUsername(s) + DOMAIN; }
  function emailToUsername(email) { return String(email || '').toLowerCase().replace(DOMAIN, ''); }
  function isAdminEmail(email) { return String(email || '').toLowerCase() === ADMIN_EMAIL; }

  var AUTH_ERRORS = {
    'auth/invalid-credential': 'username หรือรหัสผ่านไม่ถูกต้อง',
    'auth/invalid-login-credentials': 'username หรือรหัสผ่านไม่ถูกต้อง',
    'auth/wrong-password': 'username หรือรหัสผ่านไม่ถูกต้อง',
    'auth/user-not-found': 'username หรือรหัสผ่านไม่ถูกต้อง',
    'auth/invalid-email': 'username หรือรหัสผ่านไม่ถูกต้อง',
    'auth/user-disabled': 'บัญชีนี้ถูกปิดแล้ว',
    'auth/too-many-requests': 'ลองผิดหลายครั้งเกินไป รอสักครู่แล้วลองใหม่',
    'auth/network-request-failed': 'เชื่อมต่ออินเทอร์เน็ตไม่ได้',
    'auth/weak-password': 'รหัสผ่านสั้นเกินไป',
    'auth/email-already-in-use': 'username นี้มีบัญชีใน Firebase อยู่แล้ว',
    'auth/requires-recent-login': 'กรุณาออกจากระบบแล้วเข้าใหม่ก่อน'
  };
  function authErrorText(code) { return AUTH_ERRORS[code] || 'เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง'; }

  function passwordProblem(oldPw, newPw, confirmPw) {
    newPw = String(newPw || '');
    if (newPw.length < 8) return 'รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัว';
    if (newPw !== String(confirmPw || '')) return 'รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน';
    if (oldPw != null && newPw === String(oldPw)) return 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม';
    return '';
  }

  /* ===== ปฏิทิน ===== */
  var DAY = 86400000;
  function parseIso(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function iso(t) { return new Date(t).toISOString().slice(0, 10); }

  // ตารางเดือน และวางแถบทริปเป็นชั้น (lane) ไม่ให้ทับกัน
  // weekStart: 0 = เริ่มวันอาทิตย์, 1 = เริ่มวันจันทร์ (ค่าเริ่มต้น)
  function layoutMonth(trips, year, month0, weekStart) {
    var ws = weekStart === 0 ? 0 : 1;
    var first = Date.UTC(year, month0, 1), last = Date.UTC(year, month0 + 1, 0);
    var gridStart = first - ((new Date(first).getUTCDay() - ws + 7) % 7) * DAY;
    var gridEnd = last + (6 - (new Date(last).getUTCDay() - ws + 7) % 7) * DAY;
    var weeks = [], undated = [];
    for (var w = gridStart; w <= gridEnd; w += 7 * DAY) {
      var days = [];
      for (var d = 0; d < 7; d++) days.push(iso(w + d * DAY));
      weeks.push({ start: w, days: days, bars: [], lanes: [] });
    }
    var spans = [];
    (trips || []).forEach(function (t) {
      var a = parseIso(t.start);
      if (a == null) { undated.push(t.id); return; }
      var b = parseIso(t.end);
      if (b == null || b < a) b = a;
      if (b < gridStart || a > gridEnd) return;
      spans.push({ id: t.id, a: a, b: b });
    });
    spans.sort(function (x, y) { return x.a - y.a || (y.b - y.a) - (x.b - x.a); });
    spans.forEach(function (s) {
      weeks.forEach(function (wk) {
        var ws = wk.start, we = ws + 6 * DAY;
        if (s.b < ws || s.a > we) return;
        var from = Math.max(s.a, ws), to = Math.min(s.b, we);
        var col = Math.round((from - ws) / DAY), span = Math.round((to - from) / DAY) + 1;
        var lane = 0;
        while (true) {
          var used = wk.lanes[lane] || (wk.lanes[lane] = []), free = true;
          for (var c = col; c < col + span; c++) if (used[c]) { free = false; break; }
          if (free) break;
          lane++;
        }
        for (var c2 = col; c2 < col + span; c2++) wk.lanes[lane][c2] = true;
        wk.bars.push({ tripId: s.id, col: col, span: span, lane: lane, startsHere: s.a >= ws, endsHere: s.b <= we });
      });
    });
    return {
      weeks: weeks.map(function (wk) { return { days: wk.days, bars: wk.bars, laneCount: wk.lanes.length }; }),
      undated: undated
    };
  }

  // วันหยุดจากไฟล์ (holidays.js) + ที่ admin แก้ในเว็บ: { name } = เพิ่ม/เปลี่ยนชื่อ · { off: true } = ซ่อนวันจากไฟล์
  function mergeHolidays(file, db) {
    var out = {}, k;
    for (k in (file || {})) if (parseIso(k) != null && file[k]) out[k] = String(file[k]);
    for (k in (db || {})) {
      if (parseIso(k) == null || !db[k]) continue;
      if (db[k].off) delete out[k];
      else if (db[k].name) out[k] = String(db[k].name);
    }
    return out;
  }

  var api = {
    mergeHolidays: mergeHolidays,
    ADMIN_EMAIL: ADMIN_EMAIL, normalizeUsername: normalizeUsername, validUsername: validUsername,
    usernameToEmail: usernameToEmail, emailToUsername: emailToUsername, isAdminEmail: isAdminEmail,
    authErrorText: authErrorText, passwordProblem: passwordProblem, layoutMonth: layoutMonth
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TripCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
