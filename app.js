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
  var toastTimer;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 3200);
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
    download: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
    plus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    people: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18.5 14.8c1.6.8 2.6 2.6 3 5.2"/></svg>'
  };

  /* ===== สถานะ ===== */
  var state = {
    db: { trips: {}, items: {} },
    loaded: false,
    selectedId: null,
    filter: 'all',
    editingItemId: null,
    draft: null,          // ฟอร์มรายการ
    tripDraft: null,      // ฟอร์มทริป (dialog)
    lightbox: null,       // { title, ids:[photoId], src:[dataURL]?, index }
    view: (function () { try { return localStorage.getItem('trip-planner-view') || 'plan'; } catch (e) { return 'plan'; } })(),
    dayKey: null,
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
  function putPhoto(p) {
    blobCache.set('thumbs/' + p.id, p.thumb); blobCache.set('photos/' + p.id, p.full);
    if (fdb) {
      var u = {}; u['thumbs/' + p.id] = p.thumb; u['photos/' + p.id] = p.full;
      return fdb.ref(ROOT).update(u);
    }
    return Promise.all([idb.set('thumbs/' + p.id, p.thumb), idb.set('photos/' + p.id, p.full)]);
  }
  function deletePhotos(ids) {
    ids = ids.filter(Boolean);
    if (!ids.length) return Promise.resolve();
    ids.forEach(function (id) { blobCache.delete('thumbs/' + id); blobCache.delete('photos/' + id); });
    if (fdb) {
      var u = {}; ids.forEach(function (id) { u['thumbs/' + id] = null; u['photos/' + id] = null; });
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
  function currentTrip() { return state.db.trips[state.selectedId] || null; }
  function tripItems(id) {
    var o = state.db.items[id] || {};
    return Object.keys(o).map(function (k) { var i = o[k]; i.id = i.id || k; return i; });
  }
  function tripTotal(id) { return tripItems(id).reduce(function (s, i) { return s + lineTotal(i); }, 0); }
  function sortedTrips() {
    return Object.keys(state.db.trips).map(function (k) { var t = state.db.trips[k]; t.id = t.id || k; return t; })
      .sort(function (a, b) {
        var x = a.start || '9999', y = b.start || '9999';
        return x === y ? (b.createdAt || 0) - (a.createdAt || 0) : y.localeCompare(x);
      });
  }
  function ensureSelected() {
    if (state.selectedId && state.db.trips[state.selectedId]) return;
    var fromHash = decodeURIComponent((location.hash || '').replace(/^#trip=/, ''));
    var list = sortedTrips();
    state.selectedId = state.db.trips[fromHash] ? fromHash : (list[0] ? list[0].id : null);
  }
  function selectTrip(id) {
    state.selectedId = id; state.filter = 'all'; state.dayKey = null;
    try { history.replaceState(null, '', '#trip=' + encodeURIComponent(id)); } catch (e) {}
    resetDraft();
    render();
  }

  /* ===== แผนรายวัน ===== */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function isoDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function timeRange(i) { return i.timeStart ? i.timeStart + (i.timeEnd ? ' – ' + i.timeEnd : '') : ''; }
  function tripDays(t) {
    var out = [], seen = {}, a = toDate(t.start), b = toDate(t.end || t.start);
    if (a && b && !isNaN(a) && !isNaN(b) && b >= a) {
      for (var d = new Date(a); d <= b && out.length < 90; d.setDate(d.getDate() + 1)) { var k = isoDate(d); seen[k] = 1; out.push(k); }
    }
    tripItems(t.id).forEach(function (i) { if (i.date && !seen[i.date]) { seen[i.date] = 1; out.push(i.date); } });
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
      return '<button type="button" class="day-tab" role="tab" data-act="pick-day" data-day="' + k + '" aria-selected="' + (k === key) + '"><b>Day ' + (n + 1) + '</b><span>' + fmtShort(k) + '</span></button>';
    }).join('') + '</div>';
    chips = '<div class="day-tabs-row">' + chips + '<button type="button" class="btn-secondary small-btn export-all" data-act="export-all">' + ICON.download + 'บันทึกทุกวันเป็นรูป</button></div>';
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
      '<button type="button" class="btn-glass" data-act="add-stop" data-day="' + key + '">' + ICON.plus + '<span class="lbl">เพิ่มจุด</span></button>' +
      '<button type="button" class="btn-glass" data-act="export-day" aria-label="บันทึกแผนวันนี้เป็นรูป" title="บันทึกแผนวันนี้เป็นรูป">' + ICON.download + '<span class="lbl">บันทึกเป็นรูป</span></button>' +
      '<button type="button" class="btn-glass" data-act="day-step" data-dir="1" aria-label="วันถัดไป"' + (idx === days.length - 1 ? ' disabled' : '') + '>' + ICON.chevR + '</button>' +
      '</span></div></section>';

    var timeline = items.length ? '<ol class="timeline">' + items.map(function (i) {
      var c = CAT[i.cat] || CATS[0], photos = arr(i.photoIds), map = safeUrl(i.map), tel = (i.phone || '').replace(/[^\d+]/g, '');
      var facts = [];
      if (i.address) facts.push('<li>' + ICON.pin + '<span><b>ที่อยู่:</b> ' + esc(i.address) + '</span></li>');
      if (i.hours) facts.push('<li>' + (i.cat === 'stay' ? ICON.home : ICON.clock) + '<span><b>' + (i.cat === 'stay' ? 'เช็กอิน/เอาต์' : 'เวลาเปิด') + ':</b> ' + esc(i.hours) + '</span></li>');
      facts.push('<li>' + ICON.coin + '<span><b>ค่าใช้จ่าย:</b> ' + (lineTotal(i) > 0 ? money(lineTotal(i)) + ((Number(i.qty) || 1) > 1 ? ' <span class="muted">(' + money(i.price) + ' × ' + i.qty + ')</span>' : '') : 'ไม่มี / ยังไม่ระบุ') + '</span></li>');
      if (i.phone) facts.push('<li>' + ICON.phone + '<span>' + (tel ? '<a href="tel:' + esc(tel) + '">' + esc(i.phone) + '</a>' : esc(i.phone)) + '</span></li>');
      if (map) facts.push('<li>' + ICON.pin + '<span><a href="' + esc(map) + '" target="_blank" rel="noopener">เปิดใน Google Maps</a></span></li>');
      return '<li class="stop' + (state.editingItemId === i.id ? ' editing' : '') + '" style="--c:' + c.color + ';--cbg:' + c.bg + '">' +
        '<div class="stop-time"><span class="stop-dot" aria-hidden="true"></span><b>' + (i.timeStart ? esc(i.timeStart) : '—') + '</b>' +
        (i.timeEnd ? '<span>– ' + esc(i.timeEnd) + '</span>' : (i.timeStart ? '' : '<span>ไม่ระบุเวลา</span>')) + '</div>' +
        '<div class="stop-card">' +
        '<div class="stop-main">' +
        '<div class="stop-title"><span class="stop-ic" aria-hidden="true">' + ICON['c_' + c.key] + '</span><div><h3>' + esc(i.name) + '</h3><span class="chip" style="color:' + c.color + ';background:' + c.bg + '">' + c.label + '</span></div>' +
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
        '<button type="button" class="btn-primary" data-act="add-stop" data-day="' + key + '">' + ICON.plus + 'เพิ่มจุดแรกของวัน</button></div>';

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
      (items.length ? '<div class="ex-route">' + items.map(function (i) { return esc(i.name); }).join(' <b>→</b> ') + '</div>' : '') +
      (info.tagline ? '<div class="ex-tag">' + esc(info.tagline) + '</div>' : '') +
      '</div></div><div class="ex-dest">' + esc(t.destination || t.name) + '</div></div>';
    h += '<div class="ex-body">';
    if (!items.length) h += '<div class="ex-empty">ยังไม่มีจุดแวะในวันนี้</div>';
    items.forEach(function (i) {
      var c = CAT[i.cat] || CATS[0], pid = arr(i.photoIds)[0], src = pid && photo[pid];
      var facts = [];
      if (i.address) facts.push('<li>' + ICON.pin + '<span><b>ที่อยู่:</b> ' + esc(i.address) + '</span></li>');
      if (i.hours) facts.push('<li>' + (i.cat === 'stay' ? ICON.home : ICON.clock) + '<span><b>' + (i.cat === 'stay' ? 'เช็กอิน/เอาต์' : 'เวลาเปิด') + ':</b> ' + esc(i.hours) + '</span></li>');
      if (lineTotal(i) > 0) facts.push('<li>' + ICON.coin + '<span><b>ค่าใช้จ่าย:</b> ' + money(lineTotal(i)) + ((Number(i.qty) || 1) > 1 ? ' (' + money(i.price) + ' × ' + i.qty + ')' : '') + '</span></li>');
      if (i.phone) facts.push('<li>' + ICON.phone + '<span>' + esc(i.phone) + '</span></li>');
      h += '<div class="ex-stop' + (src ? '' : ' no-photo') + (facts.length ? '' : ' no-info') + '" style="--c:' + c.color + ';--cbg:' + c.bg + '">' +
        '<div class="ex-time"><span class="ex-ic">' + ICON['c_' + c.key] + '</span><div><b>' + (i.timeStart ? esc(i.timeStart) + (i.timeEnd ? '' : ' น.') : '—') + '</b>' +
        (i.timeEnd ? '<span>– ' + esc(i.timeEnd) + ' น.</span>' : '') + '</div></div>' +
        '<div class="ex-main"><div class="ex-name">' + esc(i.name) + '</div>' +
        (i.note ? '<div class="ex-desc">' + esc(i.note) + '</div>' : '') +
        (i.travel ? '<div class="ex-travel">' + ICON.car + '<span>' + esc(i.travel) + '</span></div>' : '') + '</div>' +
        (src ? '<div class="ex-photo"><img src="' + src + '" alt=""></div>' : '') +
        (facts.length ? '<div class="ex-info"><div class="ex-info-h">' + (i.cat === 'stay' ? 'ข้อมูลที่พัก' : 'ข้อมูล') + '</div><ul>' + facts.join('') + '</ul></div>' : '') +
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
    Promise.all([loadLib(), document.fonts ? document.fonts.ready : null].concat(ids.map(function (id) {
      return getBlob('photos', id).then(function (src) { if (src) photo[id] = src; });
    }))).then(function (r) {
      var lib = r[0], out = [], host = document.createElement('div');
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
    ensureSelected();
    var trips = sortedTrips();
    $('#tripCount').textContent = state.loaded ? trips.length + ' ทริป' : 'กำลังโหลด…';
    renderTripList(trips);
    var trip = currentTrip();
    $('#emptyApp').hidden = !state.loaded || !!trip;
    $('#tripView').hidden = !trip;
    $('#topTitle').textContent = trip ? trip.name : 'ทริปของฉัน';
    $('#fab').hidden = !trip;
    if (!trip) { closeOverlays(); return; }
    if (state.editingItemId && !(state.db.items[trip.id] || {})[state.editingItemId]) resetDraft();
    renderHero(trip);
    renderViewTabs();
    var plan = state.view === 'plan';
    $('#summary').hidden = plan; $('#share').hidden = plan; $('#costList').hidden = plan; $('#planView').hidden = !plan;
    if (plan) renderPlan(trip); else { renderSummary(trip); renderList(trip); }
    hydrate();
  }

  function renderTripList(trips) {
    $('#tripList').innerHTML = trips.map(function (t) {
      var items = tripItems(t.id), on = t.id === state.selectedId;
      return '<button type="button" class="trip-card" data-act="select-trip" data-id="' + esc(t.id) + '" aria-current="' + on + '">' +
        '<div class="trip-strip" style="background:' + themeColor(t.theme) + '">' +
        (t.coverId ? '<img data-thumb="' + esc(t.coverId) + '" alt="">' : '') + '</div>' +
        '<span class="t-name">' + esc(t.name) + '</span>' +
        '<span class="t-sub">' + esc(t.destination || 'ยังไม่ระบุจุดหมาย') + (t.start ? ' · ' + fmtShort(t.start) + ' – ' + fmtShort(t.end || t.start) : '') + '</span>' +
        '<span class="t-foot"><span class="muted small">' + items.length + ' รายการ · ' + dayCount(t) + ' วัน</span><b>' + money(tripTotal(t.id)) + '</b></span>' +
        '</button>';
    }).join('');
  }

  function renderHero(t) {
    var days = dayCount(t), nights = Math.max(days - 1, 0), canDelete = true;
    var hero = $('#hero');
    hero.style.setProperty('--hero', themeColor(t.theme));
    hero.innerHTML =
      (t.coverId
        ? '<img class="hero-img" data-photo="' + esc(t.coverId) + '" alt=""><div class="hero-scrim"></div>'
        : '<svg class="hero-pattern" width="520" height="300" viewBox="0 0 520 300" fill="none" aria-hidden="true"><circle cx="380" cy="150" r="70" stroke="#fff" stroke-width="1.5"/><circle cx="380" cy="150" r="120" stroke="#fff" stroke-width="1.5"/><circle cx="380" cy="150" r="170" stroke="#fff" stroke-width="1.5"/><path d="M40 260 C 160 240, 220 120, 380 150" stroke="#fff" stroke-width="2" stroke-dasharray="6 8"/><circle cx="40" cy="260" r="6" fill="#fff"/><circle cx="380" cy="150" r="8" fill="#fff"/></svg>') +
      '<div class="hero-in"><div class="hero-actions">' +
      '<label class="btn-glass file-btn" title="' + (t.coverId ? 'เปลี่ยนรูปปก' : 'ใส่รูปปก') + '">' + ICON.img + '<span class="lbl">' + (t.coverId ? 'เปลี่ยนรูปปก' : 'ใส่รูปปก') + '</span>' +
      '<input type="file" accept="image/*" data-change="hero-cover" aria-label="' + (t.coverId ? 'เปลี่ยนรูปปก' : 'ใส่รูปปก') + '"></label>' +
      (t.coverId ? '<button type="button" class="btn-glass" data-act="view-cover" style="cursor:zoom-in" aria-label="ดูรูปปก" title="ดูรูปปก">' + ICON.zoom + '<span class="lbl">ดูรูปปก</span></button>' +
        '<button type="button" class="btn-glass" data-act="remove-cover" aria-label="ลบรูปปก" title="ลบรูปปก">' + ICON.imgOff + '<span class="lbl">ลบรูปปก</span></button>' : '') +
      '<button type="button" class="btn-glass" data-act="edit-trip" aria-label="แก้ไขทริป" title="แก้ไขทริป">' + ICON.penS + '<span class="lbl">แก้ไขทริป</span></button>' +
      (canDelete ? '<button type="button" class="btn-glass danger" data-act="delete-trip" aria-label="ลบทริปนี้" title="ลบทริปนี้">' + ICON.trashS + '<span class="lbl">ลบทริปนี้</span></button>' : '') +
      '</div><div class="hero-text">' +
      '<span class="hero-dest">' + ICON.pin + esc(t.destination || 'ยังไม่ระบุจุดหมาย') + '</span>' +
      '<h1>' + esc(t.name) + '</h1>' +
      '<div class="hero-meta">' +
      '<span>' + ICON.cal + (t.start ? fmtLong(t.start) + ' – ' + fmtLong(t.end || t.start) : 'ยังไม่ระบุวัน') + '</span>' +
      '<span>' + ICON.clock + days + ' วัน ' + nights + ' คืน</span>' +
      '<span>' + ICON.people + (t.people || 1) + ' คน</span>' +
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
          '<div class="item-body"><div class="item-title"><span class="chip" style="color:' + c.color + ';background:' + c.bg + '">' + c.label + '</span><b>' + esc(i.name) + '</b></div>' +
          ((i.note || map || i.timeStart) ? '<div class="item-meta">' + (i.timeStart ? '<span class="num">' + esc(timeRange(i)) + ' น.</span>' : '') + (i.note ? '<span>' + esc(i.note) + '</span>' : '') +
            (map ? '<a href="' + esc(map) + '" target="_blank" rel="noopener">' + ICON.pin + 'ดูแผนที่</a>' : '') + '</div>' : '') +
          (photos.length ? '<div class="thumbs">' + photos.map(function (pid, n) {
            return '<button type="button" class="thumb-btn" data-act="open-photo" data-id="' + esc(i.id) + '" data-idx="' + n + '" aria-label="' + esc('ขยายรูปที่ ' + (n + 1) + ' ของ ' + i.name) + '"><img data-thumb="' + esc(pid) + '" alt=""></button>';
          }).join('') + '</div>' : '') +
          '</div>' +
          '<div class="item-price"><b>' + money(lineTotal(i)) + '</b><span>' + ((Number(i.qty) || 1) > 1 ? money(i.price) + ' × ' + i.qty : '') + '</span></div>' +
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
    $('#itemFormTitle').textContent = editing ? 'แก้ไขรายการ' : 'เพิ่มรายการ';
    $('#editBadge').hidden = !editing;
    $('#itemCancel').hidden = !editing;
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
    Promise.all(fresh.map(putPhoto)).then(function () {
      var id = editId || uid('i');
      var item = {
        id: id, cat: d.cat, name: d.name.trim(), date: d.date || '', price: parseFloat(d.price) || 0,
        timeStart: d.timeStart || '', timeEnd: d.timeEnd || '', travel: d.travel.trim(), address: d.address.trim(),
        hours: d.hours.trim(), phone: d.phone.trim(),
        qty: Math.max(parseInt(d.qty, 10) || 1, 1), note: d.note.trim(), map: d.map.trim(),
        photoIds: d.photos.map(function (p) { return p.id; }),
        createdAt: (old && old.createdAt) || Date.now(), updatedAt: Date.now()
      };
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
    if (isMobile()) openSheet();
    else { if (window.matchMedia('(max-width: 900px)').matches) $('#itemFormCard').scrollIntoView({ behavior: 'smooth', block: 'start' }); form.name.focus({ preventScroll: true }); }
  }

  function deleteItem(id) {
    var t = currentTrip(), i = t && (state.db.items[t.id] || {})[id];
    if (!i || !confirm('ลบ "' + i.name + '" ?')) return;
    var u = {}; u['items/' + t.id + '/' + id] = null;
    if (state.editingItemId === id) resetDraft();
    commit(u).then(function () { deletePhotos(arr(i.photoIds)); toast('ลบรายการแล้ว'); }).catch(function () {});
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
    (d.cover && d.cover.isNew ? putPhoto(d.cover) : Promise.resolve()).then(function () {
      var id = d.id || uid('t');
      var trip = {
        id: id, name: d.name.trim(), destination: d.destination.trim(), start: d.start || '', end: d.end || d.start || '',
        people: Math.max(parseInt(d.people, 10) || 1, 1), theme: d.theme, coverId: d.cover ? d.cover.id : '',
        createdAt: (old && old.createdAt) || Date.now(), updatedAt: Date.now()
      };
      var oldCover = d.oldCover;
      var u = {}; u['trips/' + id] = trip;
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
    var t = currentTrip(); if (!t) return;
    var items = tripItems(t.id);
    if (!confirm('ลบทริป "' + t.name + '" และรายการทั้งหมด ' + items.length + ' รายการ?\nลบแล้วกู้คืนไม่ได้')) return;
    var photos = [t.coverId];
    items.forEach(function (i) { photos = photos.concat(arr(i.photoIds)); });
    var u = {}; u['trips/' + t.id] = null; u['items/' + t.id] = null;
    state.selectedId = null;
    commit(u).then(function () { deletePhotos(photos); resetDraft(); render(); toast('ลบทริปแล้ว'); }).catch(function () {});
  }
  function setCover(file) {
    var t = currentTrip(); if (!t || !file) return;
    toast('กำลังอัปโหลดรูปปก…');
    processFile(file).then(function (p) {
      return putPhoto(p).then(function () {
        var old = t.coverId, u = {};
        u['trips/' + t.id + '/coverId'] = p.id; u['trips/' + t.id + '/updatedAt'] = Date.now();
        return commit(u).then(function () { if (old) deletePhotos([old]); toast('เปลี่ยนรูปปกแล้ว'); });
      });
    }).catch(function () { toast('ใส่รูปปกไม่สำเร็จ'); });
  }
  function removeCover() {
    var t = currentTrip(); if (!t || !t.coverId) return;
    var old = t.coverId, u = {};
    u['trips/' + t.id + '/coverId'] = ''; u['trips/' + t.id + '/updatedAt'] = Date.now();
    commit(u).then(function () { deletePhotos([old]); }).catch(function () {});
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
    img.src = typeof thumb === 'string' && thumb ? thumb : '';
    getBlob('photos', id).then(function (src) { if (state.lightbox === L && L.ids[L.index] === id && src) img.src = src; });
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
  lb.addEventListener('close', function () { state.lightbox = null; $('#lbImg').removeAttribute('src'); });
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
    switch (act) {
      case 'select-trip':
        selectTrip(el.dataset.id);
        if (isMobile()) { closeOverlays(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
        else if (window.matchMedia('(max-width: 900px)').matches) $('#tripView').scrollIntoView({ behavior: 'smooth' });
        break;
      case 'new-trip': closeOverlays(); openTripDialog(null); break;
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
      case 'export-day': exportDays([state.dayKey]); break;
      case 'export-all':
        var te = currentTrip();
        if (te) exportDays(tripDays(te).filter(function (k) { return dayItems(te, k).length; }));
        break;
      case 'close-day-dialog': dayDialog.close(); break;
      case 'add-stop':
        resetDraft(); state.draft.date = el.dataset.day; if (state.draft.cat === 'travel') state.draft.cat = 'place'; fillForm();
        render();
        if (isMobile()) openSheet();
        else { $('#itemFormCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); form.name.focus({ preventScroll: true }); }
        break;
      case 'close-overlays':
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
      case 'cancel-edit': resetDraft(); render(); if (isMobile()) closeOverlays(); break;
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

  /* ===== เริ่มทำงาน ===== */
  enhanceDates();
  state.draft = emptyDraft();
  fillForm();
  (function start() {
    var cfg = window.FIREBASE_CONFIG;
    if (!cfg || !cfg.databaseURL || !window.firebase) {
      setSync('local'); loadLocal(); state.loaded = true; ensureSelected(); resetDraft(); render(); return;
    }
    setSync('wait');
    try { firebase.initializeApp(cfg); fdb = firebase.database(); }
    catch (e) { setSync('err'); loadLocal(); state.loaded = true; render(); return; }
    fdb.ref('.info/connected').on('value', function (s) { setSync(s.val() ? 'live' : 'wait'); });
    var gotTrips = false;
    fdb.ref(ROOT + '/trips').on('value', function (snap) {
      state.db.trips = snap.val() || {}; state.loaded = true;
      if (!gotTrips) { gotTrips = true; ensureSelected(); resetDraft(); }
      render();
    }, function () { setSync('err'); state.loaded = true; render(); });
    fdb.ref(ROOT + '/items').on('value', function (snap) { state.db.items = snap.val() || {}; render(); });
  })();
})();
