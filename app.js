/* ทริปของฉัน — บันทึกทริปและค่าใช้จ่าย
 * เก็บข้อมูลใน Firebase Realtime Database (ตั้งค่าใน firebase-config.js)
 * ถ้ายังไม่ได้ตั้งค่า จะเก็บในเบราว์เซอร์เครื่องนี้แทน (localStorage + IndexedDB สำหรับรูป)
 */
(function () {
  'use strict';

  /* ===== ค่าคงที่ ===== */
  var CATS = [
    { key: 'travel', label: 'การเดินทาง', color: '#2456A6', bg: '#E7EEF9', qty: 'จำนวน (คน/วัน)', namePh: 'เช่น ตั๋วเครื่องบิน กรุงเทพ → เชียงใหม่', notePh: 'สายการบิน เวลา เลขที่จอง' },
    { key: 'stay', label: 'ที่พัก', color: '#6542A6', bg: '#EFEAF8', qty: 'จำนวนคืน', namePh: 'เช่น โรงแรมย่านนิมมาน', notePh: 'ประเภทห้อง เช็กอิน/เอาต์' },
    { key: 'place', label: 'ที่เที่ยว', color: '#0B6B5F', bg: '#E2F1EE', qty: 'จำนวนตั๋ว', namePh: 'เช่น ดอยอินทนนท์', notePh: 'ค่าเข้า ค่ารถ เวลาเปิด' },
    { key: 'food', label: 'อาหาร', color: '#A84A12', bg: '#FBEBDD', qty: 'จำนวนมื้อ', namePh: 'เช่น ข้าวซอยร้านดัง', notePh: 'ร้าน เมนูเด็ด' },
    { key: 'shop', label: 'ช้อปปิ้ง', color: '#A3326B', bg: '#FAE6EF', qty: 'จำนวนชิ้น', namePh: 'เช่น ของฝาก ร่มบ่อสร้าง', notePh: 'ร้าน ซื้อให้ใคร' }
  ];
  var CAT = {}; CATS.forEach(function (c) { CAT[c.key] = c; });
  var THEMES = [
    { key: 'sea', label: 'ทะเล', color: '#0E5468' },
    { key: 'forest', label: 'ภูเขา', color: '#2F5D3A' },
    { key: 'sunset', label: 'แดดเย็น', color: '#9C3D1F' },
    { key: 'sakura', label: 'ซากุระ', color: '#8E3A5E' },
    { key: 'sand', label: 'ทราย', color: '#7A5F28' },
    { key: 'night', label: 'กลางคืน', color: '#1B2430' }
  ];
  var ROOT = 'planner';
  var LS_KEY = 'trip-planner-v1';
  var MAX_PHOTOS = 8;

  /* ===== ตัวช่วย ===== */
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return '฿' + Math.round(n || 0).toLocaleString('th-TH'); }
  function uid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function toDate(s) { return s ? new Date(s + 'T00:00:00') : null; }
  function fmt(s, opt) { var d = toDate(s); return d && !isNaN(d) ? d.toLocaleDateString('th-TH', opt) : ''; }
  function fmtShort(s) { return fmt(s, { day: 'numeric', month: 'short' }); }
  function fmtLong(s) { return fmt(s, { day: 'numeric', month: 'short', year: 'numeric' }); }
  function themeColor(k) { for (var i = 0; i < THEMES.length; i++) if (THEMES[i].key === k) return THEMES[i].color; return THEMES[0].color; }
  function dayCount(t) {
    var a = toDate(t.start), b = toDate(t.end);
    if (!a || !b || b < a) return 1;
    return Math.round((b - a) / 86400000) + 1;
  }
  function safeUrl(u) { return /^https?:\/\//i.test(u || '') ? u : ''; }
  function gm(q) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q); }
  function vals(o) { return o ? Object.keys(o).map(function (k) { return o[k]; }) : []; }
  function arr(a) { return Array.isArray(a) ? a.filter(Boolean) : a ? vals(a) : []; }
  function lineTotal(i) { return (Number(i.price) || 0) * (Number(i.qty) || 1); }
  var toastTimer, toastDone = null;
  // toast(msg) แจ้งเฉย ๆ · toast(msg, { undo: fn, done: fn }) มีปุ่ม "เลิกทำ"
  // done() ทำงานเมื่อหมดเวลาหรือมีแจ้งเตือนใหม่มาแทน (เช่น ลบรูปจริงหลังพ้นช่วงเลิกทำ)
  function toast(msg, o) {
    var t = $('#toast'), prev = toastDone;
    toastDone = null; clearTimeout(toastTimer);
    if (prev) prev();
    t.textContent = '';
    var s = document.createElement('span'); s.textContent = msg; t.appendChild(s);
    if (o && o.undo) {
      toastDone = o.done || null;
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'toast-act'; b.textContent = 'เลิกทำ';
      b.addEventListener('click', function () {
        toastDone = null; clearTimeout(toastTimer); t.hidden = true; o.undo();
      });
      t.appendChild(b);
    }
    t.hidden = false;
    toastTimer = setTimeout(function () {
      t.hidden = true; var d = toastDone; toastDone = null; if (d) d();
    }, o && o.undo ? 8000 : 3200);
  }
  var ICON = {
    pin: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    pen: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/></svg>',
    trash: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    x: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    img: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 8"/></svg>',
    cal: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>',
    clock: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    zoom: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5M11 8.5v5M8.5 11h5"/></svg>',
    imgOff: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M4 4l16 16"/></svg>',
    trashS: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    dots: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
    penS: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/></svg>',
    c_travel: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>',
    c_stay: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
    c_place: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    c_food: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3v18M4.5 3v5a2.5 2.5 0 0 0 5 0V3M17 21V3c-2 1-3.5 3.5-3.5 7v4H17"/></svg>',
    c_shop: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l-1.2 12H6.2zM9 8V6a3 3 0 0 1 6 0v2"/></svg>',
    car: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 16V11l2-5h10l2 5v5M3 16h18v3H3zM5 11h14"/><circle cx="7.5" cy="16" r="1"/><circle cx="16.5" cy="16" r="1"/></svg>',
    home: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
    coin: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1.1 1.6 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6.5v11"/></svg>',
    phone: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/></svg>',
    check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#2F7D4F"/><path d="M7.5 12.5l3 3 6-6.5" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    bulb: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></svg>',
    route: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h7.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H16"/></svg>',
    wallet: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h15a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2h11"/><path d="M16 13.5h.01"/></svg>',
    chevL: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    chevR: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    spark: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>',
    download: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
    plus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    people: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18.5 14.8c1.6.8 2.6 2.6 3 5.2"/></svg>'
  };

  /* ===== สถานะ ===== */
  var state = {
    db: { trips: {}, items: {}, users: {}, holidays: {} },
    me: null,             // { uid, username, name, isAdmin } หลัง login
    loaded: false,
    selectedId: null,
    filter: 'all',
    editingItemId: null,
    draft: null,          // ฟอร์มรายการ
    tripDraft: null,      // ฟอร์มทริป (dialog)
    lightbox: null,       // { title, ids:[photoId], src:[dataURL]?, index }
    view: (function () { try { return localStorage.getItem('trip-planner-view') || 'plan'; } catch (e) { return 'plan'; } })(),
    dayKey: null,
    route: 'calendar',
    calMonth: null,       // { y, m } เดือนที่แสดงในปฏิทิน
    pending: 0,           // จำนวนทริปที่ยังโหลดครั้งแรกไม่เสร็จ
    busy: 0
  };

  /* ===== ที่เก็บรูป: IndexedDB (โหมดเครื่องนี้) ===== */
  var idb = (function () {
    var dbp;
    function open() {
      if (!dbp) dbp = new Promise(function (res, rej) {
        var r = indexedDB.open('trip-planner', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('blobs'); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
      });
      return dbp;
    }
    function run(mode, fn) {
      return open().then(function (db) {
        return new Promise(function (res, rej) {
          var t = db.transaction('blobs', mode), req = fn(t.objectStore('blobs'));
          t.oncomplete = function () { res(req && req.result); };
          t.onerror = function () { rej(t.error); };
        });
      });
    }
    return {
      get: function (k) { return run('readonly', function (s) { return s.get(k); }); },
      set: function (k, v) { return run('readwrite', function (s) { s.put(v, k); }); },
      del: function (k) { return run('readwrite', function (s) { s.delete(k); }); }
    };
  })();

  /* ===== ข้อมูล: Firebase หรือเครื่องนี้ ===== */
  var fdb = null;
  var blobCache = new Map(); // 'thumbs/id' | 'photos/id' -> dataURL string | Promise

  function setIn(obj, path, v) {
    var parts = path.split('/'), o = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      if (!o[parts[i]] || typeof o[parts[i]] !== 'object') { if (v === null) return; o[parts[i]] = {}; }
      o = o[parts[i]];
    }
    var last = parts[parts.length - 1];
    if (v === null) delete o[last]; else o[last] = v;
  }
  function saveLocal() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state.db)); }
    catch (e) { toast('บันทึกในเครื่องไม่สำเร็จ (พื้นที่เต็ม?)'); }
  }
  function loadLocal() {
    try {
      var d = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      state.db.trips = d.trips || {}; state.db.items = d.items || {};
    } catch (e) { /* ข้อมูลเสีย: เริ่มใหม่ */ }
  }
  /** เขียนหลาย path พร้อมกัน เช่น {'trips/t1': {...}, 'items/t1/i1': null} */
  function commit(paths) {
    Object.keys(paths).forEach(function (p) { setIn(state.db, p, paths[p]); });
    render();
    if (fdb) return fdb.ref(ROOT).update(paths).catch(function (e) { onWriteErr(e); throw e; });
    saveLocal();
    return Promise.resolve();
  }
  function getBlob(kind, id) {
    var key = kind + '/' + id;
    if (blobCache.has(key)) return Promise.resolve(blobCache.get(key));
    var p = (fdb ? fdb.ref(ROOT + '/' + key).once('value').then(function (s) { return s.val(); }) : idb.get(key))
      .then(function (v) { v = typeof v === 'string' ? v : ''; blobCache.set(key, v); return v; })
      .catch(function () { blobCache.delete(key); return ''; });
    blobCache.set(key, p);
    return p;
  }
  function putPhoto(p, tripId) {
    blobCache.set('thumbs/' + p.id, p.thumb); blobCache.set('photos/' + p.id, p.full);
    if (fdb) {
      // photoTrip: รูปนี้เป็นของทริปไหน กฎฐานข้อมูลให้เฉพาะสมาชิกทริปนั้นแก้หรือลบรูปได้
      var u = {}; u['thumbs/' + p.id] = p.thumb; u['photos/' + p.id] = p.full; u['photoTrip/' + p.id] = tripId;
      return fdb.ref(ROOT).update(u);
    }
    return Promise.all([idb.set('thumbs/' + p.id, p.thumb), idb.set('photos/' + p.id, p.full)]);
  }
  function deletePhotos(ids) {
    ids = ids.filter(Boolean);
    if (!ids.length) return Promise.resolve();
    ids.forEach(function (id) { blobCache.delete('thumbs/' + id); blobCache.delete('photos/' + id); });
    if (fdb) {
      var u = {}; ids.forEach(function (id) { u['thumbs/' + id] = null; u['photos/' + id] = null; u['photoTrip/' + id] = null; });
      return fdb.ref(ROOT).update(u).catch(function () {});
    }
    return Promise.all(ids.map(function (id) { return Promise.all([idb.del('thumbs/' + id), idb.del('photos/' + id)]); })).catch(function () {});
  }
  /** ใส่รูปให้ <img data-thumb="id"> / <img data-photo="id"> หลัง render */
  function hydrate(root) {
    (root || document).querySelectorAll('img[data-thumb],img[data-photo]').forEach(function (img) {
      var kind = img.dataset.thumb ? 'thumbs' : 'photos', id = img.dataset.thumb || img.dataset.photo;
      var c = blobCache.get(kind + '/' + id);
      if (typeof c === 'string') { if (c) img.src = c; return; }
      getBlob(kind, id).then(function (src) { if (src && img.isConnected) img.src = src; });
    });
  }

  /* ===== สถานะการซิงก์ ===== */
  function setSync(kind) {
    var m = {
      local: ['', 'เก็บข้อมูลในเครื่องนี้เท่านั้น (ยังไม่ได้ตั้งค่า Firebase)'],
      wait: ['', 'กำลังเชื่อมต่อ…'],
      live: ['live', 'ซิงก์อยู่ · เปิดจากเครื่องไหนก็เห็นข้อมูลเดียวกัน'],
      err: ['err', 'เชื่อมต่อไม่ได้ ข้อมูลที่แก้อาจยังไม่ถูกบันทึก']
    }[kind];
    var s = $('#sync'); s.className = 'sync ' + m[0]; s.lastChild.textContent = m[1];
    var ts = $('#topSync'); ts.className = 'top-sync sync ' + m[0]; ts.setAttribute('aria-label', m[1]); ts.title = m[1];
  }
  function onWriteErr() { setSync('err'); toast('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง'); }

  /* ===== รูป: ย่อขนาดก่อนเก็บ ===== */
  function loadImage(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); res(img); };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('decode')); };
      img.src = url;
    });
  }
  function toJpeg(img, max, q) {
    var w0 = img.naturalWidth, h0 = img.naturalHeight, s = Math.min(1, max / Math.max(w0, h0));
    var w = Math.max(1, Math.round(w0 * s)), h = Math.max(1, Math.round(h0 * s));
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h);
    return c.toDataURL('image/jpeg', q);
  }
  function processFile(file) {
    if (!/^image\//.test(file.type)) return Promise.reject(new Error('type'));
    return loadImage(file).then(function (img) {
      var full = toJpeg(img, 1600, 0.82);
      if (full.length > 1400000) full = toJpeg(img, 1280, 0.72);
      return { id: uid('p'), thumb: toJpeg(img, 360, 0.72), full: full, isNew: true };
    });
  }

  /* ===== ข้อมูลที่คำนวณ ===== */
  function currentTrip() { var t = state.db.trips[state.selectedId] || null; if (t) t.id = state.selectedId; return t; }
  function tripMembers(t) { return t && t.members ? Object.keys(t.members).filter(function (k) { return t.members[k]; }) : []; }
  // เจ้าของทริปหรือ admin: เพิ่ม/เอาคนออก และลบทริปได้ (โหมดเก็บในเครื่องไม่มีระบบผู้ใช้ จึงทำได้ทุกอย่าง)
  function canManage(t) { var me = state.me; return !me || me.isAdmin || (!!t && t.ownerId === me.uid); }
  function tripItems(id) {
    var o = state.db.items[id] || {};
    return Object.keys(o).map(function (k) { var i = o[k]; i.id = k; return i; });
  }
  function tripTotal(id) { return tripItems(id).reduce(function (s, i) { return s + lineTotal(i); }, 0); }
  function sortedTrips() {
    return Object.keys(state.db.trips).map(function (k) { var t = state.db.trips[k]; if (t) t.id = k; return t; }).filter(Boolean)
      .sort(function (a, b) {
        var x = a.start || '9999', y = b.start || '9999';
        return x === y ? (b.createdAt || 0) - (a.createdAt || 0) : y.localeCompare(x);
      });
  }
  function ensureSelected() { /* ทริปที่เปิดอยู่มาจาก URL (#trip=<id>) ผ่าน route() */ }
  function selectTrip(id) { go('#trip=' + encodeURIComponent(id)); }

  /* ===== หน้า: #calendar (หน้าแรก) · #trip=<id> · #account · #users ===== */
  function go(h) { if (location.hash === h) route(); else location.hash = h; }
  function route() {
    var h = location.hash || '', m = /^#trip=(.+)$/.exec(h), prev = state.route;
    if (m) {
      var id = decodeURIComponent(m[1]);
      state.route = 'trip';
      if (state.selectedId !== id) { state.selectedId = id; state.filter = 'all'; state.dayKey = null; resetDraft(); }
    } else {
      state.route = h === '#account' ? 'account' : (h === '#users' ? 'users' : 'calendar');
      if (state.route === 'users' && !(state.me && state.me.isAdmin)) state.route = 'calendar';
      if (state.route === 'account' && !state.me) state.route = 'calendar';
    }
    closeOverlays();
    render();
    if (prev !== state.route || m) window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  /* ===== แผนรายวัน ===== */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function isoDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function timeRange(i) { return i.timeStart ? i.timeStart + (i.timeEnd ? ' – ' + i.timeEnd : '') : ''; }
  function isIsoDay(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function tripDays(t) {
    var out = [], seen = {}, a = toDate(t.start), b = toDate(t.end || t.start);
    if (a && b && !isNaN(a) && !isNaN(b) && b >= a) {
      for (var d = new Date(a); d <= b && out.length < 90; d.setDate(d.getDate() + 1)) { var k = isoDate(d); seen[k] = 1; out.push(k); }
    }
    // วันที่จากรายการต้องเป็นรูปแบบ YYYY-MM-DD เท่านั้น (ข้อมูลแปลก ๆ จะไม่ถูกนำมาแสดง)
    tripItems(t.id).forEach(function (i) { if (isIsoDay(i.date) && !seen[i.date]) { seen[i.date] = 1; out.push(i.date); } });
    return out.sort();
  }
  function dayItems(t, key) {
    return tripItems(t.id).filter(function (i) { return i.date === key; }).sort(function (a, b) {
      return (a.timeStart || '99').localeCompare(b.timeStart || '99') || (a.createdAt || 0) - (b.createdAt || 0);
    });
  }
  function currentDay(t, days) {
    if (state.dayKey && days.indexOf(state.dayKey) >= 0) return state.dayKey;
    var today = isoDate(new Date());
    return days.indexOf(today) >= 0 ? today : days[0];
  }
  function routeUrl(t, stops) {
    var pts = stops.map(function (i) { return i.address || (i.name + (t.destination ? ' ' + t.destination : '')); });
    if (!pts.length) return '';
    if (pts.length === 1) return gm(pts[0]);
    var u = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=' + encodeURIComponent(pts[0]) +
      '&destination=' + encodeURIComponent(pts[pts.length - 1]);
    var mid = pts.slice(1, -1).slice(0, 8);
    if (mid.length) u += '&waypoints=' + mid.map(encodeURIComponent).join('%7C');
    return u;
  }
  function renderViewTabs() {
    $('#viewTabs').innerHTML = [['plan', ICON.cal, 'แผนรายวัน'], ['cost', ICON.wallet, 'ค่าใช้จ่าย']].map(function (v) {
      return '<button type="button" class="view-tab" role="tab" data-act="set-view" data-view="' + v[0] + '" aria-selected="' + (state.view === v[0]) + '">' + v[1] + v[2] + '</button>';
    }).join('');
  }
  function renderPlan(t) {
    var box = $('#planView'), days = tripDays(t);
    if (!days.length) {
      box.innerHTML = '<div class="card plan-empty"><b>ยังไม่มีวันในทริปนี้</b><span class="muted">ใส่วันไป–วันกลับของทริป แล้วจะได้แผน Day 1, Day 2, … ให้อัตโนมัติ</span>' +
        '<button type="button" class="btn-primary" data-act="edit-trip">ใส่วันที่ของทริป</button></div>';
      return;
    }
    var key = currentDay(t, days); state.dayKey = key;
    var idx = days.indexOf(key), items = dayItems(t, key), info = (t.days && t.days[key]) || {};
    var tips = arr(info.tips), total = items.reduce(function (s, i) { return s + lineTotal(i); }, 0);
    var color = themeColor(t.theme);
    var chips = '<div class="day-tabs" role="tablist" aria-label="เลือกวัน">' + days.map(function (k, n) {
      return '<button type="button" class="day-tab" role="tab" data-act="pick-day" data-day="' + esc(k) + '" aria-selected="' + (k === key) + '"><b>Day ' + (n + 1) + '</b><span>' + fmtShort(k) + '</span></button>';
    }).join('') + '</div>';
    chips = '<div class="day-tabs-row">' + chips + '<div class="plan-tools"><button type="button" class="btn-ai" data-act="open-ai">' + ICON.spark + 'ให้ AI ช่วยจัดแพลน</button>' +
      '<button type="button" class="btn-secondary small-btn export-all" data-act="export-all">' + ICON.download + 'บันทึกทุกวันเป็นรูป</button></div></div>';
    var route = items.map(function (i) { return i.name; });
    var head = '<section class="day-head" style="--hero:' + color + '">' +
      (t.coverId ? '<img class="hero-img" data-photo="' + esc(t.coverId) + '" alt=""><div class="day-scrim"></div>' : '') +
      '<div class="day-head-in"><div class="day-badge">DAY ' + (idx + 1) + '</div>' +
      '<div class="day-head-text"><h2>' + fmt(key, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + '</h2>' +
      (route.length ? '<p class="day-route">' + route.map(esc).join(' <span aria-hidden="true">→</span> ') + '</p>' : '') +
      (info.tagline ? '<p class="day-tagline">' + esc(info.tagline) + '</p>' : '') + '</div></div>' +
      '<div class="day-bar"><span>' + items.length + ' จุด · ค่าใช้จ่ายวันนี้ <b>' + money(total) + '</b></span>' +
      '<span class="day-bar-actions">' +
      '<button type="button" class="btn-glass" data-act="day-step" data-dir="-1" aria-label="วันก่อนหน้า"' + (idx === 0 ? ' disabled' : '') + '>' + ICON.chevL + '</button>' +
      '<button type="button" class="btn-glass" data-act="edit-day" aria-label="แก้ไขคำโปรยและเคล็ดลับของวันนี้">' + ICON.penS + '<span class="lbl">ข้อมูลวัน</span></button>' +
      '<button type="button" class="btn-glass" data-act="add-stop" data-day="' + esc(key) + '">' + ICON.plus + '<span class="lbl">เพิ่มจุด</span></button>' +
      '<button type="button" class="btn-glass" data-act="export-day" aria-label="บันทึกแผนวันนี้เป็นรูป" title="บันทึกแผนวันนี้เป็นรูป">' + ICON.download + '<span class="lbl">บันทึกรูป</span></button>' +
      '<button type="button" class="btn-glass" data-act="day-step" data-dir="1" aria-label="วันถัดไป"' + (idx === days.length - 1 ? ' disabled' : '') + '>' + ICON.chevR + '</button>' +
      '</span></div></section>';

    var timeline = items.length ? '<ol class="timeline">' + items.map(function (i) {
      var c = CAT[i.cat] || CATS[0], photos = arr(i.photoIds), map = safeUrl(i.map), tel = (i.phone || '').replace(/[^\d+]/g, '');
      var facts = [];
      if (i.address) facts.push('<li>' + ICON.pin + '<span><b>ที่อยู่:</b> ' + esc(i.address) + '</span></li>');
      if (i.hours) facts.push('<li>' + (i.cat === 'stay' ? ICON.home : ICON.clock) + '<span><b>' + (i.cat === 'stay' ? 'เช็กอิน/เอาต์' : 'เวลาเปิด') + ':</b> ' + esc(i.hours) + '</span></li>');
      facts.push('<li>' + ICON.coin + '<span><b>ค่าใช้จ่าย:</b> ' + (lineTotal(i) > 0 ? money(lineTotal(i)) + ((Number(i.qty) || 1) > 1 ? ' <span class="muted">(' + money(i.price) + ' × ' + (Number(i.qty) || 1) + ')</span>' : '') : 'ไม่มี / ยังไม่ระบุ') + '</span></li>');
      if (i.phone) facts.push('<li>' + ICON.phone + '<span>' + (tel ? '<a href="tel:' + esc(tel) + '">' + esc(i.phone) + '</a>' : esc(i.phone)) + '</span></li>');
      if (map) facts.push('<li>' + ICON.pin + '<span><a href="' + esc(map) + '" target="_blank" rel="noopener">เปิดใน Google Maps</a></span></li>');
      return '<li class="stop' + (state.editingItemId === i.id ? ' editing' : '') + '" style="--c:' + c.color + ';--cbg:' + c.bg + '">' +
        '<div class="stop-time"><span class="stop-dot" aria-hidden="true"></span><b>' + (i.timeStart ? esc(i.timeStart) : '—') + '</b>' +
        (i.timeEnd ? '<span>– ' + esc(i.timeEnd) + '</span>' : (i.timeStart ? '' : '<span>ไม่ระบุเวลา</span>')) + '</div>' +
        '<div class="stop-card">' +
        '<div class="stop-main">' +
        '<div class="stop-title"><span class="stop-ic" aria-hidden="true">' + ICON['c_' + c.key] + '</span><div><h3>' + esc(i.name) + '</h3><span class="chip" style="color:' + c.color + ';background:' + c.bg + '">' + c.label + '</span>' + aiBadge(i) + '</div>' +
        '<span class="stop-actions"><button type="button" class="icon-btn" data-act="edit-item" data-id="' + esc(i.id) + '" aria-label="' + esc('แก้ไข ' + i.name) + '">' + ICON.pen + '</button>' +
        '<button type="button" class="icon-btn" data-act="delete-item" data-id="' + esc(i.id) + '" aria-label="' + esc('ลบ ' + i.name) + '">' + ICON.trash + '</button></span></div>' +
        (i.note ? '<p class="stop-desc">' + esc(i.note) + '</p>' : '') +
        (i.travel ? '<div class="stop-travel">' + ICON.car + '<span>' + esc(i.travel) + '</span></div>' : '') +
        '<ul class="stop-facts">' + facts.join('') + '</ul>' +
        '</div>' +
        (photos.length ? '<button type="button" class="stop-photo" data-act="open-photo" data-id="' + esc(i.id) + '" data-idx="0" aria-label="' + esc('ดูรูปของ ' + i.name) + '"><img data-thumb="' + esc(photos[0]) + '" alt="">' +
          (photos.length > 1 ? '<span class="stop-more">+' + (photos.length - 1) + '</span>' : '') + '</button>' : '') +
        '</div></li>';
    }).join('') + '</ol>'
      : '<div class="card plan-empty"><b>ยังไม่มีจุดแวะในวันนี้</b><span class="muted">กด "เพิ่มจุด" แล้วใส่เวลา ชื่อสถานที่ และรายละเอียด</span>' +
        '<button type="button" class="btn-primary" data-act="add-stop" data-day="' + esc(key) + '">' + ICON.plus + 'เพิ่มจุดแรกของวัน</button></div>';

    var overview = items.length > 1 ? '<section class="card route-card"><h3>' + ICON.car + 'เส้นทางโดยรวม <span class="muted small">(เวลาโดยประมาณ)</span></h3><div class="route">' +
      items.map(function (i, n) {
        var c = CAT[i.cat] || CATS[0], ph = arr(i.photoIds)[0];
        return (n ? '<div class="route-leg"><span class="route-line" aria-hidden="true"></span><span>' + esc(i.travel || '') + '</span></div>' : '') +
          '<div class="route-node"><span class="route-pic" style="background:' + c.bg + ';color:' + c.color + '">' + (ph ? '<img data-thumb="' + esc(ph) + '" alt="">' : ICON['c_' + c.key]) + '</span><span class="route-name">' + esc(i.name) + '</span></div>';
      }).join('') + '</div>' +
      '<a class="btn-secondary route-btn" href="' + esc(routeUrl(t, items)) + '" target="_blank" rel="noopener">' + ICON.route + 'เปิดเส้นทางวันนี้ใน Google Maps</a></section>' : '';
    var tipsBox = '<section class="card tips-card"><div class="tips-head"><h3>' + ICON.bulb + 'เคล็ดลับเพิ่มเติม</h3>' +
      '<button type="button" class="btn-secondary small-btn" data-act="edit-day">' + (tips.length ? 'แก้ไข' : '+ เพิ่ม') + '</button></div>' +
      (tips.length ? '<ul class="tips">' + tips.map(function (x) { return '<li>' + ICON.check + '<span>' + esc(x) + '</span></li>'; }).join('') + '</ul>'
        : '<p class="muted small" style="margin:0">ยังไม่มีเคล็ดลับของวันนี้ เช่น ของที่ต้องเตรียม หรือสิ่งที่ควรระวัง</p>') + '</section>';
    box.innerHTML = chips + head + timeline + overview + tipsBox;
  }
  var dayDialog = $('#dayDialog'), dayForm = $('#dayForm');
  function openDayDialog() {
    var t = currentTrip(); if (!t || !state.dayKey) return;
    var info = (t.days && t.days[state.dayKey]) || {}, days = tripDays(t);
    $('#dayDialogTitle').textContent = 'Day ' + (days.indexOf(state.dayKey) + 1) + ' · ' + fmtLong(state.dayKey);
    dayForm.tagline.value = info.tagline || '';
    dayForm.tips.value = arr(info.tips).join('\n');
    closeOverlays();
    if (typeof dayDialog.showModal === 'function') dayDialog.showModal(); else dayDialog.setAttribute('open', '');
    dayForm.tagline.focus();
  }
  dayForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var t = currentTrip(); if (!t) return;
    var tagline = dayForm.tagline.value.trim();
    var tips = dayForm.tips.value.split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 30);
    var u = {}; u['trips/' + t.id + '/days/' + state.dayKey] = (tagline || tips.length) ? { tagline: tagline, tips: tips } : null;
    commit(u).then(function () { dayDialog.close(); toast('บันทึกข้อมูลวันแล้ว'); }).catch(function () {});
  });

  /* ===== ช่องวันที่ วว/ดด/ปปปป และเวลา 24 ชม. =====
   * เก็บข้อมูลเป็น yyyy-mm-dd และ HH:MM เหมือนเดิม แสดง/พิมพ์เป็น dd/mm/yyyy และ 24 ชั่วโมง
   * ปีพิมพ์เป็น พ.ศ. ได้ (เช่น 2569) ระบบแปลงเป็น ค.ศ. ให้ */
  function isoToDmy(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }
  function dmyToIso(s) {
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((s || '').trim()); if (!m) return '';
    var d = +m[1], mo = +m[2], y = +m[3]; if (y > 2400) y -= 543;
    var dt = new Date(y, mo - 1, d);
    if (y < 1900 || dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return '';
    return y + '-' + pad(mo) + '-' + pad(d);
  }
  function normTime(s) {
    var m = /^(\d{1,2})[:.]?(\d{2})$/.exec((s || '').trim()); if (!m) return '';
    var h = +m[1], mi = +m[2]; return h < 24 && mi < 60 ? pad(h) + ':' + pad(mi) : '';
  }
  function setField(el, v) {
    var k = el.dataset && el.dataset.kind;
    el.value = k === 'date' ? isoToDmy(v) : k === 'time' ? normTime(v) : (v == null ? '' : v);
  }
  function getField(el) {
    var k = el.dataset && el.dataset.kind;
    return k === 'date' ? dmyToIso(el.value) : k === 'time' ? normTime(el.value) : el.value;
  }
  function badField(f) {
    var els = f.querySelectorAll('[data-kind]');
    for (var k = 0; k < els.length; k++) {
      var el = els[k]; if (!el.value.trim() || getField(el)) continue;
      el.focus();
      return el.dataset.kind === 'date' ? 'วันที่ไม่ถูกต้อง ใส่แบบ วว/ดด/ปปปป เช่น 10/12/2026' : 'เวลาไม่ถูกต้อง ใส่แบบ 24 ชั่วโมง เช่น 09:30 หรือ 17:45';
    }
    return '';
  }
  // จัดรูปแบบขณะพิมพ์ (ทำก่อน handler ของฟอร์ม)
  document.addEventListener('input', function (e) {
    var el = e.target, k = el.dataset && el.dataset.kind;
    if (!k || (e.inputType && e.inputType.indexOf('delete') === 0)) return;
    var v = el.value, digits = v.replace(/\D/g, '');
    if (k === 'date') {
      if (/^\d{1,2}\/\d{1,2}\/\d{0,4}$/.test(v) || /^\d{1,2}\/\d{0,2}$/.test(v)) {
        if (/^\d\/$/.test(v)) el.value = '0' + v; // 1/ -> 01/
        else if (/^\d{2}\/\d\/$/.test(v)) el.value = v.slice(0, 3) + '0' + v.slice(3);
        return;
      }
      digits = digits.slice(0, 8);
      el.value = digits.length > 4 ? digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4)
        : digits.length > 2 ? digits.slice(0, 2) + '/' + digits.slice(2) + (digits.length === 4 ? '/' : '')
        : digits + (digits.length === 2 ? '/' : '');
    } else {
      if (/^\d{1,2}:\d{0,2}$/.test(v)) return;
      digits = digits.slice(0, 4);
      el.value = digits.length > 2 ? digits.slice(0, 2) + ':' + digits.slice(2) : digits + (digits.length === 2 ? ':' : '');
    }
  }, true);
  document.addEventListener('blur', function (e) {
    var el = e.target, k = el.dataset && el.dataset.kind, v = getField(el);
    if (k && v) el.value = k === 'date' ? isoToDmy(v) : v; // 1/2/2569 -> 01/02/2026
  }, true);
  // ปุ่มปฏิทินข้างช่องวันที่
  function enhanceDates() {
    document.querySelectorAll('input[data-kind="date"]').forEach(function (el) {
      if (el.dataset.enhanced) return; el.dataset.enhanced = '1';
      var wrap = document.createElement('span'); wrap.className = 'dt-wrap';
      el.parentNode.insertBefore(wrap, el); wrap.appendChild(el);
      var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'dt-btn';
      btn.setAttribute('aria-label', 'เลือกจากปฏิทิน'); btn.title = 'เลือกจากปฏิทิน'; btn.innerHTML = ICON.cal;
      var nat = document.createElement('input'); nat.type = 'date'; nat.className = 'dt-native'; nat.tabIndex = -1; nat.setAttribute('aria-hidden', 'true');
      wrap.appendChild(btn); wrap.appendChild(nat);
      btn.addEventListener('click', function () {
        nat.value = getField(el) || '';
        try { if (nat.showPicker) { nat.showPicker(); return; } } catch (err) { /* ไม่รองรับ */ }
        nat.focus(); nat.click();
      });
      nat.addEventListener('change', function () {
        if (!nat.value) return;
        el.value = isoToDmy(nat.value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
  }

  /* ===== บันทึกแผนเป็นรูป (อินโฟกราฟิกรายวัน) ===== */
  var libPromise = null;
  function loadLib() {
    if (window.htmlToImage) return Promise.resolve(window.htmlToImage);
    if (!libPromise) libPromise = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = 'lib/html-to-image.js';
      s.onload = function () { window.htmlToImage ? res(window.htmlToImage) : rej(new Error('lib')); };
      s.onerror = function () { libPromise = null; rej(new Error('lib')); };
      document.head.appendChild(s);
    });
    return libPromise;
  }
  function slug(s) { return String(s || 'trip').replace(/[\\/:*?"<>|#%]+/g, '').replace(/\s+/g, '-').slice(0, 60) || 'trip'; }
  function buildExportDay(t, key, n, photo) {
    var items = dayItems(t, key), info = (t.days && t.days[key]) || {}, tips = arr(info.tips);
    var total = items.reduce(function (s, i) { return s + lineTotal(i); }, 0);
    var cover = t.coverId && photo[t.coverId];
    var h = '<div class="ex" style="--hero:' + themeColor(t.theme) + '">';
    h += '<div class="ex-head' + (cover ? ' has-cover' : '') + '">' + (cover ? '<img src="' + cover + '" alt="">' : '') + '<div class="ex-shade"></div>' +
      '<div class="ex-head-in"><div class="ex-badge">DAY ' + n + '</div><div class="ex-head-text">' +
      '<div class="ex-date">' + fmt(key, { day: 'numeric', month: 'long', year: 'numeric' }) + '<span>' + fmt(key, { weekday: 'long' }) + '</span></div>' +
      (items.length ? '<div class="ex-route">' + items.map(function (i) { return esc(i.name); }).join('<svg class="ex-to" viewBox="0 0 18 14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 7h15M11 2l5 5-5 5"/></svg>') + '</div>' : '') +
      (info.tagline ? '<div class="ex-tag">' + esc(info.tagline) + '</div>' : '') +
      '</div></div><div class="ex-dest">' + esc(t.destination || t.name) + '</div></div>';
    h += '<div class="ex-body">';
    if (!items.length) h += '<div class="ex-empty">ยังไม่มีจุดแวะในวันนี้</div>';
    items.forEach(function (i) {
      var c = CAT[i.cat] || CATS[0], pid = arr(i.photoIds)[0], src = pid && photo[pid];
      var facts = [];
      if (i.address) facts.push('<li>' + ICON.pin + '<span><b>ที่อยู่:</b> ' + esc(i.address) + '</span></li>');
      if (i.hours) facts.push('<li>' + (i.cat === 'stay' ? ICON.home : ICON.clock) + '<span><b>' + (i.cat === 'stay' ? 'เช็กอิน/เอาต์' : 'เวลาเปิด') + ':</b> ' + esc(i.hours) + '</span></li>');
      if (lineTotal(i) > 0) facts.push('<li>' + ICON.coin + '<span><b>ค่าใช้จ่าย:</b> ' + money(lineTotal(i)) + ((Number(i.qty) || 1) > 1 ? ' (' + money(i.price) + ' × ' + (Number(i.qty) || 1) + ')' : '') + '</span></li>');
      if (i.phone) facts.push('<li>' + ICON.phone + '<span>' + esc(i.phone) + '</span></li>');
      h += '<div class="ex-stop' + (src ? '' : ' no-photo') + '" style="--c:' + c.color + ';--cbg:' + c.bg + '">' +
        '<div class="ex-time"><span class="ex-ic">' + ICON['c_' + c.key] + '</span><div><b>' + (i.timeStart ? esc(i.timeStart) + (i.timeEnd ? '' : ' น.') : '—') + '</b>' +
        (i.timeEnd ? '<span>– ' + esc(i.timeEnd) + ' น.</span>' : '') + '</div></div>' +
        '<div class="ex-main"><div class="ex-name">' + esc(i.name) + '</div>' +
        (i.note ? '<div class="ex-desc">' + esc(i.note) + '</div>' : '') +
        (i.travel ? '<div class="ex-travel">' + ICON.car + '<span>' + esc(i.travel) + '</span></div>' : '') +
        (facts.length ? '<ul class="ex-info">' + facts.join('') + '</ul>' : '') + '</div>' +
        (src ? '<div class="ex-photo"><img src="' + src + '" alt=""></div>' : '') +
        '</div>';
    });
    h += '</div>';
    if (items.length > 1) {
      h += '<div class="ex-card"><div class="ex-card-h">' + ICON.car + 'เส้นทางโดยรวม <span>(ระยะทางและเวลาโดยประมาณ)</span></div><div class="ex-chain">' +
        items.map(function (i, k) {
          var c = CAT[i.cat] || CATS[0], pid = arr(i.photoIds)[0], src = pid && photo[pid];
          return (k ? '<div class="ex-leg"><span class="ex-arrow"></span><span>' + esc(i.travel || '') + '</span></div>' : '') +
            '<div class="ex-node"><span class="ex-pic" style="background:' + c.bg + ';color:' + c.color + '">' + (src ? '<img src="' + src + '" alt="">' : ICON['c_' + c.key]) + '</span><b>' + esc(i.name) + '</b></div>';
        }).join('') + '</div></div>';
    }
    if (tips.length) {
      h += '<div class="ex-card"><div class="ex-card-h">' + ICON.bulb + 'เคล็ดลับเพิ่มเติม</div><ul class="ex-tips">' +
        tips.map(function (x) { return '<li>' + ICON.check + '<span>' + esc(x) + '</span></li>'; }).join('') + '</ul></div>';
    }
    h += '<div class="ex-foot"><span>' + esc(t.name) + ' · Day ' + n + '</span><span>' + items.length + ' จุด · ค่าใช้จ่ายวันนี้ <b>' + money(total) + '</b></span></div>';
    return h + '</div>';
  }
  function dataUrlToFile(url, name) {
    var parts = url.split(','), bin = atob(parts[1]), u8 = new Uint8Array(bin.length);
    for (var k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
    return new File([u8], name, { type: 'image/png' });
  }
  function deliver(files) {
    if (isMobile() && navigator.canShare && navigator.share) {
      var fs = files.map(function (f) { return dataUrlToFile(f.url, f.name); });
      if (navigator.canShare({ files: fs })) return navigator.share({ files: fs }).catch(function () {});
    }
    files.forEach(function (f, k) {
      setTimeout(function () {
        var url = URL.createObjectURL(dataUrlToFile(f.url, f.name));
        var a = document.createElement('a'); a.href = url; a.download = f.name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      }, k * 400);
    });
    return Promise.resolve();
  }
  /* ฝังฟอนต์ลงในรูป: โหลดไฟล์ฟอนต์จากโฟลเดอร์ fonts/ แล้วแปลงเป็น data URL */
  var fontCssPromise = null;
  function fontEmbedCss() {
    if (fontCssPromise) return fontCssPromise;
    var THAI = 'U+02D7,U+0303,U+0331,U+0E01-0E5B,U+200C-200D,U+25CC', LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
    var jobs = [];
    [400, 500, 600, 700].forEach(function (w) {
      [['thai', THAI], ['latin', LATIN]].forEach(function (s) {
        jobs.push(fetch('fonts/plex-thai-' + s[0] + '-' + w + '.woff2').then(function (r) {
          if (!r.ok) throw new Error('font'); return r.blob();
        }).then(function (b) {
          return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.readAsDataURL(b); });
        }).then(function (url) {
          return "@font-face{font-family:'IBM Plex Sans Thai';font-style:normal;font-weight:" + w + ";src:url(" + url + ") format('woff2');unicode-range:" + s[1] + "}";
        }));
      });
    });
    fontCssPromise = Promise.all(jobs).then(function (rules) { return rules.join('\n'); }).catch(function () { fontCssPromise = null; return ''; });
    return fontCssPromise;
  }
  var exporting = false;
  function exportDays(keys) {
    var t = currentTrip(); if (!t || exporting || !keys.length) return;
    exporting = true;
    var all = tripDays(t);
    toast(keys.length > 1 ? 'กำลังสร้างรูป ' + keys.length + ' วัน…' : 'กำลังสร้างรูป…');
    var ids = [t.coverId];
    keys.forEach(function (k) { dayItems(t, k).forEach(function (i) { ids.push(arr(i.photoIds)[0]); }); });
    ids = ids.filter(Boolean);
    var photo = {};
    var fontsP = Promise.all(['400', '500', '600', '700'].map(function (w) {
      return document.fonts && document.fonts.load ? document.fonts.load(w + ' 16px "IBM Plex Sans Thai"', 'กขabc฿') : null;
    })).catch(function () {});
    Promise.all([loadLib(), fontEmbedCss(), fontsP].concat(ids.map(function (id) {
      return getBlob('photos', id).then(function (src) { if (src) photo[id] = src; });
    }))).then(function (r) {
      var lib = r[0], fontCss = r[1], out = [], host = document.createElement('div');
      host.className = 'ex-host'; host.setAttribute('aria-hidden', 'true');
      document.body.appendChild(host);
      var safari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      return keys.reduce(function (p, key) {
        return p.then(function () {
          var n = all.indexOf(key) + 1;
          host.innerHTML = buildExportDay(t, key, n, photo);
          var node = host.firstChild;
          var imgs = Array.prototype.slice.call(node.querySelectorAll('img'));
          return Promise.all(imgs.map(function (im) { return im.decode ? im.decode().catch(function () {}) : null; }))
            .then(function () {
              var opt = { pixelRatio: 2, backgroundColor: '#F6F3EA', width: node.offsetWidth, height: node.offsetHeight };
              if (fontCss) opt.fontEmbedCSS = fontCss;
              var run = function () { return lib.toPng(node, opt).catch(function () { opt.skipFonts = true; return lib.toPng(node, opt); }); };
              return safari ? run().then(run) : run();
            })
            .then(function (url) { out.push({ url: url, name: slug(t.name) + '-Day' + n + '.png' }); });
        });
      }, Promise.resolve()).then(function () { host.remove(); return deliver(out); }, function (e) { host.remove(); throw e; });
    }).then(function () { toast(keys.length > 1 ? 'บันทึกรูปแล้ว ' + keys.length + ' วัน' : 'บันทึกรูปแล้ว'); })
      .catch(function () { toast('สร้างรูปไม่สำเร็จ ลองใหม่อีกครั้ง'); })
      .then(function () { exporting = false; });
  }

  /* ===== AI ช่วยจัดแพลน =====
   * ค่าเริ่มต้น: สร้างคำสั่งให้คัดลอกไปวางใน Claude / ChatGPT / Gemini แล้ววางคำตอบกลับมา (ฟรี)
   * ถ้าใส่ endpoint ใน ai-config.js: เรียก Claude ผ่าน Cloudflare Worker โดยตรง (กดปุ่มเดียวจบ) */
  var AI_CODE_KEY = 'trip-planner-ai-code', AI_PREFS_KEY = 'trip-planner-ai-prefs';
  var aiDialog = $('#aiDialog'), aiForm = $('#aiForm'), aiState = null, aiAbort = null;
  function aiBadge(i) { return i.ai ? '<span class="ai-badge" title="ข้อมูลจาก AI ควรตรวจสอบเวลาเปิดและราคาอีกครั้ง">' + ICON.spark + 'AI แนะนำ</span>' : ''; }
  function aiEndpoint() { var c = window.AI_CONFIG; return c && typeof c.endpoint === 'string' ? c.endpoint.trim().replace(/\/+$/, '') : ''; }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function aiPane(name) {
    $('#aiSetup').hidden = name !== 'setup';
    $('#aiManual').hidden = name !== 'manual';
    aiForm.hidden = name !== 'form';
    $('#aiLoading').hidden = name !== 'loading';
    $('#aiPreview').hidden = name !== 'preview';
  }
  function openAi() {
    var t = currentTrip(); if (!t) return;
    var days = tripDays(t);
    closeOverlays();
    if (!days.length) { toast('ใส่วันไป–วันกลับของทริปก่อน แล้วค่อยให้ AI จัดแพลน'); return; }
    else {
      aiPane('form');
      var empty = days.filter(function (k) { return !dayItems(t, k).length; }).length;
      $('#aiIntro').textContent = (t.destination || t.name) + ' · ' + days.length + ' วัน · ' + (t.people || 1) + ' คน' +
        (empty ? ' · ยังว่าง ' + empty + ' วัน' : '');
      var prefs = {}; try { prefs = JSON.parse(lsGet(AI_PREFS_KEY) || '{}'); } catch (e) {}
      aiForm.querySelectorAll('input[name=styles]').forEach(function (el) { el.checked = (prefs.styles || []).indexOf(el.value) >= 0; });
      if (prefs.pace) aiForm.querySelectorAll('input[name=pace]').forEach(function (el) { el.checked = el.value === prefs.pace; });
      if (typeof prefs.addStay === 'boolean') aiForm.addStay.checked = prefs.addStay;
      aiForm.budget.value = ''; aiForm.notes.value = prefs.notes || '';
      aiForm.code.value = '';
      $('#aiCodeField').hidden = !aiEndpoint() || !!lsGet(AI_CODE_KEY);
      $('#aiSubmitLabel').textContent = aiEndpoint() ? 'จัดแพลนเลย' : 'สร้างคำสั่งสำหรับ AI';
      $('#aiAnswer').value = ''; aiState = null;
      $('#aiError').hidden = true;
    }
    if (typeof aiDialog.showModal === 'function') aiDialog.showModal(); else aiDialog.setAttribute('open', '');
  }
  function aiFail(msg) { aiPane('form'); var e = $('#aiError'); e.textContent = msg; e.hidden = false; }
  aiForm.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var t = currentTrip(); if (!t) return;
    var direct = !!aiEndpoint();
    var code = aiForm.code.value.trim() || lsGet(AI_CODE_KEY) || '';
    if (direct && !code) { $('#aiCodeField').hidden = false; aiFail('กรุณาใส่รหัสใช้งาน AI'); aiForm.code.focus(); return; }
    var prefs = {
      styles: Array.prototype.map.call(aiForm.querySelectorAll('input[name=styles]:checked'), function (el) { return el.value; }),
      pace: (aiForm.querySelector('input[name=pace]:checked') || {}).value || 'ปานกลาง',
      scope: (aiForm.querySelector('input[name=scope]:checked') || {}).value || 'all',
      addStay: aiForm.addStay.checked,
      budget: parseFloat(aiForm.budget.value) || 0,
      notes: aiForm.notes.value.trim()
    };
    lsSet(AI_PREFS_KEY, JSON.stringify({ styles: prefs.styles, pace: prefs.pace, addStay: prefs.addStay, notes: prefs.notes }));
    var days = tripDays(t);
    var payload = {
      trip: { name: t.name, destination: t.destination || '', people: t.people || 1, start: t.start || days[0], end: t.end || days[days.length - 1] },
      prefs: prefs,
      days: days.map(function (k, n) {
        var info = (t.days && t.days[k]) || {};
        return { date: k, dayNo: n + 1, tagline: info.tagline || '', existing: dayItems(t, k).map(function (i) {
          return { cat: i.cat, name: i.name, timeStart: i.timeStart || '', timeEnd: i.timeEnd || '', note: (i.note || '').slice(0, 200) };
        }) };
      })
    };
    if (!direct) {
      $('#aiPrompt').value = buildAiPrompt(payload);
      $('#aiManualError').hidden = true;
      aiPane('manual');
      return;
    }
    aiPane('loading');
    aiAbort = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (aiAbort) aiAbort.abort(); }, 180000);
    fetch(aiEndpoint(), {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Access-Code': code },
      body: JSON.stringify(payload), signal: aiAbort ? aiAbort.signal : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) { return { ok: r.ok, status: r.status, data: data }; });
    }).then(function (res) {
      clearTimeout(timer);
      if (!aiDialog.open) return;
      if (res.status === 401 || (res.data && res.data.error === 'access')) {
        lsSet(AI_CODE_KEY, null); $('#aiCodeField').hidden = false; aiForm.code.value = '';
        return aiFail('รหัสใช้งาน AI ไม่ถูกต้อง');
      }
      if (!res.ok || !res.data || !res.data.plan) return aiFail((res.data && res.data.message) || 'AI ตอบกลับผิดพลาด ลองใหม่อีกครั้ง');
      lsSet(AI_CODE_KEY, code);
      showAiPreview(t, res.data.plan, prefs);
    }).catch(function (e) {
      clearTimeout(timer);
      if (!aiDialog.open) return;
      aiFail(e && e.name === 'AbortError' ? 'AI ใช้เวลานานเกินไป ลองใหม่ หรือเลือกเติมเฉพาะวันที่ว่าง'
        : 'เชื่อมต่อ AI ไม่ได้ ตรวจสอบอินเทอร์เน็ต, URL ใน ai-config.js และ ALLOWED_ORIGINS ใน Worker');
    });
  });
  function buildAiPrompt(p) {
    var t = p.trip, pr = p.prefs, L = [];
    L.push('ช่วยจัดแผนเที่ยวรายวันให้สมบูรณ์ ในฐานะผู้ช่วยวางแผนเที่ยวมืออาชีพ');
    L.push('');
    L.push('กติกา:');
    L.push('- ตอบเป็นภาษาไทย ใช้สถานที่ที่มีอยู่จริงและเป็นที่รู้จักในจุดหมายนั้น ห้ามแต่งชื่อสถานที่ขึ้นเอง');
    L.push('- จุดแวะที่มีอยู่แล้วในแผนปัจจุบันต้องคงไว้ ห้ามส่งซ้ำ ให้จัดจุดใหม่แทรกในช่วงเวลาที่ว่าง ไม่ให้เวลาทับกัน');
    L.push('- เรียงจุดให้เส้นทางต่อเนื่อง ไม่ย้อนไปมา เผื่อเวลาเดินทางตามจริง มีมื้ออาหารในเวลาที่เหมาะสม');
    L.push('- วันแรกเริ่มหลังเวลาเดินทางมาถึง วันสุดท้ายจบก่อนเวลาเดินทางกลับ ถ้ามีข้อมูลการเดินทางอยู่แล้ว');
    L.push('- ราคาเป็นบาทโดยประมาณต่อหน่วย ให้ qty ตามจำนวนคนหรือจำนวนคืน ถ้าไม่ทราบราคาให้ price = 0');
    L.push('- ถ้าไม่แน่ใจเวลาเปิด–ปิด ให้ hours เป็น "" ห้ามเดา');
    L.push('');
    L.push('ทริป: ' + t.name);
    L.push('จุดหมาย: ' + (t.destination || '-'));
    L.push('จำนวนคน: ' + (t.people || 1));
    L.push('ช่วงวันที่: ' + t.start + ' ถึง ' + t.end);
    L.push('');
    L.push('ความต้องการ:');
    L.push('- สไตล์ที่ชอบ: ' + (pr.styles.length ? pr.styles.join(', ') : 'ทั่วไป'));
    L.push('- จังหวะ: ' + pr.pace);
    if (pr.budget) L.push('- งบประมาณต่อคนทั้งทริป (ไม่รวมที่มีอยู่แล้ว): ประมาณ ' + pr.budget + ' บาท');
    L.push('- ขอบเขต: ' + (pr.scope === 'empty' ? 'เติมเฉพาะวันที่ยังไม่มีจุดแวะเลย วันที่มีจุดแล้วให้ stops เป็น []' : 'เติมทุกวันให้สมบูรณ์ โดยคงจุดเดิมไว้'));
    L.push('- ที่พัก: ' + (pr.addStay ? 'ถ้าคืนไหนยังไม่มีที่พัก ให้แนะนำที่พัก 1 แห่ง (cat = "stay")' : 'ไม่ต้องเพิ่มที่พัก'));
    if (pr.notes) L.push('- เพิ่มเติม: ' + pr.notes);
    L.push('');
    L.push('แผนปัจจุบัน:');
    p.days.forEach(function (d) {
      L.push('Day ' + d.dayNo + ' (' + d.date + ')' + (d.tagline ? ' — ' + d.tagline : ''));
      if (!d.existing.length) L.push('  (ยังว่าง)');
      d.existing.forEach(function (s) {
        L.push('  - ' + (s.timeStart ? s.timeStart + (s.timeEnd ? '–' + s.timeEnd : '') : 'ไม่ระบุเวลา') + ' [' + s.cat + '] ' + s.name + (s.note ? ' : ' + s.note : ''));
      });
    });
    L.push('');
    L.push('รูปแบบคำตอบ: ตอบเป็น JSON อย่างเดียวในบล็อกโค้ด ไม่ต้องมีคำอธิบายอื่น ตามโครงนี้');
    L.push('```json');
    L.push(JSON.stringify({
      summary: 'สรุปแนวคิดของแพลน 1-3 ประโยค',
      days: [{
        date: p.days[0].date, tagline: 'คำโปรยของวันสั้น ๆ', tips: ['เคล็ดลับ 2-4 ข้อ'],
        stops: [{ cat: 'place', name: 'ชื่อสถานที่จริง', timeStart: '13:30', timeEnd: '15:00', note: 'รายละเอียดสั้น ๆ ว่าทำอะไร ไฮไลต์ เมนูเด็ด',
          travel: 'การเดินทางจากจุดก่อนหน้า เช่น รถ 20–30 นาที (~12 กม.)', address: 'ตำบล/อำเภอ', hours: '', price: 0, qty: p.trip.people || 1,
          mapQuery: 'ชื่ออังกฤษ + เมือง สำหรับค้นใน Google Maps' }]
      }]
    }, null, 2));
    L.push('```');
    L.push('- days ต้องมีครบทุกวัน: ' + p.days.map(function (d) { return d.date; }).join(', '));
    L.push('- cat ใช้ได้เฉพาะ: "travel" (การเดินทาง), "stay" (ที่พัก), "place" (ที่เที่ยว), "food" (อาหาร), "shop" (ช้อปปิ้ง)');
    L.push('- stops ใส่เฉพาะจุดใหม่ เวลาเป็นแบบ 24 ชั่วโมง HH:MM');
    return L.join('\n');
  }
  function parseAiText(txt) {
    var s = String(txt || '').trim(), m, blocks = [], re = /```(?:json)?\s*([\s\S]*?)```/gi;
    while ((m = re.exec(s))) blocks.push(m[1]);
    var cands = blocks.filter(function (b) { return b.indexOf('"days"') >= 0; });
    if (cands.length) s = cands[cands.length - 1];
    var a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b < a) return null;
    s = s.slice(a, b + 1);
    var tries = [s, s.replace(/[“”]/g, '"').replace(/,\s*([}\]])/g, '$1')];
    for (var k = 0; k < tries.length; k++) {
      try { var o = JSON.parse(tries[k]); if (o && Array.isArray(o.days)) return o; } catch (e) {}
    }
    return null;
  }
  function copyText(text, btn) {
    var done = function () { var old = btn.innerHTML; btn.textContent = 'คัดลอกแล้ว ✓'; setTimeout(function () { btn.innerHTML = old; }, 1800); };
    var fallback = function () { var ta = $('#aiPrompt'); ta.focus(); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('กดค้างที่ข้อความแล้วเลือกคัดลอก'); } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  }
  function cleanAiPlan(t, plan) {
    var days = tripDays(t), byDate = {};
    (Array.isArray(plan.days) ? plan.days : []).forEach(function (d) {
      if (!d || days.indexOf(d.date) < 0 || byDate[d.date]) return;
      var stops = (Array.isArray(d.stops) ? d.stops : []).map(function (s) {
        if (!s || !CAT[s.cat] || !String(s.name || '').trim()) return null;
        var price = Number(s.price); price = isFinite(price) && price > 0 ? Math.round(price) : 0;
        return {
          cat: s.cat, name: String(s.name).trim().slice(0, 200), timeStart: normTime(s.timeStart), timeEnd: normTime(s.timeEnd),
          note: String(s.note || '').trim().slice(0, 1000), travel: String(s.travel || '').trim().slice(0, 200),
          address: String(s.address || '').trim().slice(0, 500), hours: String(s.hours || '').trim().slice(0, 200),
          price: price, qty: Math.max(1, Math.min(99, parseInt(s.qty, 10) || 1)),
          map: gm(String(s.mapQuery || '').trim() || (s.name + ' ' + (t.destination || '')))
        };
      }).filter(Boolean).sort(function (a, b) { return (a.timeStart || '99').localeCompare(b.timeStart || '99'); });
      byDate[d.date] = {
        date: d.date, stops: stops,
        tagline: String(d.tagline || '').trim().slice(0, 200),
        tips: (Array.isArray(d.tips) ? d.tips : []).map(function (x) { return String(x || '').trim().slice(0, 300); }).filter(Boolean).slice(0, 8)
      };
    });
    return { summary: String(plan.summary || '').trim(), days: days.map(function (k) { return byDate[k]; }).filter(Boolean) };
  }
  function showAiPreview(t, rawPlan, prefs) {
    var plan = cleanAiPlan(t, rawPlan), all = tripDays(t);
    aiState = { tripId: t.id, plan: plan, mode: aiEndpoint() ? 'direct' : 'manual' };
    $('#aiPreviewNote').textContent = 'เลือกเฉพาะที่อยากเพิ่ม จุดแวะเดิมจะไม่ถูกแก้หรือลบ · ข้อมูลจาก AI เช่น เวลาเปิดและราคา ควรตรวจสอบอีกครั้ง';
    $('#aiSummary').textContent = plan.summary || 'AI จัดแพลนเสร็จแล้ว';
    var html = plan.days.map(function (d, di) {
      var info = (t.days && t.days[d.date]) || {}, existing = dayItems(t, d.date).length;
      if (!d.stops.length && !d.tagline && !d.tips.length) return '';
      return '<section class="ai-day"><h3>Day ' + (all.indexOf(d.date) + 1) + ' <span>' + fmtLong(d.date) + (existing ? ' · มีอยู่แล้ว ' + existing + ' จุด' : '') + '</span></h3>' +
        (d.stops.length ? d.stops.map(function (s, si) {
          var c = CAT[s.cat];
          return '<label class="ai-row"><input type="checkbox" data-ai="stop" data-d="' + di + '" data-s="' + si + '" checked>' +
            '<span class="ai-time">' + (s.timeStart ? esc(s.timeStart) + (s.timeEnd ? '–' + esc(s.timeEnd) : '') : '—') + '</span>' +
            '<span class="ai-main"><span class="ai-name"><span class="chip" style="color:' + c.color + ';background:' + c.bg + '">' + c.label + '</span><b>' + esc(s.name) + '</b></span>' +
            (s.note ? '<small>' + esc(s.note) + '</small>' : '') +
            '<small class="ai-meta">' + [s.travel ? ICON.car + esc(s.travel) : '', s.price ? money(s.price * s.qty) + (s.qty > 1 ? ' (' + money(s.price) + ' × ' + s.qty + ')' : '') : ''].filter(Boolean).join(' · ') + '</small></span></label>';
        }).join('') : '<p class="muted small">ไม่มีจุดแวะใหม่สำหรับวันนี้</p>') +
        (d.tagline ? '<label class="ai-row ai-extra"><input type="checkbox" data-ai="tag" data-d="' + di + '"' + (info.tagline ? '' : ' checked') + '><span class="ai-main"><small><b>คำโปรย:</b> ' + esc(d.tagline) +
          (info.tagline ? ' <i>(แทนของเดิม)</i>' : '') + '</small></span></label>' : '') +
        (d.tips.length ? '<label class="ai-row ai-extra"><input type="checkbox" data-ai="tips" data-d="' + di + '" checked><span class="ai-main"><small><b>เคล็ดลับ ' + d.tips.length + ' ข้อ:</b> ' + d.tips.map(esc).join(' · ') + '</small></span></label>' : '') +
        '</section>';
    }).join('');
    $('#aiDays').innerHTML = html || '<p class="muted">AI ไม่มีอะไรเพิ่มให้ ลองเลือก "เติมทุกวันให้สมบูรณ์" หรือบอกความต้องการเพิ่มเติม</p>';
    updateAiCount();
    aiPane('preview');
    $('#aiPreview').scrollTop = 0;
  }
  function updateAiCount() {
    var n = aiDialog.querySelectorAll('input[data-ai="stop"]:checked').length;
    var any = aiDialog.querySelectorAll('input[data-ai]:checked').length;
    var b = $('#aiApply'); b.disabled = !any;
    b.textContent = n ? 'เพิ่ม ' + n + ' จุดลงทริป' : 'บันทึกที่เลือก';
  }
  aiDialog.addEventListener('change', function (e) { if (e.target.dataset && e.target.dataset.ai) updateAiCount(); });
  function applyAi() {
    if (!aiState) return;
    var t = state.db.trips[aiState.tripId]; if (!t) return;
    var u = {}, added = 0, firstDay = null, now = Date.now();
    aiState.plan.days.forEach(function (d, di) {
      d.stops.forEach(function (s, si) {
        var cb = aiDialog.querySelector('input[data-ai="stop"][data-d="' + di + '"][data-s="' + si + '"]');
        if (!cb || !cb.checked) return;
        var id = uid('i');
        u['items/' + t.id + '/' + id] = {
          id: id, cat: s.cat, name: s.name, date: d.date, timeStart: s.timeStart, timeEnd: s.timeEnd, note: s.note, travel: s.travel,
          address: s.address, hours: s.hours, phone: '', price: s.price, qty: s.qty, map: s.map, photoIds: [], ai: true,
          createdAt: now + added, updatedAt: now
        };
        added++; if (!firstDay) firstDay = d.date;
      });
      var tagCb = aiDialog.querySelector('input[data-ai="tag"][data-d="' + di + '"]');
      var tipCb = aiDialog.querySelector('input[data-ai="tips"][data-d="' + di + '"]');
      var useTag = tagCb && tagCb.checked, useTips = tipCb && tipCb.checked;
      if (useTag || useTips) {
        var info = (t.days && t.days[d.date]) || {}, tips = arr(info.tips);
        if (useTips) d.tips.forEach(function (x) { if (tips.indexOf(x) < 0) tips.push(x); });
        u['trips/' + t.id + '/days/' + d.date] = { tagline: useTag ? d.tagline : (info.tagline || ''), tips: tips.slice(0, 30) };
        if (!firstDay) firstDay = d.date;
      }
    });
    if (!Object.keys(u).length) return;
    var b = $('#aiApply'); b.disabled = true; b.textContent = 'กำลังบันทึก…';
    commit(u).then(function () {
      aiDialog.close();
      if (firstDay) state.dayKey = firstDay;
      state.view = 'plan'; render();
      toast(added ? 'เพิ่ม ' + added + ' จุดจาก AI แล้ว' : 'บันทึกแล้ว');
    }).catch(function () { b.disabled = false; updateAiCount(); });
  }
  aiDialog.addEventListener('close', function () { if (aiAbort) { try { aiAbort.abort(); } catch (e) {} } aiState = null; });

  /* ===== มือถือ: เมนูทริป (drawer) และฟอร์มแบบแผ่นล่าง (sheet) ===== */
  var mq = window.matchMedia('(max-width: 760px)');
  function isMobile() { return mq.matches; }
  var lastFocus = null;
  function setOverlay(kind) {
    var b = document.body;
    b.classList.toggle('drawer-open', kind === 'drawer');
    b.classList.toggle('sheet-open', kind === 'sheet');
    $('#scrim').hidden = !kind;
    $('#drawerBtn').setAttribute('aria-expanded', String(kind === 'drawer'));
  }
  function openDrawer() { lastFocus = document.activeElement; setOverlay('drawer'); var c = $('#side .drawer-close'); if (c) c.focus(); }
  function openSheet() { lastFocus = document.activeElement; setOverlay('sheet'); setTimeout(function () { form.name.focus({ preventScroll: true }); }, 220); }
  function closeOverlays() {
    var b = document.body, was = b.classList.contains('drawer-open') || b.classList.contains('sheet-open');
    setOverlay(null);
    if (was && lastFocus && lastFocus.isConnected) { try { lastFocus.focus({ preventScroll: true }); } catch (e) {} }
    lastFocus = null;
  }
  mq.addEventListener && mq.addEventListener('change', function () { if (!isMobile()) setOverlay(null); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && (document.body.classList.contains('drawer-open') || document.body.classList.contains('sheet-open'))) {
      if (document.body.classList.contains('sheet-open') && state.editingItemId) resetDraft();
      closeOverlays();
    }
  });

  /* ===== render ===== */
  function render() {
    var trips = sortedTrips(), r = state.route;
    $('#tripCount').textContent = state.loaded ? trips.length + ' ทริป' : 'กำลังโหลด…';
    var trip = r === 'trip' ? currentTrip() : null;
    // เปิดลิงก์ทริปที่ไม่มีสิทธิ์ หรือทริปถูกลบไปแล้ว → กลับหน้าปฏิทิน
    if (r === 'trip' && !trip && state.loaded && !state.pending) { go('#calendar'); return; }
    renderTripList(trips);
    document.querySelectorAll('.nav-link').forEach(function (a) { a.setAttribute('aria-current', String(a.getAttribute('data-route') === r)); });
    $('#calendarView').hidden = r !== 'calendar';
    $('#accountView').hidden = r !== 'account';
    $('#usersView').hidden = r !== 'users';
    $('#emptyApp').hidden = true;
    $('#tripView').hidden = !trip;
    $('#topTitle').textContent = trip ? trip.name : ({ calendar: 'ปฏิทินทริป', account: 'เปลี่ยนรหัสผ่าน', users: 'จัดการผู้ใช้' }[r] || 'ทริปของฉัน');
    $('#fab').hidden = !trip;
    if (r === 'calendar') renderCalendar(trips);
    if (r === 'account' && state.me) $('#pwWho').textContent = 'บัญชี @' + state.me.username;
    if (membersDialog.open && !trip) membersDialog.close(); else if (membersDialog.open) renderMembers();
    renderHolidays();
    if (r === 'users') renderUsers();
    if (!trip) { if (r === 'trip') $('#topTitle').textContent = 'กำลังโหลด…'; hydrate(); return; }
    if (state.editingItemId && !(state.db.items[trip.id] || {})[state.editingItemId]) resetDraft();
    renderHero(trip);
    renderViewTabs();
    var plan = state.view === 'plan';
    $('#tripView').setAttribute('data-view', state.view);
    $('#summary').hidden = plan; $('#share').hidden = plan; $('#costList').hidden = plan; $('#planView').hidden = !plan;
    if (plan) renderPlan(trip); else { renderSummary(trip); renderList(trip); }
    hydrate();
  }

  /* ===== จัดการผู้ใช้ (admin) ===== */
  var EMU = false; // ใช้ Firebase จำลองบนเครื่อง (ตั้งใน start)
  function userTripIds(uid) {
    return Object.keys(state.db.trips).filter(function (id) { var t = state.db.trips[id]; return t && t.members && t.members[uid]; });
  }
  function renderUsers() {
    var me = state.me; if (!me || !me.isAdmin) return;
    var ids = Object.keys(state.db.users).sort(function (a, b) { return userName(a).localeCompare(userName(b), 'th'); });
    $('#userCount').textContent = ids.length + ' คน';
    $('#userList').innerHTML = ids.map(function (uid) {
      var u = state.db.users[uid], n = userTripIds(uid).length, self = uid === me.uid;
      return '<li class="mem-row">' + avatar(uid) +
        '<span class="mem-text"><b>' + esc(userName(uid)) + (self ? ' (คุณ)' : '') + '</b><span class="muted small">@' + esc(u.username) + ' · ' + n + ' ทริป</span></span>' +
        (TripCore.isAdminEmail(TripCore.usernameToEmail(u.username)) ? '<span class="mem-badge">ผู้ดูแล</span>'
          : '<button type="button" class="btn-secondary small-btn" data-act="deactivate-user" data-uid="' + esc(uid) + '">ปิดบัญชี</button>') +
        '</li>';
    }).join('');
  }

  // สร้างบัญชีผ่าน Firebase app ตัวที่สอง เพื่อไม่ให้ admin หลุดจากระบบ
  // คืน { uid, finish(ok) }: เรียก finish(false) ถ้าบันทึกโปรไฟล์ไม่สำเร็จ เพื่อลบบัญชีที่เพิ่งสร้างทิ้ง
  function createAuthAccount(email, password) {
    var sec = firebase.initializeApp(window.FIREBASE_CONFIG, 'admin-create-' + Date.now());
    var a = sec.auth();
    if (EMU) a.useEmulator('http://127.0.0.1:9099');
    var drop = function () { return sec.delete().catch(function () {}); };
    return a.setPersistence(firebase.auth.Auth.Persistence.NONE)
      .then(function () { return a.createUserWithEmailAndPassword(email, password); })
      .then(function (cred) {
        return {
          uid: cred.user.uid,
          finish: function (ok) {
            var undo = ok ? Promise.resolve() : cred.user.delete().catch(function () {});
            return undo.then(function () { return a.signOut().catch(function () {}); }).then(drop);
          }
        };
      }, function (err) { return drop().then(function () { throw err; }); });
  }

  $('#newUserForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, err = $('#newUserError');
    var fail = function (m) { err.textContent = m; err.hidden = false; };
    var uname = TripCore.normalizeUsername(f.username.value), name = f.name.value.trim(), pw = f.password.value;
    if (!TripCore.validUsername(uname)) return fail('username ใช้ได้เฉพาะ a–z, 0–9, จุด, ขีดล่าง และขีดกลาง ยาว 3–30 ตัว');
    if (!name) return fail('กรอกชื่อที่แสดง');
    var p = TripCore.passwordProblem(null, pw, pw);
    if (p) return fail(p.replace('รหัสผ่านใหม่', 'รหัสผ่านเริ่มต้น'));
    err.hidden = true;
    var b = $('#newUserSubmit');
    fdb.ref(ROOT + '/usernames/' + uname).once('value').then(function (s) {
      var oldUid = s.val();
      if (!oldUid) return null;
      return askConfirm({
        title: 'username นี้มีอยู่แล้ว',
        html: '<div class="cf-item"><span class="cf-item-text"><b>@' + esc(uname) + '</b><span>' + esc(userName(oldUid)) + ' · ' + userTripIds(oldUid).length + ' ทริป</span></span></div>',
        note: 'ใช้เมื่อเจ้าของบัญชีลืมรหัสผ่าน: ลบบัญชีเดิมใน Firebase Console (Authentication → Users) ก่อน แล้วบัญชีใหม่จะได้ทริปเดิมทั้งหมด',
        okLabel: 'แทนบัญชีเดิม'
      }).then(function (ok) { if (!ok) throw { code: 'cancel' }; return oldUid; });
    }).then(function (oldUid) {
      b.disabled = true; b.textContent = 'กำลังสร้าง…';
      return createAuthAccount(TripCore.usernameToEmail(uname), pw).then(function (acct) {
        var uid = acct.uid, u = {};
        u['users/' + uid] = { username: uname, name: name, createdAt: Date.now() };
        u['usernames/' + uname] = uid;
        if (oldUid && oldUid !== uid) {
          userTripIds(oldUid).forEach(function (t) {
            u['trips/' + t + '/members/' + oldUid] = null; u['trips/' + t + '/members/' + uid] = true;
            if (state.db.trips[t].ownerId === oldUid) u['trips/' + t + '/ownerId'] = uid;
            u['userTrips/' + uid + '/' + t] = true;
          });
          u['userTrips/' + oldUid] = null; u['users/' + oldUid] = null;
        }
        return fdb.ref(ROOT).update(u).then(function () {
          return acct.finish(true).then(function () {
            f.reset();
            toast(oldUid ? 'สร้างบัญชี @' + uname + ' แทนบัญชีเดิมแล้ว' : 'สร้างบัญชี @' + uname + ' แล้ว');
          });
        }, function () {
          return acct.finish(false).then(function () { throw { code: 'db-failed' }; });
        });
      });
    }).catch(function (x) {
      if (x && x.code === 'cancel') return;
      if (x && x.code === 'auth/email-already-in-use') return fail('username นี้ยังมีบัญชีใน Firebase อยู่ ถ้าจะสร้างใหม่ ให้ลบบัญชีเดิมใน Firebase Console (Authentication → Users) ก่อน');
      fail(x && x.code && x.code.indexOf('auth/') === 0 ? TripCore.authErrorText(x.code) : 'สร้างบัญชีไม่สำเร็จ ลองใหม่อีกครั้ง');
    }).then(function () { b.disabled = false; b.textContent = 'สร้างผู้ใช้'; });
  });

  function deactivateUser(uid) {
    var me = state.me, u0 = state.db.users[uid];
    if (!me || !me.isAdmin || !u0 || uid === me.uid) return;
    var trips = userTripIds(uid);
    askConfirm({
      title: 'ปิดบัญชีนี้?',
      html: '<div class="cf-item">' + avatar(uid) + '<span class="cf-item-text"><b>' + esc(userName(uid)) + '</b><span>@' + esc(u0.username) + ' · ' + trips.length + ' ทริป</span></span></div>',
      note: 'คนนี้จะเข้าระบบไม่ได้ และถูกเอาออกจากทุกทริป ทริปที่เขาเป็นเจ้าของจะย้ายมาเป็นของคุณ (บัญชีใน Firebase ยังอยู่ ลบได้ที่ Firebase Console)',
      okLabel: 'ปิดบัญชี'
    }).then(function (ok) {
      if (!ok) return;
      var u = {};
      u['users/' + uid] = null; u['usernames/' + u0.username] = null; u['userTrips/' + uid] = null;
      trips.forEach(function (t) {
        u['trips/' + t + '/members/' + uid] = null;
        if (state.db.trips[t].ownerId === uid) {
          u['trips/' + t + '/ownerId'] = me.uid; u['trips/' + t + '/members/' + me.uid] = true; u['userTrips/' + me.uid + '/' + t] = true;
        }
      });
      fdb.ref(ROOT).update(u).then(function () { toast('ปิดบัญชี @' + u0.username + ' แล้ว'); }, function () { toast('ปิดบัญชีไม่สำเร็จ ลองใหม่อีกครั้ง'); });
    });
  }

  /* ===== เปลี่ยนรหัสผ่าน ===== */
  $('#pwForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, err = $('#pwError'), user = fauth && fauth.currentUser;
    var fail = function (m) { err.textContent = m; err.hidden = false; };
    if (!user) return fail('กรุณาเข้าสู่ระบบใหม่');
    if (!f.old.value) return fail('กรอกรหัสผ่านปัจจุบัน');
    var p = TripCore.passwordProblem(f.old.value, f.pw.value, f.pw2.value);
    if (p) return fail(p);
    err.hidden = true;
    var b = $('#pwSubmit'); b.disabled = true; b.textContent = 'กำลังบันทึก…';
    var cred = firebase.auth.EmailAuthProvider.credential(user.email, f.old.value);
    user.reauthenticateWithCredential(cred).then(function () { return user.updatePassword(f.pw.value); })
      .then(function () { f.reset(); toast('เปลี่ยนรหัสผ่านแล้ว'); })
      .catch(function (x) {
        var c = x && x.code;
        fail(c === 'auth/invalid-credential' || c === 'auth/wrong-password' || c === 'auth/invalid-login-credentials'
          ? 'รหัสผ่านปัจจุบันไม่ถูกต้อง' : TripCore.authErrorText(c));
      })
      .then(function () { b.disabled = false; b.textContent = 'บันทึกรหัสผ่านใหม่'; });
  });

  /* ===== วันหยุดราชการ ===== */
  var holDialog = $('#holDialog');
  function holidays() { return TripCore.mergeHolidays(window.TH_HOLIDAYS || {}, state.db.holidays || {}); }
  function canEditHolidays() { return !!(fdb && state.me && state.me.isAdmin); }
  function openHolidays() {
    if (!canEditHolidays()) return;
    resetHolForm();
    if (typeof holDialog.showModal === 'function') holDialog.showModal(); else holDialog.setAttribute('open', '');
    renderHolidays();
  }
  function resetHolForm() {
    var f = $('#holForm'); f.reset(); setField(f.date, ''); $('#holError').hidden = true;
    $('#holSubmit').textContent = 'เพิ่มวันหยุด';
  }
  function renderHolidays() {
    if (!holDialog.open) return;
    var cm = calMonth(), mKey = cm.y + '-' + pad(cm.m + 1), file = window.TH_HOLIDAYS || {}, db = state.db.holidays || {};
    var title = new Date(cm.y, cm.m, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
    $('#holMonth').textContent = 'วันหยุดเดือน' + title;
    var keys = {};
    Object.keys(file).concat(Object.keys(db)).forEach(function (k) { if (k.slice(0, 7) === mKey && isIsoDay(k)) keys[k] = 1; });
    var rows = Object.keys(keys).sort().map(function (k) {
      var o = db[k], hidden = !!(o && o.off), name = (o && o.name) || file[k] || '', added = !file[k];
      var tag = hidden ? 'ซ่อนอยู่' : (added ? 'เพิ่มเอง' : (o && o.name ? 'แก้ชื่อแล้ว' : ''));
      return '<li class="mem-row' + (hidden ? ' hol-off' : '') + '"><span class="mem-text"><b>' + esc(fmt(k, { weekday: 'short', day: 'numeric', month: 'short' })) + ' · ' + esc(name) + '</b>' +
        (tag ? '<span class="muted small">' + tag + '</span>' : '') + '</span>' +
        (hidden ? '<button type="button" class="btn-secondary small-btn" data-act="hol-reset" data-day="' + esc(k) + '">แสดงอีกครั้ง</button>'
          : '<button type="button" class="btn-secondary small-btn" data-act="hol-edit" data-day="' + esc(k) + '">แก้ไข</button>' +
            '<button type="button" class="btn-secondary small-btn" data-act="hol-remove" data-day="' + esc(k) + '">' + (added ? 'ลบ' : 'ซ่อน') + '</button>') +
        '</li>';
    });
    $('#holList').innerHTML = rows.length ? rows.join('') : '<li class="muted small mem-empty">ไม่มีวันหยุดในเดือนนี้</li>';
  }
  function holSave(paths, msg) {
    return fdb.ref(ROOT).update(paths).then(function () { toast(msg); }, function () { toast('บันทึกวันหยุดไม่สำเร็จ ลองใหม่อีกครั้ง'); });
  }
  $('#holForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, err = $('#holError'), day = getField(f.date), name = f.name.value.trim();
    var fail = function (m) { err.textContent = m; err.hidden = false; };
    if (!isIsoDay(day)) return fail('ใส่วันที่แบบ วว/ดด/ปปปป เช่น 30/11/2026');
    if (!name) return fail('ใส่ชื่อวันหยุด');
    if (name.length > 100) return fail('ชื่อวันหยุดยาวเกิน 100 ตัวอักษร');
    var u = {}; u['holidays/' + day] = { name: name };
    holSave(u, 'บันทึกวันหยุดแล้ว').then(function () {
      var d = toDate(day); state.calMonth = { y: d.getFullYear(), m: d.getMonth() };
      resetHolForm(); render();
    });
  });
  function holAction(act, day) {
    if (!canEditHolidays() || !isIsoDay(day)) return;
    var file = window.TH_HOLIDAYS || {}, u = {};
    if (act === 'hol-edit') {
      var f = $('#holForm'); setField(f.date, day); f.name.value = holidays()[day] || ''; f.name.focus();
      $('#holSubmit').textContent = 'บันทึกชื่อใหม่'; return;
    }
    if (act === 'hol-remove') { u['holidays/' + day] = file[day] ? { off: true } : null; holSave(u, file[day] ? 'ซ่อนวันหยุดแล้ว' : 'ลบวันหยุดแล้ว'); }
    if (act === 'hol-reset') { u['holidays/' + day] = null; holSave(u, 'แสดงวันหยุดอีกครั้งแล้ว'); }
  }

  /* ===== สมาชิกทริป ===== */
  var membersDialog = $('#membersDialog');
  function userName(uid) { var u = state.db.users[uid]; return u ? (u.name || u.username) : 'ผู้ใช้ที่ถูกปิดบัญชี'; }
  function avatar(uid) {
    var n = userName(uid), ch = Array.from(n.trim())[0] || '?';
    return '<span class="avatar" aria-hidden="true" title="' + esc(n) + '">' + esc(ch.toUpperCase()) + '</span>';
  }
  function openMembers() {
    if (!currentTrip()) return;
    $('#memSearch').value = '';
    if (typeof membersDialog.showModal === 'function') membersDialog.showModal(); else membersDialog.setAttribute('open', '');
    renderMembers();
  }
  function renderMembers() {
    var t = currentTrip(); if (!t || !membersDialog.open) return;
    var mine = tripMembers(t), manage = canManage(t);
    mine.sort(function (a, b) { return a === t.ownerId ? -1 : b === t.ownerId ? 1 : userName(a).localeCompare(userName(b), 'th'); });
    $('#memList').innerHTML = mine.map(function (uid) {
      var u = state.db.users[uid] || {}, me = state.me && uid === state.me.uid;
      return '<li class="mem-row">' + avatar(uid) + '<span class="mem-text"><b>' + esc(userName(uid)) + (me ? ' (คุณ)' : '') + '</b>' +
        '<span class="muted small">' + (u.username ? '@' + esc(u.username) : '') + '</span></span>' +
        (uid === t.ownerId ? '<span class="mem-badge">เจ้าของ</span>'
          : (manage ? '<button type="button" class="btn-secondary small-btn" data-act="remove-member" data-uid="' + esc(uid) + '">เอาออก</button>' : '')) +
        '</li>';
    }).join('');
    $('#memAdd').hidden = !manage; $('#memNote').hidden = manage;
    if (!manage) return;
    var raw = $('#memSearch').value.trim(), q = raw.toLowerCase();
    var cands = Object.keys(state.db.users).filter(function (uid) {
      if (t.members && t.members[uid]) return false;
      var u = state.db.users[uid];
      return !q || (u.username || '').indexOf(q) >= 0 || (u.name || '').toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return userName(a).localeCompare(userName(b), 'th'); });
    $('#memResults').innerHTML = cands.length ? cands.slice(0, 30).map(function (uid) {
      var u = state.db.users[uid];
      return '<li class="mem-row">' + avatar(uid) + '<span class="mem-text"><b>' + esc(userName(uid)) + '</b><span class="muted small">@' + esc(u.username) + '</span></span>' +
        '<button type="button" class="btn-primary small-btn" data-act="add-member" data-uid="' + esc(uid) + '">เพิ่ม</button></li>';
    }).join('') : '<li class="muted small mem-empty">' + (q ? 'ไม่พบผู้ใช้ที่ตรงกับ “' + esc(raw) + '”' : 'ทุกคนในระบบอยู่ในทริปนี้แล้ว') + '</li>';
  }
  $('#memSearch').addEventListener('input', renderMembers);
  function memberPaths(t, uid, on) {
    var u = {};
    u['trips/' + t.id + '/members/' + uid] = on ? true : null;
    u['userTrips/' + uid + '/' + t.id] = on ? true : null;
    return u;
  }
  function addMember(t, uid) {
    if (!t || !uid || !canManage(t)) return;
    commit(memberPaths(t, uid, true)).then(function () { toast('เพิ่ม ' + userName(uid) + ' เข้าทริปแล้ว'); renderMembers(); }).catch(function () {});
  }
  function removeMember(t, uid) {
    if (!t || !uid || uid === t.ownerId || !canManage(t)) return;
    var name = userName(uid);
    commit(memberPaths(t, uid, false)).then(function () {
      renderMembers();
      toast('เอา ' + name + ' ออกจากทริปแล้ว', { undo: function () { commit(memberPaths(t, uid, true)).then(renderMembers).catch(function () {}); } });
    }).catch(function () {});
  }
  function leaveTrip(t) {
    var me = state.me; if (!t || !me || t.ownerId === me.uid) return;
    askConfirm({
      title: 'ออกจากทริปนี้?',
      html: '<div class="cf-item"><span class="cf-item-text"><b>' + esc(t.name) + '</b><span>' + esc(tripRange(t)) + '</span></span></div>',
      note: 'คุณจะไม่เห็นทริปนี้อีก จนกว่าเจ้าของทริปจะเพิ่มคุณกลับเข้ามา',
      okLabel: 'ออกจากทริป'
    }).then(function (ok) {
      if (!ok) return;
      state.selectedId = null;
      commit(memberPaths(t, me.uid, false)).then(function () { go('#calendar'); toast('ออกจากทริปแล้ว'); }).catch(function () {});
    });
  }

  /* ===== ปฏิทิน ===== */
  function calMonth() {
    if (state.calMonth) return state.calMonth;
    var d = new Date(); return { y: d.getFullYear(), m: d.getMonth() };
  }
  function tripRange(t) {
    if (!isIsoDay(t.start)) return 'ยังไม่ระบุวัน';
    var e = isIsoDay(t.end) && t.end >= t.start ? t.end : t.start;
    if (e === t.start) return fmtLong(t.start);
    // ข้ามปี (เช่น 28 ธ.ค. 2569 – 2 ม.ค. 2570) ใส่ปีทั้งสองฝั่ง
    return (e.slice(0, 4) === t.start.slice(0, 4) ? fmtShort(t.start) : fmtLong(t.start)) + ' – ' + fmtLong(e);
  }
  function renderCalendar(trips) {
    var box = $('#calendarView'), cm = calMonth(), today = isoDate(new Date());
    // ยังไม่มีทริป: แสดงปุ่มสร้างทริปแรก แต่ยังแสดงปฏิทิน (และวันหยุด) ตามปกติ
    var emptyNote = state.loaded && !trips.length ? '<section class="card cal-empty"><div><b>ยังไม่มีทริป</b>' +
      '<span class="muted small">สร้างทริปแรก แล้วทริปจะขึ้นในปฏิทินตามวันไป–วันกลับ</span></div>' +
      '<button type="button" class="btn-primary" data-act="new-trip">สร้างทริปแรก</button></section>' : '';
    var L = TripCore.layoutMonth(trips, cm.y, cm.m), byId = {}, H = holidays();
    trips.forEach(function (t) { byId[t.id] = t; });
    var mKey = cm.y + '-' + pad(cm.m + 1);
    var title = new Date(cm.y, cm.m, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
    var head = '<div class="cal-head"><h1>ปฏิทินทริป</h1>' +
      '<div class="cal-nav"><button type="button" class="icon-btn outline" data-act="cal-step" data-dir="-1" aria-label="เดือนก่อนหน้า">' + ICON.chevL + '</button>' +
      '<h2 class="cal-title" aria-live="polite">' + esc(title) + '</h2>' +
      '<button type="button" class="icon-btn outline" data-act="cal-step" data-dir="1" aria-label="เดือนถัดไป">' + ICON.chevR + '</button>' +
      '<button type="button" class="btn-secondary small-btn" data-act="cal-today">วันนี้</button></div></div>';
    var wd = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
    var grid = '<div class="cal card" role="grid" aria-label="' + esc('ปฏิทิน ' + title) + '"><div class="cal-wd" role="row">' +
      wd.map(function (d) { return '<span role="columnheader">' + d + '</span>'; }).join('') + '</div>' +
      L.weeks.map(function (w) {
        var cells = w.days.map(function (d, i) {
          var out = d.slice(0, 7) !== mKey, hol = H[d];
          return '<span class="cal-day' + (out ? ' out' : '') + (d === today ? ' today' : '') + (hol ? ' hol' : '') + (i > 4 ? ' wknd' : '') + '" style="grid-column:' + (i + 1) + '" role="gridcell"' +
            (hol ? ' title="' + esc(hol) + '" aria-label="' + esc(Number(d.slice(8)) + ' ' + hol) + '"' : '') + '><b>' + Number(d.slice(8)) + '</b>' +
            (hol ? '<span class="cal-hol" aria-hidden="true">' + esc(hol) + '</span>' : '') + '</span>';
        }).join('');
        var bars = w.bars.map(function (b) {
          var t = byId[b.tripId];
          return '<button type="button" class="cal-bar' + (b.startsHere ? ' s' : '') + (b.endsHere ? ' e' : '') + '" data-act="select-trip" data-id="' + esc(t.id) + '"' +
            ' style="grid-column:' + (b.col + 1) + ' / span ' + b.span + ';grid-row:' + (b.lane + 2) + ';--bar:' + themeColor(t.theme) + '"' +
            ' aria-label="' + esc(t.name + ' ' + tripRange(t)) + '" title="' + esc(t.name + ' · ' + tripRange(t)) + '"><span>' + esc(t.name) + '</span></button>';
        }).join('');
        return '<div class="cal-week" style="--lanes:' + w.laneCount + '">' + cells + bars + '</div>';
      }).join('') + '</div>';
    var inMonth = trips.filter(function (t) {
      if (!isIsoDay(t.start)) return false;
      var e = isIsoDay(t.end) && t.end >= t.start ? t.end : t.start;
      return t.start.slice(0, 7) <= mKey && e.slice(0, 7) >= mKey;
    }).sort(function (a, b) { return a.start.localeCompare(b.start); });
    var row = function (t) {
      return '<li><button type="button" class="cal-trip" data-act="select-trip" data-id="' + esc(t.id) + '">' +
        '<span class="cal-dot" style="background:' + themeColor(t.theme) + '" aria-hidden="true"></span>' +
        '<span class="cal-trip-text"><b>' + esc(t.name) + '</b><span class="muted small">' + esc(tripRange(t)) + (t.destination ? ' · ' + esc(t.destination) : '') + '</span></span>' +
        '<b class="num">' + money(tripTotal(t.id)) + '</b></button></li>';
    };
    var undated = L.undated.map(function (id) { return byId[id]; }).filter(Boolean);
    var hols = Object.keys(H).filter(function (k) { return k.slice(0, 7) === mKey; }).sort();
    var holBox = (hols.length || canEditHolidays()) ? '<section class="card cal-list hol-list"><div class="hol-head"><h2>วันหยุดราชการเดือนนี้</h2>' +
      (canEditHolidays() ? '<button type="button" class="btn-secondary small-btn" data-act="open-hol">แก้ไขวันหยุด</button>' : '') + '</div>' +
      (hols.length ? '<ul>' + hols.map(function (k) {
        return '<li class="hol-row"><span class="hol-date num">' + esc(fmt(k, { weekday: 'short', day: 'numeric', month: 'short' })) + '</span><span>' + esc(H[k]) + '</span></li>';
      }).join('') + '</ul>' : '<p class="muted small">ไม่มีวันหยุดราชการในเดือนนี้</p>') + '</section>' : '';
    var lists = '<section class="card cal-list"><h2>ทริปเดือนนี้</h2>' +
      (inMonth.length ? '<ul>' + inMonth.map(row).join('') + '</ul>' : '<p class="muted small">ไม่มีทริปในเดือนนี้</p>') + '</section>' +
      (undated.length ? '<section class="card cal-list"><h2>ยังไม่ระบุวัน</h2><ul>' + undated.map(row).join('') + '</ul></section>' : '');
    box.innerHTML = head + emptyNote + grid + (trips.length ? lists : '') + holBox;
  }

  function renderTripList(trips) {
    $('#tripList').innerHTML = trips.map(function (t) {
      var items = tripItems(t.id), on = state.route === 'trip' && t.id === state.selectedId;
      return '<button type="button" class="trip-card" data-act="select-trip" data-id="' + esc(t.id) + '" aria-current="' + on + '">' +
        '<div class="trip-strip" style="background:' + themeColor(t.theme) + '">' +
        (t.coverId ? '<img data-thumb="' + esc(t.coverId) + '" alt="">' : '') + '</div>' +
        '<span class="t-name">' + esc(t.name) + '</span>' +
        '<span class="t-sub">' + esc(t.destination || 'ยังไม่ระบุจุดหมาย') + (isIsoDay(t.start) ? ' · ' + tripRange(t) : '') + '</span>' +
        '<span class="t-foot"><span class="muted small">' + items.length + ' รายการ · ' + dayCount(t) + ' วัน</span><b>' + money(tripTotal(t.id)) + '</b></span>' +
        '</button>';
    }).join('');
  }

  var hasPopover = typeof HTMLElement !== 'undefined' && HTMLElement.prototype.hasOwnProperty('popover');
  // ปุ่มที่ใช้ไม่บ่อยและปุ่มลบ อยู่ในเมนู "เพิ่มเติม" แยกจากปุ่มแก้ไข กันกดพลาด
  function heroMenu(t) {
    var items = (t.coverId ? '<button type="button" class="menu-item" role="menuitem" data-act="view-cover">' + ICON.zoom + 'ดูรูปปก</button>' +
      '<button type="button" class="menu-item" role="menuitem" data-act="remove-cover">' + ICON.imgOff + 'ลบรูปปก</button>' : '') +
      (canManage(t) ? '<button type="button" class="menu-item danger" role="menuitem" data-act="delete-trip">' + ICON.trashS + 'ลบทริปนี้…</button>' : '') +
      (state.me && t.ownerId !== state.me.uid && t.members && t.members[state.me.uid] ? '<button type="button" class="menu-item danger" role="menuitem" data-act="leave-trip">' + ICON.people + 'ออกจากทริปนี้…</button>' : '');
    if (!items) return '';
    if (!hasPopover) return items.replace(/class="menu-item( danger)?" role="menuitem"/g, function (m, d) { return 'class="btn-glass' + (d || '') + '"'; });
    return '<button type="button" class="btn-glass" popovertarget="heroMenu" aria-haspopup="menu" aria-label="ตัวเลือกเพิ่มเติม" title="ตัวเลือกเพิ่มเติม">' + ICON.dots + '<span class="lbl">เพิ่มเติม</span></button>' +
      '<div class="menu" id="heroMenu" popover role="menu" aria-label="ตัวเลือกเพิ่มเติมของทริป">' + items + '</div>';
  }
  document.addEventListener('toggle', function (e) {
    var m = e.target;
    if (!m || m.id !== 'heroMenu' || e.newState !== 'open') return;
    var b = document.querySelector('[popovertarget="heroMenu"]'); if (!b) return;
    var r = b.getBoundingClientRect();
    m.style.top = Math.round(r.bottom + 6) + 'px';
    m.style.right = Math.max(8, Math.round(window.innerWidth - r.right)) + 'px';
    var first = m.querySelector('button'); if (first) first.focus();
  }, true);
  function renderHero(t) {
    var days = dayCount(t), nights = Math.max(days - 1, 0);
    var hero = $('#hero');
    hero.style.setProperty('--hero', themeColor(t.theme));
    hero.innerHTML =
      (t.coverId
        ? '<img class="hero-img" data-photo="' + esc(t.coverId) + '" alt=""><div class="hero-scrim"></div>'
        : '<svg class="hero-pattern" width="520" height="300" viewBox="0 0 520 300" fill="none" aria-hidden="true"><circle cx="380" cy="150" r="70" stroke="#fff" stroke-width="1.5"/><circle cx="380" cy="150" r="120" stroke="#fff" stroke-width="1.5"/><circle cx="380" cy="150" r="170" stroke="#fff" stroke-width="1.5"/><path d="M40 260 C 160 240, 220 120, 380 150" stroke="#fff" stroke-width="2" stroke-dasharray="6 8"/><circle cx="40" cy="260" r="6" fill="#fff"/><circle cx="380" cy="150" r="8" fill="#fff"/></svg>') +
      '<div class="hero-in"><div class="hero-actions">' +
      '<label class="btn-glass file-btn" title="' + (t.coverId ? 'เปลี่ยนรูปปก' : 'ใส่รูปปก') + '">' + ICON.img + '<span class="lbl">' + (t.coverId ? 'เปลี่ยนรูปปก' : 'ใส่รูปปก') + '</span>' +
      '<input type="file" accept="image/*" data-change="hero-cover" aria-label="' + (t.coverId ? 'เปลี่ยนรูปปก' : 'ใส่รูปปก') + '"></label>' +
      '<button type="button" class="btn-glass" data-act="edit-trip" aria-label="แก้ไขทริป" title="แก้ไขทริป">' + ICON.penS + '<span class="lbl">แก้ไขทริป</span></button>' +
      heroMenu(t) +
      '</div><div class="hero-text">' +
      '<span class="hero-dest">' + ICON.pin + esc(t.destination || 'ยังไม่ระบุจุดหมาย') + '</span>' +
      '<h1>' + esc(t.name) + '</h1>' +
      '<div class="hero-meta">' +
      '<span>' + ICON.cal + (t.start ? fmtLong(t.start) + ' – ' + fmtLong(t.end || t.start) : 'ยังไม่ระบุวัน') + '</span>' +
      '<span>' + ICON.clock + days + ' วัน ' + nights + ' คืน</span>' +
      '<span>' + ICON.people + (Math.max(parseInt(t.people, 10) || 1, 1)) + ' คน</span>' +
      (state.me ? '<button type="button" class="hero-members" data-act="open-members" aria-label="' + esc('สมาชิกทริป ' + tripMembers(t).length + ' คน') + '">' +
        tripMembers(t).slice(0, 4).map(function (uid) { return avatar(uid); }).join('') +
        '<span>สมาชิก ' + tripMembers(t).length + ' คน</span></button>' : '') +
      '</div></div></div>';
  }

  function catTotals(items) {
    var total = items.reduce(function (s, i) { return s + lineTotal(i); }, 0);
    return {
      total: total,
      cats: CATS.map(function (c) {
        var list = items.filter(function (i) { return i.cat === c.key; });
        var sum = list.reduce(function (s, i) { return s + lineTotal(i); }, 0);
        return { c: c, sum: sum, count: list.length, pct: total > 0 ? Math.round(sum / total * 100) : 0 };
      })
    };
  }

  function renderSummary(t) {
    var items = tripItems(t.id), ct = catTotals(items), people = Math.max(parseInt(t.people, 10) || 1, 1), days = dayCount(t);
    $('#summary').innerHTML =
      '<div class="total-card"><span class="lbl">ค่าใช้จ่ายรวมทั้งทริป</span><span class="big">' + money(ct.total) + '</span>' +
      '<div class="sub"><span>เฉลี่ยต่อคน <b>' + money(ct.total / people) + '</b></span><span>เฉลี่ยต่อวัน <b>' + money(ct.total / days) + '</b></span></div></div>' +
      '<div class="cat-grid">' + ct.cats.map(function (x) {
        return '<div class="cat-card"><span class="head" style="color:' + x.c.color + '"><span class="sq" style="background:' + x.c.color + '"></span>' + x.c.label + '</span>' +
          '<span class="amt">' + money(x.sum) + '</span><span class="muted small">' + x.count + ' รายการ · ' + x.pct + '%</span></div>';
      }).join('') + '</div>';
    var segs = ct.cats.filter(function (x) { return x.sum > 0; });
    $('#share').innerHTML = '<h2>สัดส่วนค่าใช้จ่าย</h2>' +
      '<div class="bar" role="img" aria-label="' + esc('สัดส่วน: ' + ct.cats.map(function (x) { return x.c.label + ' ' + x.pct + '%'; }).join(', ')) + '">' +
      segs.map(function (x) { return '<div style="width:' + (x.sum / ct.total * 100).toFixed(2) + '%;background:' + x.c.color + '"></div>'; }).join('') + '</div>' +
      '<div class="legend">' + ct.cats.map(function (x) { return '<span><span class="sq" style="background:' + x.c.color + '"></span>' + x.c.label + ' ' + x.pct + '%</span>'; }).join('') + '</div>';
  }

  function renderList(t) {
    var tabs = [{ key: 'all', label: 'ทั้งหมด' }].concat(CATS);
    $('#tabs').innerHTML = tabs.map(function (c) {
      return '<button type="button" class="tab" role="tab" data-act="filter" data-cat="' + c.key + '" aria-selected="' + (state.filter === c.key) + '">' + c.label + '</button>';
    }).join('');
    var items = tripItems(t.id).sort(function (a, b) {
      return (a.date || '').localeCompare(b.date || '') || (a.timeStart || '99').localeCompare(b.timeStart || '99') || (a.createdAt || 0) - (b.createdAt || 0);
    });
    var shown = state.filter === 'all' ? items : items.filter(function (i) { return i.cat === state.filter; });
    var list = $('#itemList');
    if (!shown.length) {
      list.innerHTML = '<div class="list-empty"><b>' + (items.length ? 'ไม่มีรายการในหมวดนี้' : 'ยังไม่มีรายการ') + '</b>' +
        '<span>เพิ่มค่าเดินทาง ที่พัก ที่เที่ยว อาหาร หรือช้อปปิ้งจากฟอร์มด้านข้าง</span></div>';
    } else {
      list.innerHTML = shown.map(function (i) {
        var c = CAT[i.cat] || CATS[0], d = toDate(i.date), photos = arr(i.photoIds), map = safeUrl(i.map);
        return '<div class="item' + (state.editingItemId === i.id ? ' editing' : '') + '">' +
          '<div class="item-date"><b>' + (d ? d.getDate() : '–') + '</b><span>' + (d ? d.toLocaleDateString('th-TH', { month: 'short' }) : '') + '</span></div>' +
          '<div class="item-body"><div class="item-title"><span class="chip" style="color:' + c.color + ';background:' + c.bg + '">' + c.label + '</span><b>' + esc(i.name) + '</b>' + aiBadge(i) + '</div>' +
          ((i.note || map || i.timeStart) ? '<div class="item-meta">' + (i.timeStart ? '<span class="num">' + esc(timeRange(i)) + ' น.</span>' : '') + (i.note ? '<span>' + esc(i.note) + '</span>' : '') +
            (map ? '<a href="' + esc(map) + '" target="_blank" rel="noopener">' + ICON.pin + 'ดูแผนที่</a>' : '') + '</div>' : '') +
          (photos.length ? '<div class="thumbs">' + photos.map(function (pid, n) {
            return '<button type="button" class="thumb-btn" data-act="open-photo" data-id="' + esc(i.id) + '" data-idx="' + n + '" aria-label="' + esc('ขยายรูปที่ ' + (n + 1) + ' ของ ' + i.name) + '"><img data-thumb="' + esc(pid) + '" alt=""></button>';
          }).join('') + '</div>' : '') +
          '</div>' +
          '<div class="item-price"><b>' + money(lineTotal(i)) + '</b><span>' + ((Number(i.qty) || 1) > 1 ? money(i.price) + ' × ' + (Number(i.qty) || 1) : '') + '</span></div>' +
          '<div class="item-actions">' +
          '<button type="button" class="icon-btn" data-act="edit-item" data-id="' + esc(i.id) + '" aria-label="' + esc('แก้ไข ' + i.name) + '">' + ICON.pen + '</button>' +
          '<button type="button" class="icon-btn" data-act="delete-item" data-id="' + esc(i.id) + '" aria-label="' + esc('ลบ ' + i.name) + '">' + ICON.trash + '</button>' +
          '</div></div>';
      }).join('');
    }
    var sum = shown.reduce(function (s, i) { return s + lineTotal(i); }, 0);
    $('#listFoot').innerHTML = '<span class="muted small">' + (state.filter === 'all' ? 'รวมทุกหมวด' : 'รวมหมวด' + CAT[state.filter].label) + ' (' + shown.length + ' รายการ)</span><b class="num">' + money(sum) + '</b>';
  }

  /* ===== ฟอร์มรายการ ===== */
  var form = $('#itemForm');
  function emptyDraft(cat, date) {
    return { cat: cat || 'travel', name: '', date: date || '', timeStart: '', timeEnd: '', price: '', qty: '1', note: '', map: '',
      travel: '', address: '', hours: '', phone: '', photos: [], removed: [], pending: 0 };
  }
  function resetDraft() {
    var t = currentTrip(), prev = state.draft;
    state.editingItemId = null;
    state.draft = emptyDraft(prev ? prev.cat : 'travel', prev && prev.date ? prev.date : (t ? t.start : ''));
    fillForm();
  }
  function fillForm() {
    var d = state.draft;
    form.name.value = d.name; setField(form.date, d.date); form.price.value = d.price;
    form.qty.value = d.qty; form.note.value = d.note; form.map.value = d.map;
    ['timeStart', 'timeEnd', 'travel', 'address', 'hours', 'phone'].forEach(function (k) { setField(form[k], d[k] || ''); });
    $('#moreFields').open = !!(d.travel || d.address || d.hours || d.phone);
    $('#itemError').hidden = true;
    updateFormChrome();
    renderDraftPhotos();
  }
  function updateFormChrome() {
    var d = state.draft, c = CAT[d.cat], editing = !!state.editingItemId;
    $('#catPills').innerHTML = CATS.map(function (x) {
      var on = x.key === d.cat;
      return '<button type="button" class="pill" data-act="pick-cat" data-cat="' + x.key + '" aria-pressed="' + on + '" style="color:' + x.color + ';' +
        (on ? 'background:' + x.bg + ';border-color:' + x.color : '') + '">' + x.label + '</button>';
    }).join('');
    $('#qtyLabel').textContent = c.qty;
    $('#hoursLabel').textContent = d.cat === 'stay' ? 'เช็กอิน / เช็กเอาต์' : 'เวลาเปิด–ปิด';
    form.hours.placeholder = d.cat === 'stay' ? 'เช่น เช็กอิน 14:00 · เช็กเอาต์ 11:00' : 'เช่น 10:00–18:00 (ปิดวันจันทร์)';
    form.name.placeholder = c.namePh;
    form.note.placeholder = c.notePh;
    $('#itemFormTitle').textContent = editing ? 'แก้ไขรายการ' : (d.fromPlan && d.date ? 'เพิ่มจุดแวะ · ' + fmtShort(d.date) : 'เพิ่มรายการ');
    $('#editBadge').hidden = !editing;
    $('#itemCancel').hidden = !editing && !d.fromPlan;
    $('#itemCancel').textContent = editing ? 'ยกเลิกการแก้ไข' : 'ยกเลิก';
    $('#itemSubmit').textContent = editing ? 'บันทึกการแก้ไข' : '+ เพิ่มเข้าทริป';
    var t = currentTrip();
    $('#mapSearch').href = gm(d.name || (t && t.destination) || '');
    var price = parseFloat(d.price) || 0, qty = Math.max(parseInt(d.qty, 10) || 1, 1);
    $('#draftTotal').textContent = money(price * qty);
  }
  function renderDraftPhotos() {
    var d = state.draft, box = $('#draftPhotos');
    box.innerHTML = d.photos.map(function (p, n) {
      return '<div class="ph">' + (p.thumb ? '<img src="' + esc(p.thumb) + '" alt="' + esc('รูปที่ ' + (n + 1)) + '">' : '<img data-thumb="' + esc(p.id) + '" alt="' + esc('รูปที่ ' + (n + 1)) + '">') +
        '<button type="button" data-act="remove-draft-photo" data-idx="' + n + '" aria-label="' + esc('ลบรูปที่ ' + (n + 1)) + '">' + ICON.x + '</button></div>';
    }).join('') +
      (d.pending ? '<div class="ph-busy">กำลังย่อรูป…</div>' : '') +
      (d.photos.length + d.pending < MAX_PHOTOS
        ? '<label class="ph-add">' + ICON.img + 'เพิ่มรูป<input type="file" accept="image/*" multiple data-change="item-photos" aria-label="เพิ่มรูปภาพ"></label>' : '');
    hydrate(box);
  }
  form.addEventListener('input', function (e) {
    var n = e.target.name;
    if (n && state.draft && n in state.draft) { state.draft[n] = getField(e.target); updateFormChrome(); }
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var t = currentTrip(), d = state.draft, err = $('#itemError');
    if (!t) return;
    var fail = function (m) { err.textContent = m; err.hidden = false; };
    if (!d.name.trim()) return fail('กรุณาใส่ชื่อรายการ');
    if (d.price !== '' && (isNaN(parseFloat(d.price)) || parseFloat(d.price) < 0)) return fail('ราคาต้องเป็นตัวเลข (ไม่มีค่าใช้จ่ายเว้นว่างได้)');
    var bad = badField(form); if (bad) return fail(bad);
    if (d.timeStart && d.timeEnd && d.timeEnd < d.timeStart) return fail('เวลาสิ้นสุดต้องไม่ก่อนเวลาเริ่ม');
    if (d.map.trim() && !safeUrl(d.map.trim())) return fail('ลิงก์แผนที่ต้องขึ้นต้นด้วย https://');
    if (d.pending) return fail('รอให้ย่อรูปเสร็จก่อน');
    err.hidden = true;
    var btn = $('#itemSubmit'); btn.disabled = true; btn.textContent = 'กำลังบันทึก…';
    var editId = state.editingItemId, old = editId ? (state.db.items[t.id] || {})[editId] : null;
    var fresh = d.photos.filter(function (p) { return p.isNew; });
    Promise.all(fresh.map(function (p) { return putPhoto(p, t.id); })).then(function () {
      var id = editId || uid('i');
      var item = {
        id: id, cat: d.cat, name: d.name.trim(), date: d.date || '', price: parseFloat(d.price) || 0,
        timeStart: d.timeStart || '', timeEnd: d.timeEnd || '', travel: d.travel.trim(), address: d.address.trim(),
        hours: d.hours.trim(), phone: d.phone.trim(),
        qty: Math.max(parseInt(d.qty, 10) || 1, 1), note: d.note.trim(), map: d.map.trim(),
        photoIds: d.photos.map(function (p) { return p.id; }),
        createdAt: (old && old.createdAt) || Date.now(), updatedAt: Date.now()
      };
      if (old && old.ai) item.ai = true;
      var removed = d.removed.slice();
      var u = {}; u['items/' + t.id + '/' + id] = item;
      return commit(u).then(function () {
        deletePhotos(removed);
        if (state.filter !== 'all' && state.filter !== item.cat) state.filter = 'all';
        if (item.date) state.dayKey = item.date;
        state.draft.date = item.date;
        resetDraft();
        render();
        toast(editId ? 'บันทึกการแก้ไขแล้ว' : 'เพิ่มรายการแล้ว');
        if (isMobile()) closeOverlays();
        closeEditModal();
      });
    }).catch(function () { fail('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง'); })
      .then(function () { btn.disabled = false; updateFormChrome(); });
  });

  function addDraftPhotos(files) {
    var d = state.draft, room = MAX_PHOTOS - d.photos.length - d.pending;
    files = Array.prototype.slice.call(files).slice(0, Math.max(room, 0));
    if (!files.length) return;
    d.pending += files.length; renderDraftPhotos();
    files.forEach(function (f) {
      processFile(f).then(function (p) { if (state.draft === d) d.photos.push(p); })
        .catch(function () { toast('เปิดไฟล์รูป "' + f.name + '" ไม่ได้'); })
        .then(function () { d.pending--; if (state.draft === d) renderDraftPhotos(); });
    });
  }

  /* ===== ฟอร์มรายการแบบหน้าต่าง (จอคอม) =====
   * ย้าย <form id="itemForm"> ตัวเดิมเข้าไปใน dialog ตอนแก้ไข/เพิ่มจุดจากแผน แล้วย้ายกลับเมื่อปิด */
  var editDialog = $('#editDialog'), editGhost = null;
  function openEditModal() {
    if (isMobile()) { openSheet(); return; }
    if (!editDialog.open) {
      var card = $('#itemFormCard');
      editGhost = document.createElement('div');
      editGhost.className = 'form-ghost';
      editGhost.style.height = form.offsetHeight + 'px';
      editGhost.innerHTML = '<span>' + ICON.penS + 'กำลังแก้ไขในหน้าต่าง</span>';
      card.appendChild(editGhost);
      $('#editHost').appendChild(form);
      if (typeof editDialog.showModal === 'function') editDialog.showModal(); else editDialog.setAttribute('open', '');
    }
    editDialog.scrollTop = 0; $('#editHost').scrollTop = 0;
    setTimeout(function () { form.name.focus({ preventScroll: true }); }, 30);
  }
  function closeEditModal() { if (editDialog.open) editDialog.close(); }
  editDialog.addEventListener('close', function () {
    var card = $('#itemFormCard');
    if (editGhost) { editGhost.remove(); editGhost = null; }
    if (form.parentNode !== card) card.appendChild(form);
    if (state.editingItemId || state.draft.fromPlan) { resetDraft(); render(); }
  });
  editDialog.addEventListener('click', function (e) { if (e.target === editDialog) closeEditModal(); });

  function startEditItem(id) {
    var t = currentTrip(), i = t && (state.db.items[t.id] || {})[id];
    if (!i) return;
    state.editingItemId = id;
    state.draft = {
      cat: i.cat, name: i.name || '', date: i.date || '', price: String(i.price == null ? '' : i.price),
      qty: String(i.qty || 1), note: i.note || '', map: i.map || '',
      timeStart: i.timeStart || '', timeEnd: i.timeEnd || '', travel: i.travel || '', address: i.address || '',
      hours: i.hours || '', phone: i.phone || '',
      photos: arr(i.photoIds).map(function (pid) { return { id: pid }; }), removed: [], pending: 0
    };
    fillForm();
    render();
    openEditModal();
  }

  /* ===== กล่องยืนยัน (แทน confirm() ของเบราว์เซอร์) ===== */
  var cfDialog = $('#confirmDialog'), cfResolve = null;
  function askConfirm(o) {
    $('#cfTitle').textContent = o.title;
    $('#cfBody').innerHTML = o.html || '';
    $('#cfNote').textContent = o.note || '';
    $('#cfNote').hidden = !o.note;
    $('#cfYes').textContent = o.okLabel || 'ลบ';
    hydrate($('#cfBody'));
    closeOverlays();
    return new Promise(function (res) {
      cfResolve = res;
      if (typeof cfDialog.showModal === 'function') cfDialog.showModal(); else cfDialog.setAttribute('open', '');
      $('#cfNo').focus();
    });
  }
  function cfFinish(v) { var r = cfResolve; cfResolve = null; if (cfDialog.open) cfDialog.close(); if (r) r(v); }
  cfDialog.addEventListener('close', function () { if (cfResolve) cfFinish(false); });
  cfDialog.addEventListener('click', function (e) { if (e.target === cfDialog) cfFinish(false); }); // กดพื้นหลังเพื่อยกเลิก

  // ลบทันทีแล้วให้กด "เลิกทำ" ได้ 8 วินาที (กดพลาดก็กู้คืนได้ ไม่ต้องตอบกล่องยืนยันทุกครั้ง)
  // รูปจะถูกลบจริงเมื่อพ้นช่วงเลิกทำเท่านั้น
  function deleteItem(id) {
    var t = currentTrip(), i = t && (state.db.items[t.id] || {})[id];
    if (!i) return;
    var copy = JSON.parse(JSON.stringify(i)), tripId = t.id, path = 'items/' + tripId + '/' + id;
    var u = {}; u[path] = null;
    if (state.editingItemId === id) resetDraft();
    commit(u).then(function () {
      toast('ลบ “' + copy.name + '” แล้ว', {
        undo: function () {
          var r = {}; r[path] = copy;
          commit(r).then(function () { toast('กู้คืน “' + copy.name + '” แล้ว'); }).catch(function () {});
        },
        done: function () { deletePhotos(arr(copy.photoIds)); }
      });
    }).catch(function () {});
  }

  /* ===== ฟอร์มทริป (dialog) ===== */
  var tripDialog = $('#tripDialog'), tripForm = $('#tripForm');
  function openTripDialog(trip) {
    state.tripDraft = trip
      ? { id: trip.id, name: trip.name || '', destination: trip.destination || '', start: trip.start || '', end: trip.end || '', people: String(trip.people || 1), theme: trip.theme || 'sea', cover: trip.coverId ? { id: trip.coverId } : null, oldCover: trip.coverId || null, pending: false }
      : { id: null, name: '', destination: '', start: '', end: '', people: '2', theme: THEMES[sortedTrips().length % THEMES.length].key, cover: null, oldCover: null, pending: false };
    var d = state.tripDraft;
    ['name', 'destination', 'start', 'end', 'people'].forEach(function (k) { setField(tripForm[k], d[k]); });
    $('#tripDialogTitle').textContent = trip ? 'แก้ไขทริป' : 'ทริปใหม่';
    $('#tripSubmit').textContent = trip ? 'บันทึกการแก้ไข' : 'บันทึกทริป';
    $('#tripError').hidden = true;
    renderTripDraft();
    if (typeof tripDialog.showModal === 'function') tripDialog.showModal(); else tripDialog.setAttribute('open', '');
    tripForm.name.focus();
  }
  function closeTripDialog() { if (tripDialog.open) tripDialog.close(); state.tripDraft = null; }
  function renderTripDraft() {
    var d = state.tripDraft; if (!d) return;
    $('#themeSwatches').innerHTML = THEMES.map(function (th) {
      return '<button type="button" class="swatch" data-act="pick-theme" data-theme="' + th.key + '" aria-pressed="' + (d.theme === th.key) + '" aria-label="' + th.label + '" title="' + th.label + '" style="background:' + th.color + '"></button>';
    }).join('');
    var pv = $('#tripCoverPreview');
    pv.style.setProperty('--hero', themeColor(d.theme));
    pv.innerHTML = (d.cover ? (d.cover.thumb ? '<img src="' + esc(d.cover.thumb) + '" alt="">' : '<img data-thumb="' + esc(d.cover.id) + '" alt="">') : '') +
      '<span>' + esc(d.pending ? 'กำลังย่อรูป…' : (d.name || 'ชื่อทริป')) + '</span>';
    $('#coverBtnLabel').textContent = d.cover ? 'เปลี่ยนรูปปก' : 'อัปโหลดรูปปก';
    $('#removeDraftCover').hidden = !d.cover;
    hydrate(pv);
  }
  tripForm.addEventListener('input', function (e) {
    var d = state.tripDraft, n = e.target.name;
    if (d && n && n in d) { d[n] = getField(e.target); if (n === 'name') renderTripDraft(); }
  });
  $('#tripCoverInput').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0], d = state.tripDraft;
    e.target.value = '';
    if (!f || !d) return;
    d.pending = true; renderTripDraft();
    processFile(f).then(function (p) { if (state.tripDraft === d) d.cover = p; })
      .catch(function () { toast('เปิดไฟล์รูปนี้ไม่ได้'); })
      .then(function () { d.pending = false; renderTripDraft(); });
  });
  tripForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var d = state.tripDraft, err = $('#tripError');
    if (!d) return;
    var fail = function (m) { err.textContent = m; err.hidden = false; };
    if (!d.name.trim()) return fail('กรุณาใส่ชื่อทริป');
    var bad = badField(tripForm); if (bad) return fail(bad);
    if (d.start && d.end && d.end < d.start) return fail('วันกลับต้องไม่ก่อนวันไป');
    if (d.pending) return fail('รอให้ย่อรูปเสร็จก่อน');
    var btn = $('#tripSubmit'); btn.disabled = true;
    var old = d.id ? state.db.trips[d.id] : null;
    var id = d.id || uid('t');
    (d.cover && d.cover.isNew ? putPhoto(d.cover, id) : Promise.resolve()).then(function () {
      var trip = {
        id: id, name: d.name.trim(), destination: d.destination.trim(), start: d.start || '', end: d.end || d.start || '',
        people: Math.max(parseInt(d.people, 10) || 1, 1), theme: d.theme, coverId: d.cover ? d.cover.id : '',
        createdAt: (old && old.createdAt) || Date.now(), updatedAt: Date.now()
      };
      var oldCover = d.oldCover, u = {};
      if (old) {
        // แก้ทีละช่อง: สมาชิกที่ไม่ใช่เจ้าของเขียนทั้งก้อนไม่ได้ (กฎฐานข้อมูลกันไม่ให้แก้ ownerId/members)
        ['name', 'destination', 'start', 'end', 'people', 'theme', 'coverId', 'updatedAt'].forEach(function (k) { u['trips/' + id + '/' + k] = trip[k]; });
      } else {
        if (state.me) {
          trip.ownerId = state.me.uid; trip.members = {}; trip.members[state.me.uid] = true;
          u['userTrips/' + state.me.uid + '/' + id] = true;
        }
        u['trips/' + id] = trip;
      }
      return commit(u).then(function () {
        if (oldCover && oldCover !== trip.coverId) deletePhotos([oldCover]);
        closeTripDialog();
        if (!old) selectTrip(id);
        toast(old ? 'บันทึกทริปแล้ว' : 'สร้างทริปแล้ว');
      });
    }).catch(function () { fail('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง'); })
      .then(function () { btn.disabled = false; });
  });
  tripDialog.addEventListener('close', function () { state.tripDraft = null; });

  function deleteTrip() {
    var t = currentTrip(); if (!t || !canManage(t)) return;
    var items = tripItems(t.id);
    askConfirm({
      title: 'ลบทริปนี้?',
      html: '<div class="cf-item cf-trip"><span class="cf-cover" style="background:' + themeColor(t.theme) + '">' + (t.coverId ? '<img data-thumb="' + esc(t.coverId) + '" alt="">' : '') + '</span>' +
        '<span class="cf-item-text"><b>' + esc(t.name) + '</b><span>' + esc(t.destination || '') + (isIsoDay(t.start) ? ' · ' + tripRange(t) : '') + '</span>' +
        '<span>' + items.length + ' รายการ · ' + money(tripTotal(t.id)) + '</span></span></div>',
      note: 'รายการ รูป และแผนรายวันทั้งหมดของทริปนี้จะถูกลบ · กด “เลิกทำ” ได้ภายใน 8 วินาทีหลังลบ',
      okLabel: 'ลบทริป'
    }).then(function (ok) { if (ok) doDeleteTrip(t, items); });
  }
  function doDeleteTrip(t, items) {
    var id = t.id, tripCopy = JSON.parse(JSON.stringify(t));
    var itemsCopy = JSON.parse(JSON.stringify(state.db.items[id] || {}));
    var photos = [t.coverId];
    items.forEach(function (i) { photos = photos.concat(arr(i.photoIds)); });
    var members = tripMembers(t);
    var u = {}; u['trips/' + id] = null; u['items/' + id] = null;
    members.forEach(function (m) { u['userTrips/' + m + '/' + id] = null; });
    state.selectedId = null;
    commit(u).then(function () {
      resetDraft(); render();
      toast('ลบทริป “' + tripCopy.name + '” แล้ว', {
        undo: function () {
          var r = {}; r['trips/' + id] = tripCopy;
          if (Object.keys(itemsCopy).length) r['items/' + id] = itemsCopy;
          members.forEach(function (m) { r['userTrips/' + m + '/' + id] = true; });
          commit(r).then(function () { selectTrip(id); toast('กู้คืนทริปแล้ว'); }).catch(function () {});
        },
        done: function () { deletePhotos(photos.filter(Boolean)); }
      });
    }).catch(function () {});
  }
  function setCover(file) {
    var t = currentTrip(); if (!t || !file) return;
    toast('กำลังอัปโหลดรูปปก…');
    processFile(file).then(function (p) {
      return putPhoto(p, t.id).then(function () {
        var old = t.coverId, u = {};
        u['trips/' + t.id + '/coverId'] = p.id; u['trips/' + t.id + '/updatedAt'] = Date.now();
        return commit(u).then(function () { if (old) deletePhotos([old]); toast('เปลี่ยนรูปปกแล้ว'); });
      });
    }).catch(function () { toast('ใส่รูปปกไม่สำเร็จ'); });
  }
  function removeCover() {
    var t = currentTrip(); if (!t || !t.coverId) return;
    var old = t.coverId, id = t.id, u = {};
    u['trips/' + id + '/coverId'] = ''; u['trips/' + id + '/updatedAt'] = Date.now();
    commit(u).then(function () {
      toast('ลบรูปปกแล้ว', {
        undo: function () {
          var r = {}; r['trips/' + id + '/coverId'] = old;
          commit(r).catch(function () {});
        },
        done: function () {
          var now = state.db.trips[id];
          if (!now || now.coverId !== old) deletePhotos([old]);
        }
      });
    }).catch(function () {});
  }

  /* ===== ดูรูปเต็มจอ ===== */
  var lb = $('#lightbox');
  function openLightbox(title, ids, index) {
    if (!ids.length) return;
    state.lightbox = { title: title, ids: ids, index: index || 0 };
    renderLightbox();
    if (typeof lb.showModal === 'function') lb.showModal(); else lb.setAttribute('open', '');
  }
  function renderLightbox() {
    var L = state.lightbox; if (!L) return;
    var n = L.ids.length, id = L.ids[L.index], img = $('#lbImg');
    $('#lbTitle').textContent = L.title;
    $('#lbCounter').textContent = n > 1 ? (L.index + 1) + ' / ' + n : '';
    img.alt = L.title + ' รูปที่ ' + (L.index + 1);
    var thumb = blobCache.get('thumbs/' + id);
    if (typeof thumb === 'string' && thumb) { img.src = thumb; img.hidden = false; } else { img.removeAttribute('src'); img.hidden = true; }
    getBlob('photos', id).then(function (src) { if (state.lightbox === L && L.ids[L.index] === id && src) { img.src = src; img.hidden = false; } });
    lb.querySelectorAll('.lb-prev,.lb-next').forEach(function (b) { b.hidden = n < 2; });
    var th = $('#lbThumbs');
    th.hidden = n < 2;
    th.innerHTML = n < 2 ? '' : L.ids.map(function (pid, k) {
      return '<button type="button" data-act="lb-go" data-idx="' + k + '" aria-current="' + (k === L.index) + '" aria-label="ดูรูปที่ ' + (k + 1) + '"><img data-thumb="' + esc(pid) + '" alt=""></button>';
    }).join('');
    hydrate(th);
  }
  function lbStep(dir) {
    var L = state.lightbox; if (!L || L.ids.length < 2) return;
    L.index = (L.index + dir + L.ids.length) % L.ids.length; renderLightbox();
  }
  lb.addEventListener('close', function () { state.lightbox = null; var i = $('#lbImg'); i.removeAttribute('src'); i.hidden = true; });
  lb.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); lbStep(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); lbStep(1); }
  });
  (function swipe() {
    var x0 = null, stage = $('#lbStage');
    stage.addEventListener('pointerdown', function (e) { x0 = e.clientX; delete stage.dataset.swiped; });
    stage.addEventListener('pointerup', function (e) {
      if (x0 == null) return;
      var dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) { lbStep(dx < 0 ? 1 : -1); stage.dataset.swiped = '1'; }
    });
  })();

  /* ===== ปุ่มต่าง ๆ ===== */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var act = el.dataset.act;
    if (act === 'lb-close') {
      // กดพื้นที่มืดรอบรูปเพื่อปิด แต่ไม่ปิดเมื่อกดที่รูป หรือหลังปัดเปลี่ยนรูป
      if (el.id === 'lbStage') {
        if (e.target !== el) return;
        if (el.dataset.swiped) { delete el.dataset.swiped; return; }
      }
      lb.close(); return;
    }
    var pop = el.closest('[popover]');
    if (pop && pop.hidePopover) { try { pop.hidePopover(); } catch (e3) {} }
    switch (act) {
      case 'select-trip':
        selectTrip(el.dataset.id);
        if (isMobile()) { closeOverlays(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
        else if (window.matchMedia('(max-width: 900px)').matches) $('#tripView').scrollIntoView({ behavior: 'smooth' });
        break;
      case 'new-trip': closeOverlays(); openTripDialog(null); break;
      case 'cal-step':
        var cm = calMonth(), nm = new Date(cm.y, cm.m + Number(el.dataset.dir), 1);
        state.calMonth = { y: nm.getFullYear(), m: nm.getMonth() }; render(); break;
      case 'cal-today': state.calMonth = null; render(); break;
      case 'open-members': openMembers(); break;
      case 'open-hol': openHolidays(); break;
      case 'close-hol': holDialog.close(); break;
      case 'hol-edit': case 'hol-remove': case 'hol-reset': holAction(act, el.dataset.day); break;
      case 'close-members': membersDialog.close(); break;
      case 'add-member': addMember(currentTrip(), el.dataset.uid); break;
      case 'remove-member': removeMember(currentTrip(), el.dataset.uid); break;
      case 'leave-trip': leaveTrip(currentTrip()); break;
      case 'deactivate-user': deactivateUser(el.dataset.uid); break;
      case 'sign-out': signOut(''); break;
      case 'open-drawer': openDrawer(); break;
      case 'open-sheet':
        if (!state.editingItemId) { resetDraft(); if (state.view === 'plan' && state.dayKey) { state.draft.date = state.dayKey; fillForm(); } }
        openSheet(); break;
      case 'set-view':
        state.view = el.dataset.view;
        try { localStorage.setItem('trip-planner-view', state.view); } catch (e2) {}
        render(); break;
      case 'pick-day': state.dayKey = el.dataset.day; render(); break;
      case 'day-step':
        var tt = currentTrip(), ds = tt ? tripDays(tt) : [], di = ds.indexOf(state.dayKey) + Number(el.dataset.dir);
        if (ds[di]) { state.dayKey = ds[di]; render(); var dt = document.querySelector('.day-tab[aria-selected="true"]'); if (dt) dt.scrollIntoView({ block: 'nearest', inline: 'center' }); }
        break;
      case 'edit-day': openDayDialog(); break;
      case 'cf-yes': cfFinish(true); break;
      case 'cf-no': cfFinish(false); break;
      case 'open-ai': openAi(); break;
      case 'close-ai': aiDialog.close(); break;
      case 'ai-back':
        if (aiState && aiState.mode === 'manual') { aiPane('manual'); break; }
        aiPane('form'); $('#aiError').hidden = true; break;
      case 'ai-back-form': aiPane('form'); $('#aiError').hidden = true; break;
      case 'ai-copy': copyText($('#aiPrompt').value, el); break;
      case 'ai-parse':
        var tp = currentTrip(), raw = $('#aiAnswer').value, me = $('#aiManualError');
        if (!raw.trim()) { me.textContent = 'วางคำตอบจาก AI ก่อน'; me.hidden = false; break; }
        var parsed = parseAiText(raw);
        if (!parsed) { me.textContent = 'อ่านคำตอบไม่ได้ ลองพิมพ์บอก AI ว่า "ส่งเป็น JSON อย่างเดียวตามรูปแบบเดิม" แล้วคัดลอกมาวางใหม่'; me.hidden = false; break; }
        me.hidden = true;
        showAiPreview(tp, parsed, null);
        aiState.mode = 'manual';
        break;
      case 'ai-apply': applyAi(); break;
      case 'export-day': exportDays([state.dayKey]); break;
      case 'export-all':
        var te = currentTrip();
        if (te) exportDays(tripDays(te).filter(function (k) { return dayItems(te, k).length; }));
        break;
      case 'close-day-dialog': dayDialog.close(); break;
      case 'add-stop':
        resetDraft(); state.draft.date = el.dataset.day; if (state.draft.cat === 'travel') state.draft.cat = 'place'; state.draft.fromPlan = true; fillForm();
        render();
        openEditModal();
        break;
      case 'close-overlays':
        if (editDialog.open) { closeEditModal(); break; }
        if (document.body.classList.contains('sheet-open') && state.editingItemId) { resetDraft(); render(); }
        closeOverlays(); break;
      case 'edit-trip': openTripDialog(currentTrip()); break;
      case 'delete-trip': deleteTrip(); break;
      case 'close-trip-dialog': closeTripDialog(); break;
      case 'pick-theme': if (state.tripDraft) { state.tripDraft.theme = el.dataset.theme; renderTripDraft(); } break;
      case 'remove-draft-cover': if (state.tripDraft) { state.tripDraft.cover = null; renderTripDraft(); } break;
      case 'view-cover': var t = currentTrip(); if (t && t.coverId) openLightbox(t.name, [t.coverId], 0); break;
      case 'remove-cover': removeCover(); break;
      case 'filter': state.filter = el.dataset.cat; render(); break;
      case 'edit-item': startEditItem(el.dataset.id); break;
      case 'delete-item': deleteItem(el.dataset.id); break;
      case 'cancel-edit':
        if (editDialog.open) { closeEditModal(); break; }
        resetDraft(); render(); if (isMobile()) closeOverlays(); break;
      case 'pick-cat': state.draft.cat = el.dataset.cat; updateFormChrome(); break;
      case 'remove-draft-photo':
        var p = state.draft.photos.splice(Number(el.dataset.idx), 1)[0];
        if (p && !p.isNew) state.draft.removed.push(p.id);
        renderDraftPhotos(); break;
      case 'open-photo':
        var tr = currentTrip(), it = tr && (state.db.items[tr.id] || {})[el.dataset.id];
        if (it) openLightbox(it.name, arr(it.photoIds), Number(el.dataset.idx)); break;
      case 'lb-prev': lbStep(-1); break;
      case 'lb-next': lbStep(1); break;
      case 'lb-go': state.lightbox.index = Number(el.dataset.idx); renderLightbox(); break;
    }
  });
  document.addEventListener('change', function (e) {
    var k = e.target.dataset && e.target.dataset.change;
    if (!k) return;
    var files = e.target.files;
    if (k === 'item-photos') addDraftPhotos(files);
    if (k === 'hero-cover' && files && files[0]) setCover(files[0]);
    e.target.value = '';
  });

  /* ===== เข้าสู่ระบบ ===== */
  var fauth = null, subs = [];
  // จำ listener ทั้งหมดไว้ ปิดทีเดียวตอนออกจากระบบ
  function listen(path, cb, onErr) {
    var ref = fdb.ref(path), fn = ref.on('value', cb, onErr || function () {});
    subs.push({ path: path, ref: ref, fn: fn });
    return fn;
  }
  function unlisten(path) {
    subs = subs.filter(function (s) { if (s.path === path) { s.ref.off('value', s.fn); return false; } return true; });
  }
  function unlistenAll() { subs.forEach(function (s) { s.ref.off('value', s.fn); }); subs = []; }

  // 'local' ไม่มี Firebase · 'wait' กำลังตรวจสอบ · 'out' ยังไม่ login · 'in' login แล้ว
  function setAuthUI(kind) {
    document.body.setAttribute('data-auth', kind);
    $('#loginView').hidden = !(kind === 'out' || kind === 'wait');
    $('#loginForm').hidden = kind === 'wait';
    $('#loginWait').hidden = kind !== 'wait';
    var me = state.me, box = $('#meBox');
    box.hidden = !me;
    if (me) {
      $('#meName').textContent = me.name || me.username;
      $('#meUser').textContent = '@' + me.username + (me.isAdmin ? ' · ผู้ดูแล' : '');
      $('#usersLink').hidden = !me.isAdmin;
    }
  }
  function showLoginError(msg) { var e = $('#loginError'); e.textContent = msg; e.hidden = !msg; }
  function showLogin(msg) {
    state.me = null;
    setAuthUI('out');
    showLoginError(msg || '');
    var lf = $('#loginForm'); lf.password.value = '';
    $('#loginSubmit').disabled = false; $('#loginSubmit').textContent = 'เข้าสู่ระบบ';
    setTimeout(function () { (lf.username.value ? lf.password : lf.username).focus(); }, 30);
  }
  $('#loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, u = TripCore.normalizeUsername(f.username.value), pw = f.password.value;
    if (!u || !pw) return showLoginError('กรอก username และรหัสผ่าน');
    if (!TripCore.validUsername(u)) return showLoginError(TripCore.authErrorText('auth/invalid-credential'));
    var b = $('#loginSubmit'); b.disabled = true; b.textContent = 'กำลังเข้าสู่ระบบ…';
    showLoginError('');
    fauth.signInWithEmailAndPassword(TripCore.usernameToEmail(u), pw).catch(function (err) {
      b.disabled = false; b.textContent = 'เข้าสู่ระบบ';
      showLoginError(TripCore.authErrorText(err && err.code));
      f.password.select();
    });
  });

  function onSignedIn(user) {
    setAuthUI('wait');
    var isAdmin = TripCore.isAdminEmail(user.email), uname = TripCore.emailToUsername(user.email);
    fdb.ref(ROOT + '/users/' + user.uid).once('value').then(function (snap) {
      var prof = snap.val();
      if (prof) return prof;
      if (!isAdmin) return null;
      // admin login ครั้งแรก: สร้างโปรไฟล์ให้เอง
      prof = { username: uname, name: uname, createdAt: Date.now() };
      var u = {}; u['users/' + user.uid] = prof; u['usernames/' + uname] = user.uid;
      return fdb.ref(ROOT).update(u).then(function () { return prof; });
    }).then(function (prof) {
      if (!prof) return signOut('บัญชีนี้ยังไม่ได้รับสิทธิ์ หรือถูกปิดแล้ว ติดต่อผู้ดูแล');
      state.me = { uid: user.uid, username: prof.username, name: prof.name, isAdmin: isAdmin };
      setAuthUI('in');
      startData();
      route();
    }).catch(function (e) {
      // อ่านโปรไฟล์ตัวเองไม่ได้ = ยังไม่มีโปรไฟล์ หรือบัญชีถูกปิดแล้ว
      var denied = e && /permission/i.test(String(e.code || '') + ' ' + String(e.message || ''));
      signOut(denied ? 'บัญชีนี้ยังไม่ได้รับสิทธิ์ หรือถูกปิดแล้ว ติดต่อผู้ดูแล' : 'เชื่อมต่อฐานข้อมูลไม่ได้ ลองใหม่อีกครั้ง');
    });
  }

  function startData() {
    var me = state.me;
    setSync('wait');
    listen('.info/connected', function (s) { setSync(s.val() ? 'live' : 'wait'); });
    // บัญชีถูกปิดระหว่างใช้งาน → ออกจากระบบ
    listen(ROOT + '/users/' + me.uid, function (s) {
      if (!state.me) return;
      if (!s.exists()) { signOut('บัญชีนี้ถูกปิดแล้ว'); return; }
      var p = s.val(); state.me.name = p.name; setAuthUI('in');
    }, function () { if (state.me) signOut('บัญชีนี้ถูกปิดแล้ว'); });
    listen(ROOT + '/users', function (s) { state.db.users = s.val() || {}; render(); });
    listen(ROOT + '/holidays', function (s) { state.db.holidays = s.val() || {}; render(); });
    startTrips();
  }

  function startTrips() {
    var me = state.me, gotTrips = false;
    var first = function () { if (!gotTrips) { gotTrips = true; ensureSelected(); resetDraft(); } };
    if (me.isAdmin) {
      listen(ROOT + '/trips', function (snap) {
        state.db.trips = snap.val() || {}; state.loaded = true;
        if (!gotTrips) claimOrphanTrips();
        first(); render();
      }, function () { setSync('err'); state.loaded = true; render(); });
      var gotItems = false;
      listen(ROOT + '/items', function (snap) {
        state.db.items = snap.val() || {}; render();
        if (!gotItems) { gotItems = true; backfillPhotoTrips(); }
      });
      return;
    }
    // ผู้ใช้ทั่วไป: ฟังดัชนีทริปของตัวเอง แล้วเปิด listener ทีละทริป
    var open = {};
    listen(ROOT + '/userTrips/' + me.uid, function (snap) {
      var ids = snap.val() || {};
      Object.keys(ids).forEach(function (id) {
        if (open[id]) return;
        state.pending++;
        var settled = false, settle = function () { if (!settled) { settled = true; state.pending--; } };
        open[id] = settle;
        listen(ROOT + '/trips/' + id, function (s) {
          settle();
          if (!s.exists()) { dropTrip(id); render(); return; }
          state.db.trips[id] = s.val(); render();
        }, function () { settle(); dropTrip(id); render(); });
        listen(ROOT + '/items/' + id, function (s) { state.db.items[id] = s.val() || {}; render(); });
      });
      Object.keys(open).forEach(function (id) {
        if (ids[id]) return;
        open[id](); delete open[id]; unlisten(ROOT + '/trips/' + id); unlisten(ROOT + '/items/' + id); dropTrip(id);
      });
      state.loaded = true; first(); render();
    }, function () { setSync('err'); state.loaded = true; render(); });
  }
  // ถูกเอาออกจากทริป หรือทริปถูกลบ: เอาออกจากหน้าจอเงียบ ๆ (ไม่ใช่ปัญหาการเชื่อมต่อ)
  function dropTrip(id) {
    if (!state.db.trips[id] && !state.db.items[id]) return;
    var wasOpen = state.selectedId === id;
    delete state.db.trips[id]; delete state.db.items[id];
    if (wasOpen) {
      state.selectedId = null; resetDraft();
      closeOverlays(); [tripDialog, dayDialog, editDialog, aiDialog].forEach(function (d) { if (d.open) d.close(); });
      toast('คุณไม่ได้อยู่ในทริปนี้แล้ว');
      if (typeof go === 'function') go('#calendar');
    }
    render();
  }
  // admin login: ทริปเดิมที่ยังไม่มีเจ้าของ ให้เป็นของ admin
  function claimOrphanTrips() {
    var me = state.me, u = {};
    Object.keys(state.db.trips).forEach(function (id) {
      if (state.db.trips[id] && !state.db.trips[id].ownerId) {
        u['trips/' + id + '/ownerId'] = me.uid; u['trips/' + id + '/members/' + me.uid] = true; u['userTrips/' + me.uid + '/' + id] = true;
      }
    });
    if (Object.keys(u).length) fdb.ref(ROOT).update(u).catch(function () {});
  }
  // รูปที่อัปโหลดก่อนมีระบบสิทธิ์ยังไม่รู้ว่าเป็นของทริปไหน: admin ใส่ให้ครั้งเดียว
  function backfillPhotoTrips() {
    fdb.ref(ROOT + '/photoTrip').once('value').then(function (snap) {
      var have = snap.val() || {}, u = {};
      Object.keys(state.db.trips).forEach(function (tid) {
        var t = state.db.trips[tid] || {}, ids = [t.coverId];
        var items = state.db.items[tid] || {};
        Object.keys(items).forEach(function (k) { ids = ids.concat(arr(items[k] && items[k].photoIds)); });
        ids.forEach(function (pid) { if (pid && typeof pid === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(pid) && !have[pid]) u['photoTrip/' + pid] = tid; });
      });
      if (Object.keys(u).length) return fdb.ref(ROOT).update(u);
    }).catch(function () {});
  }

  function signOut(msg) {
    unlistenAll();
    try { closeOverlays(); [tripDialog, aiDialog, dayDialog, editDialog, cfDialog, lb].forEach(function (d) { if (d.open) d.close(); }); } catch (e) {}
    state.db = { trips: {}, items: {}, users: {}, holidays: {} };
    state.selectedId = null; state.loaded = false; state.dayKey = null;
    blobCache.clear();
    var done = function () { showLogin(msg); resetDraft(); render(); };
    return fauth.signOut().then(done, done);
  }

  /* ===== เริ่มทำงาน ===== */
  enhanceDates();
  state.draft = emptyDraft();
  fillForm();
  (function start() {
    var cfg = window.FIREBASE_CONFIG;
    if (!cfg || !cfg.databaseURL || !window.firebase) {
      setAuthUI('local'); setSync('local'); loadLocal(); state.loaded = true; resetDraft(); route(); return;
    }
    try {
      firebase.initializeApp(cfg); fdb = firebase.database(); fauth = firebase.auth();
      // ทดสอบกับ Firebase จำลองบนเครื่อง: เปิด http://127.0.0.1:<port>/?emu=1
      if (/[?&]emu=1\b/.test(location.search) && /^(127\.0\.0\.1|localhost)$/.test(location.hostname)) {
        fauth.useEmulator('http://127.0.0.1:9099'); fdb.useEmulator('127.0.0.1', 9000); EMU = true;
      }
    } catch (e) { setAuthUI('out'); showLoginError('เปิดระบบไม่สำเร็จ ลองรีเฟรชหน้า'); return; }
    setAuthUI('wait');
    fauth.onAuthStateChanged(function (user) {
      if (user) onSignedIn(user);
      else if (document.body.getAttribute('data-auth') !== 'out') showLogin();
    });
  })();
})();
