# Login · ปฏิทิน · สมาชิกทริป — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ต้อง login ก่อนใช้แอป หน้าแรกเป็นปฏิทินที่แสดงช่วงวันของทริป เพิ่มคนเข้าทริปได้ และแต่ละคนเห็นเฉพาะทริปของตัวเอง โดย Firebase เป็นคนบังคับสิทธิ์

**Architecture:**
- ฟังก์ชันที่ไม่มี DOM (username, คำนวณตารางปฏิทิน, ข้อความ error) อยู่ใน `core.js` ไฟล์ใหม่ ใช้ได้ทั้งในเบราว์เซอร์ (`window.TripCore`) และใน Node (`module.exports`) เพื่อให้ทดสอบได้
- หน้าจอและการรับส่งข้อมูลยังอยู่ใน `app.js` ตามแบบเดิม
- สิทธิ์ทั้งหมดบังคับด้วย `database.rules.json` และทดสอบกับ Firebase Emulator

**Tech Stack:** vanilla JS (ES5 แบบที่ใช้อยู่), Firebase compat SDK 10.12.2 (app, database, auth), `node --test`, `@firebase/rules-unit-testing` + `firebase-tools` emulator (ใช้เฉพาะตอนทดสอบ)

**Spec:** `docs/superpowers/specs/2026-11-24-login-calendar-members-design.md`

## Global Constraints
- อีเมลภายใน = `<username>@travel.local` · admin = `hwangning@travel.local`
- username: `/^[a-z0-9._-]{3,30}$/` หลังตัดช่องว่างหัวท้ายและแปลงเป็นตัวพิมพ์เล็ก
- รหัสผ่านใหม่ยาวอย่างน้อย 8 ตัว
- ข้อมูลอยู่ใต้ `planner/` path: `users/{uid}`, `usernames/{username}`, `trips/{t}` (+`ownerId`, `members/{uid}`), `userTrips/{uid}/{t}`, `items/{t}`, `photos/{id}`, `thumbs/{id}`
- ห้ามมีรหัสผ่านอยู่ในโค้ด ใน repo หรือในฐานข้อมูล
- ข้อความบนหน้าจอเป็นภาษาไทย และใช้ปุ่ม/การ์ด/ฟอนต์ตามแบบเดิม (`btn-primary`, `card`, `field`, Plex Thai)
- โหมดไม่มี Firebase (`FIREBASE_CONFIG` ว่าง) ทำงานแบบเดิม ไม่ต้อง login
- ทุกครั้งที่แก้ `app.js` หรือ `styles.css` ให้เปลี่ยนเลข `?v=` ใน `index.html`
- `node_modules/` อยู่ใน `.gitignore`

## Review Focus
1. **พิมพ์ username ไม่ตรงรูปแบบ** (`" Hwangning "`) ต้อง login ได้ เพราะทุกจุดเรียก `normalizeUsername` ก่อน (Task 1 test)
2. **ถูกเอาออกจากทริปที่กำลังเปิดอยู่:** listener ของทริปนั้นจะได้ permission-denied แอปต้องปิดทริปนั้นเงียบ ๆ แล้วกลับหน้าปฏิทิน โดยไม่ขึ้นว่า "เชื่อมต่อไม่ได้" (Task 4 step)
3. **ทริปไม่มีวัน, วันกลับก่อนวันไป, ข้ามเดือน หรือข้ามสัปดาห์:** ปฏิทินต้องไม่พัง ทริปไม่มีวันไปอยู่รายการ "ยังไม่ระบุวัน" และทริปที่ข้ามเดือนต้องตัดให้อยู่ในเดือนที่แสดง (Task 1 tests)
4. **ใส่รหัสผิดหลายครั้ง** (`auth/too-many-requests`) ต้องขึ้นข้อความไทยที่บอกให้รอ ไม่ใช่รหัส error ดิบ (Task 1 test)
5. **บัญชีถูกปิดขณะยัง login อยู่:** โปรไฟล์ถูกลบ แอปต้องออกจากระบบให้เอง พร้อมข้อความ "บัญชีนี้ถูกปิดแล้ว" (Task 3 step)

---

### Task 1: `core.js` ฟังก์ชันที่ทดสอบได้

**Files:**
- Create: `core.js`, `tests/core.test.js`
- Modify: `index.html` (โหลด `core.js?v=` ก่อน `app.js`)

**Interfaces — Produces** (`window.TripCore` / `module.exports`):
- `normalizeUsername(s: string) -> string`: ตัดช่องว่างหัวท้าย แล้วแปลงเป็นตัวพิมพ์เล็ก
- `validUsername(s: string) -> boolean`: ตรวจหลัง normalize แล้ว
- `usernameToEmail(s) -> string` / `emailToUsername(email) -> string`
- `ADMIN_EMAIL = 'hwangning@travel.local'` · `isAdminEmail(email) -> boolean`
- `authErrorText(code: string) -> string`
- `layoutMonth(trips: Array<{id,name,start,end,theme}>, year: number, month0: number) -> { weeks: Array<{ days: string[7] /*ISO, จันทร์ก่อน*/, bars: Array<{ tripId, col: 0-6, span: 1-7, lane: number, startsHere: bool, endsHere: bool }> }>, undated: tripIds[] }`

- [ ] **Step 1: เขียน test ที่ fail** ใน `tests/core.test.js` (`node:test` + `node:assert`)
  - `normalizeUsername(' Hwangning ') === 'hwangning'`
  - `validUsername('ab') === false` · `validUsername('a b c') === false` · `validUsername('Ning.2026') === true`
  - `usernameToEmail(' Hwangning ') === 'hwangning@travel.local'`
  - `emailToUsername('ning@travel.local') === 'ning'`
  - `isAdminEmail('HWANGNING@travel.local') === true`
  - `authErrorText('auth/invalid-credential') === 'username หรือรหัสผ่านไม่ถูกต้อง'`
  - `authErrorText('auth/wrong-password')` ได้ข้อความเดียวกับข้างบน
  - `authErrorText('auth/too-many-requests') === 'ลองผิดหลายครั้งเกินไป รอสักครู่แล้วลองใหม่'`
  - `authErrorText('auth/network-request-failed') === 'เชื่อมต่ออินเทอร์เน็ตไม่ได้'`
  - code อื่นได้ `'เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง'`
  - `layoutMonth` เดือน ธ.ค. 2026 (`2026, 11`):
    - มี 5 สัปดาห์ และ `weeks[0].days[0] === '2026-11-30'`
    - ทริป 10–12 ธ.ค. → bar เดียว `col 3, span 3, startsHere & endsHere`
    - ทริป 12–15 ธ.ค. (ข้ามสัปดาห์) → 2 bar: `{col 5, span 2, endsHere:false}` และ `{col 0, span 2, startsHere:false}`
    - ทริปซ้อนวันกัน → `lane` 0 และ 1
    - ทริป 28 ธ.ค.–3 ม.ค. → ถูกตัดที่สัปดาห์สุดท้ายของตาราง
    - ทริปไม่มี `start` → อยู่ใน `undated`
    - ทริปที่ `end < start` → ถือว่าเป็นวันเดียวที่ `start`
- [ ] **Step 2:** รัน `node --test tests/` → FAIL (`Cannot find module '../core.js'`)
- [ ] **Step 3: เขียน `core.js`**
  - ครอบด้วย `(function (root) { ... })(typeof window !== 'undefined' ? window : globalThis)` แล้ว export ทั้งสองแบบ
  - lane ของแต่ละสัปดาห์: เรียงทริปตาม `start` แล้วให้แต่ละทริปใช้ lane แรกที่ว่างตลอดช่วงวันของมัน
- [ ] **Step 4:** รัน `node --test tests/` → PASS ทั้งหมด
- [ ] **Step 5:** commit `เพิ่ม core.js: username, ข้อความ error และคำนวณปฏิทิน`

### Task 2: กฎฐานข้อมูล + test ด้วย emulator

**Files:**
- Modify: `database.rules.json`
- Create: `tests/rules/package.json` (devDependencies: `@firebase/rules-unit-testing`, `firebase`, `firebase-tools`), `tests/rules/firebase.json` (database rules → `../../database.rules.json`, emulator port 9000), `tests/rules/rules.test.mjs`
- Modify: `.gitignore` (เพิ่ม `node_modules/`)

**Interfaces — Produces:** สิทธิ์ตาม Spec หัวข้อ "กฎฐานข้อมูล (โครง)" ซึ่ง Task 3–8 พึ่งพา

- [ ] **Step 1: เขียน test ที่ fail** ใน `rules.test.mjs`
  - context ที่ใช้: `admin` (email `hwangning@travel.local`), `alice`/`bob` (มีโปรไฟล์), `mallory` (login แล้วแต่ไม่มีโปรไฟล์), `anon` (ไม่ login)
  - เตรียมข้อมูลด้วย `withSecurityRulesDisabled`: ทริป `t1` เจ้าของ alice สมาชิก alice
  - `anon` อ่าน `planner/trips/t1` → ไม่ได้
  - `mallory` อ่าน `planner/trips/t1` และ `planner/thumbs/x` → ไม่ได้
  - `alice` อ่านและเขียน `trips/t1`, `items/t1/i1` → ได้
  - `bob` อ่าน `trips/t1`, `items/t1` → ไม่ได้
  - `bob` อ่าน `planner/trips` ทั้งก้อน → ไม่ได้ · `admin` อ่าน → ได้
  - `alice` ใช้ update ครั้งเดียวเพิ่ม bob (`trips/t1/members/bob` + `userTrips/bob/t1`) → ได้ แล้ว bob อ่าน `t1` → ได้
  - `bob` (สมาชิก ไม่ใช่เจ้าของ) เพิ่ม carol หรือลบทริป `t1` → ไม่ได้ · `bob` แก้ชื่อทริป → ได้
  - `bob` ลบ `userTrips/bob/t1` + `trips/t1/members/bob` ของตัวเอง (ออกจากทริป) → ได้
  - `bob` สร้างทริป `t2` พร้อม `ownerId: bob`, `members/bob`, `userTrips/bob/t2` → ได้ · สร้างโดยตั้ง `ownerId: alice` → ไม่ได้
  - `alice` เขียน `planner/users/alice/name` → ได้ · เขียน `planner/users/bob` หรือ `planner/usernames/x` → ไม่ได้
  - `admin` เขียน `users/*` และ `usernames/*` → ได้
  - `admin` สร้างโปรไฟล์ตัวเองที่ `users/{adminUid}` ครั้งแรก → ได้
  - validate เดิมของ `items`, `thumbs`, `photos` ยังทำงาน (เช่น `price` ติดลบ → ไม่ได้)
- [ ] **Step 2:** `cd tests/rules && npm install && npx firebase emulators:exec --only database --project demo-trip "node --test rules.test.mjs"` → FAIL
- [ ] **Step 3: เขียนกฎใหม่ใน `database.rules.json`**
  - ใช้ `newData.parent()...` ในกฎของ `userTrips` เพื่อดูสถานะทริปหลังอัปเดต
  - `ownerId` แก้ไม่ได้หลังสร้าง ยกเว้น admin
  - คง `.validate` เดิมของ `items`, `thumbs`, `photos` ไว้
- [ ] **Step 4:** รันคำสั่งเดิม → PASS ทั้งหมด
- [ ] **Step 5:** commit `กฎฐานข้อมูลใหม่: ต้อง login และเห็นเฉพาะทริปของตัวเอง`

### Task 3: หน้า login, ตรวจสอบสิทธิ์ตอนเปิดแอป, ออกจากระบบ

**Files:** Modify `index.html` (section `#loginView`, สคริปต์ `firebase-auth-compat.js` 10.12.2), `app.js` (ส่วน "เริ่มทำงาน"), `styles.css`

**Interfaces:**
- Consumes: `TripCore.usernameToEmail`, `authErrorText`, `isAdminEmail`
- Produces:
  - `state.me = { uid, username, name, isAdmin }`
  - `startData()` เริ่ม listener ข้อมูลเฉพาะหลัง login (ใช้ใน Task 4) และฟัง `users` ทั้งก้อนเก็บใน `state.db.users` (ใช้ใน Task 6, 8)
  - `fauth` = `firebase.auth()`
  - `signOut()` ปิดทุก listener ล้าง `state.db` และ `blobCache` แล้วกลับหน้า login

- [ ] **Step 1: หน้า login** (`#loginView`)
  - การ์ดกลางจอ: ชื่อแอป, `<label>` username (`autocomplete="username"`), รหัสผ่าน (`autocomplete="current-password"`), ปุ่ม "เข้าสู่ระบบ", `<p class="error" role="alert">`
  - ระหว่างรอ ปุ่มเป็น disabled และขึ้นว่า "กำลังเข้าสู่ระบบ…"
  - ซ่อน `.app` และ topbar จนกว่า login สำเร็จ
- [ ] **Step 2: เริ่มแอป**
  - `start()` รอ `fauth.onAuthStateChanged` ก่อน ถ้ายังไม่ login → แสดง `#loginView`
  - ถ้า login แล้ว → อ่าน `users/{uid}`
    - ไม่มีโปรไฟล์ + เป็น admin → สร้าง `{username:'hwangning', name:'hwangning', createdAt}` และ `usernames/hwangning`
    - ไม่มีโปรไฟล์ + ไม่ใช่ admin → `signOut()` พร้อมข้อความ "บัญชีนี้ยังไม่ได้รับสิทธิ์ ติดต่อผู้ดูแล"
  - เมื่อได้โปรไฟล์แล้ว → `startData()`
- [ ] **Step 3: บัญชีถูกปิดระหว่างใช้งาน (Review Focus 5)**
  - ฟัง `users/{uid}` ตลอด ถ้ากลายเป็น null → `signOut()` + toast "บัญชีนี้ถูกปิดแล้ว"
- [ ] **Step 4: เมนูผู้ใช้**
  - ใน `.side` ใต้ brand: ชื่อผู้ใช้ และปุ่ม "เปลี่ยนรหัสผ่าน" (`#account`), "จัดการผู้ใช้" (`#users` แสดงเฉพาะ admin), "ออกจากระบบ"
- [ ] **Step 5: ตรวจในเบราว์เซอร์**
  - เปิด `firebase emulators:start --only auth,database` (ใน `tests/rules`)
  - ใน `app.js`: ถ้า URL มี `?emu=1` และ `location.hostname` เป็น `127.0.0.1`/`localhost` → `fauth.useEmulator('http://127.0.0.1:9099')` + `fdb.useEmulator('127.0.0.1', 9000)`
  - เปิดแอปที่ `http://127.0.0.1:<port>/?emu=1`
  - login ผิด → เห็นข้อความไทย · login `hwangning` → เข้าแอปได้ · รีเฟรชแล้วยัง login อยู่ · ออกจากระบบ → กลับหน้า login
- [ ] **Step 6:** commit

### Task 4: โหลดข้อมูลตามสิทธิ์ + เจ้าของทริป

**Files:** Modify `app.js` (`startData`, ส่วนบันทึกทริป, `doDeleteTrip`, admin claim)

**Interfaces:**
- Consumes: `state.me`
- Produces:
  - `state.db.trips` / `state.db.items` รูปแบบเดิม (ส่วน render เดิมไม่ต้องแก้)
  - `tripMembers(t) -> uid[]`
  - `canManage(t) -> boolean` (เจ้าของหรือ admin)

- [ ] **Step 1: โหลดข้อมูล**
  - admin: ฟัง `trips` และ `items` ทั้งก้อนแบบเดิม
  - คนอื่น: ฟัง `userTrips/{me}` แล้วเปิดหรือปิด listener `trips/{t}` และ `items/{t}` ตามรายการที่เปลี่ยน
- [ ] **Step 2: ถูกเอาออกจากทริป (Review Focus 2)**
  - callback error ของ listener ทริป → ลบทริปนั้นออกจาก `state.db` ไม่เรียก `setSync('err')`
  - ถ้าเป็นทริปที่เปิดอยู่ → กลับหน้าปฏิทิน + toast "คุณไม่ได้อยู่ในทริปนี้แล้ว"
- [ ] **Step 3: สร้างทริปใหม่** เขียน `ownerId: me`, `members/{me}: true` และ `userTrips/{me}/{t}: true` ใน `commit()` ครั้งเดียว
- [ ] **Step 4: ลบทริป**
  - ปุ่มลบในเมนูแสดงเฉพาะเมื่อ `canManage(t)` เป็นจริง
  - ลบ `userTrips/{uid}/{t}` ของสมาชิกทุกคนด้วย และ "เลิกทำ" คืนให้ครบ
- [ ] **Step 5: admin claim ทริปเดิม** ครั้งแรกที่ admin โหลดข้อมูล ทริปที่ไม่มี `ownerId` → ใส่ `ownerId`, `members/{admin}` และ `userTrips/{admin}/{t}`
- [ ] **Step 6: ตรวจใน emulator ด้วย 2 บัญชี**
  - alice สร้างทริป → bob มองไม่เห็น
  - admin เห็นทุกทริป
  - ทริปเดิมที่ไม่มีเจ้าของ (ใส่ด้วย `withSecurityRulesDisabled`) ถูก claim ให้ admin
- [ ] **Step 7:** commit

### Task 5: Routing + หน้าปฏิทิน

**Files:** Modify `index.html` (section `#calendarView`), `app.js` (`route()`, `renderCalendar()`), `styles.css`

**Interfaces:**
- Consumes: `TripCore.layoutMonth`, `themeColor`, `selectTrip`
- Produces: `go(hash: string)`
  - route ที่รองรับ: `#calendar` (ค่าเริ่มต้นหลัง login), `#trip=<id>` (ลิงก์เดิมยังใช้ได้), `#account`, `#users`

- [ ] **Step 1: router**
  - `route()` อ่าน `location.hash` ตอน `hashchange` และหลัง login แล้วสลับ section ด้วย `hidden`
  - ปุ่มทริปใน `.side` และแถบทริปในปฏิทินเรียก `go('#trip=' + id)`
  - ถ้า `#trip=` เป็นทริปที่ไม่มีสิทธิ์ → ไป `#calendar`
- [ ] **Step 2: `renderCalendar()`**
  - หัว: ‹ เดือน ปี (พ.ศ.) › และปุ่ม "วันนี้"
  - ตาราง 7 คอลัมน์ จันทร์–อาทิตย์ แต่ละสัปดาห์เป็น CSS grid ที่วางแถบตาม `col`/`span`/`lane` จาก `layoutMonth`
  - สีแถบจาก `themeColor(t.theme)` · มุมโค้งเฉพาะฝั่งที่ `startsHere`/`endsHere`
  - แถบเป็น `<button>` และ `aria-label` = ชื่อทริปกับช่วงวัน
  - วันนี้ไฮไลต์ · มีรายการ "ยังไม่ระบุวัน" ด้านล่าง · ถ้าไม่มีทริปเลย ใช้ empty state เดิม "สร้างทริปแรก"
- [ ] **Step 3: มือถือ (≤760px)**
  - ช่องวันเล็กลง และแถบแสดงเฉพาะสี (ไม่มีชื่อ)
  - ใต้ตารางมีรายการทริปของเดือนนั้น (ชื่อ, ช่วงวัน, ยอดรวม) ให้กดเปิดได้
- [ ] **Step 4: ตรวจ**
  - `impeccable shot` ที่ 1440x900 และ 390x844 ด้วยข้อมูลทดสอบ: ทริปซ้อนวัน, ข้ามสัปดาห์, ข้ามเดือน, ไม่มีวันที่
  - กดแถบแล้วเปิดทริปได้ · ลิงก์ `#trip=<id>` เดิมยังเปิดทริปได้หลัง login
- [ ] **Step 5:** commit

### Task 6: สมาชิกทริป

**Files:** Modify `index.html` (ส่วนสมาชิกใน `#tripDialog`), `app.js`, `styles.css`

**Interfaces:**
- Consumes: `state.db.users` (ฟัง `users` ทั้งก้อนหลัง login), `canManage`, `toast(msg, {undo, done})`
- Produces: `addMember(t, uid)`, `removeMember(t, uid)`, `leaveTrip(t)` ซึ่งแต่ละตัวทำ `commit()` ครั้งเดียว (`trips/{t}/members/{uid}` + `userTrips/{uid}/{t}`)

- [ ] **Step 1: แถบสมาชิกบนหัวทริป** แสดงวงชื่อย่อของสมาชิก กดแล้วเปิดส่วนสมาชิก
- [ ] **Step 2: ส่วนสมาชิก** (อยู่ใน dialog แก้ไขทริป)
  - รายการสมาชิก: ชื่อ, @username, ป้าย "เจ้าของ"
  - ถ้า `canManage`: ช่องค้นหาที่กรองตามชื่อหรือ username (ไม่แสดงคนที่อยู่ในทริปแล้ว) + ปุ่ม "เพิ่ม"
  - ปุ่ม "เอาออก" มี undo
- [ ] **Step 3: ออกจากทริป** สมาชิกที่ไม่ใช่เจ้าของมี "ออกจากทริปนี้" ในเมนูเพิ่มเติม (มี confirm) แล้วกลับหน้าปฏิทิน
- [ ] **Step 4: ตรวจใน emulator** alice เพิ่ม bob → bob เห็นทริปทันทีโดยไม่ต้องรีเฟรช · alice เอา bob ออก → หน้าของ bob กลับไปปฏิทินพร้อม toast
- [ ] **Step 5:** commit

### Task 7: หน้าเปลี่ยนรหัสผ่าน

**Files:** Modify `index.html` (section `#accountView`), `app.js`, `core.js` + `tests/core.test.js`

**Interfaces:** Produces `TripCore.passwordProblem(oldPw, newPw, confirmPw) -> string|''`

- [ ] **Step 1: test ที่ fail**
  - ใหม่ยาว 7 ตัว → `'รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัว'`
  - ยืนยันไม่ตรง → `'รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน'`
  - ใหม่เหมือนเดิม → `'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม'`
  - ถูกต้อง → `''`
- [ ] **Step 2:** `node --test tests/` → FAIL · เขียน `passwordProblem` · รันใหม่ → PASS
- [ ] **Step 3: ฟอร์ม**
  - 3 ช่อง (`autocomplete` = `current-password` / `new-password`)
  - ส่งแล้วเรียก `reauthenticateWithCredential(EmailAuthProvider.credential(email, old))` แล้ว `updatePassword(new)`
  - error ใช้ `authErrorText` · สำเร็จแล้วล้างฟอร์ม + toast "เปลี่ยนรหัสผ่านแล้ว"
- [ ] **Step 4: ตรวจใน emulator** เปลี่ยนรหัส → ออกจากระบบ → login ด้วยรหัสใหม่ได้ และรหัสเก่าไม่ได้
- [ ] **Step 5:** commit

### Task 8: หน้าจัดการผู้ใช้ (admin)

**Files:** Modify `index.html` (section `#usersView`), `app.js`, `styles.css`

**Interfaces:**
- Consumes: `TripCore.normalizeUsername`, `validUsername`, `usernameToEmail`, `passwordProblem`
- Produces: `createUser({username, name, password, replace}) -> Promise`, `deactivateUser(uid) -> Promise`

- [ ] **Step 1: รายชื่อผู้ใช้** ชื่อ, @username, จำนวนทริป และป้าย "admin"
- [ ] **Step 2: ฟอร์มสร้างผู้ใช้** (username, ชื่อที่แสดง, รหัสเริ่มต้น)
  - สร้างผ่าน `firebase.initializeApp(cfg, 'admin-create')` ตัวที่สองด้วย `createUserWithEmailAndPassword`
  - ได้ uid แล้วเขียน `users/{uid}` + `usernames/{username}` ด้วย connection ของ admin จากนั้น `secondary.auth().signOut()` และ `secondary.delete()`
- [ ] **Step 3: username ซ้ำ**
  - ถ้า `usernames/{username}` มีอยู่แล้ว → ถามว่า "แทนบัญชีเดิม" หรือไม่
  - ถ้าใช่ → ย้าย `userTrips` ของ uid เดิมมา uid ใหม่ แก้ `members` และ `ownerId` ในทุกทริปที่เกี่ยวข้อง และลบ `users/{เดิม}` ทั้งหมดใน `commit()` ครั้งเดียว
  - ถ้า Firebase ตอบ `auth/email-already-in-use` → บอกให้ลบบัญชีเดิมใน Firebase Console ก่อน
- [ ] **Step 4: ปิดบัญชี** (มี confirm)
  - ลบ `users/{uid}`, `usernames/{username}` และ `userTrips/{uid}`
  - เอา uid ออกจาก `members` ทุกทริป
  - ทริปที่เขาเป็นเจ้าของ → ย้าย `ownerId` เป็น admin
  - ปิดบัญชีตัวเองไม่ได้
- [ ] **Step 5: ตรวจใน emulator**
  - สร้าง alice → admin ยัง login อยู่ → alice login ได้
  - ปิด alice → ถ้า alice เปิดแอปอยู่จะหลุดออกพร้อมข้อความ
- [ ] **Step 6:** commit

### Task 9: README และตรวจรอบสุดท้าย

**Files:** Modify `README.md`

- [ ] **Step 1: README**
  - แทนส่วน "ใครก็ตามที่มีลิงก์จะเพิ่ม แก้ และลบข้อมูลได้" ด้วยขั้นตอน Console 4 ข้อจาก Spec
  - เพิ่มลำดับที่ต้องทำ: merge โค้ดก่อน แล้วค่อย publish rules
  - วิธีจัดการลืมรหัสผ่าน และวิธีรัน test (`node --test tests/` และคำสั่ง emulator)
- [ ] **Step 2: รัน test ทั้งหมด** `node --test tests/` และ rules test → PASS
- [ ] **Step 3: ตรวจหน้าจอ** `impeccable detect --json --changed` และ `impeccable shot` หน้า login, ปฏิทิน, บัญชี และจัดการผู้ใช้ ที่ 390 และ 1440
- [ ] **Step 4:** commit
