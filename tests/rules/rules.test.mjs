import { test, before, beforeEach, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';

let env;
const P = 'planner';
const as = {};

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-trip',
    database: { rules: readFileSync(new URL('../../database.rules.json', import.meta.url), 'utf8') }
  });
});
after(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.database().ref(P).set({
      users: {
        alice: { username: 'alice', name: 'Alice', createdAt: 1 },
        bob: { username: 'bob', name: 'Bob', createdAt: 1 },
        carol: { username: 'carol', name: 'Carol', createdAt: 1 }
      },
      usernames: { alice: 'alice', bob: 'bob', carol: 'carol' },
      trips: { t1: { id: 't1', name: 'Trip 1', ownerId: 'alice', members: { alice: true } } },
      userTrips: { alice: { t1: true } },
      items: { t1: { i1: { id: 'i1', cat: 'food', name: 'x', price: 1 } } },
      thumbs: { p1: 'data:image/jpeg;base64,AA' }
    });
  });
  as.admin = env.authenticatedContext('adminUid', { email: 'hwangning@travel.local' }).database();
  as.alice = env.authenticatedContext('alice', { email: 'alice@travel.local' }).database();
  as.bob = env.authenticatedContext('bob', { email: 'bob@travel.local' }).database();
  as.mallory = env.authenticatedContext('mallory', { email: 'mallory@travel.local' }).database();
  as.anon = env.unauthenticatedContext().database();
});

const get = (db, p) => db.ref(P + '/' + p).once('value');
const upd = (db, paths) => db.ref(P).update(paths);

test('anonymous users read nothing', async () => {
  await assertFails(get(as.anon, 'trips/t1'));
  await assertFails(get(as.anon, 'users'));
  await assertFails(get(as.anon, 'thumbs/p1'));
});

test('signed-in users without a profile read nothing', async () => {
  await assertFails(get(as.mallory, 'trips/t1'));
  await assertFails(get(as.mallory, 'thumbs/p1'));
  await assertFails(get(as.mallory, 'users'));
});

test('members read and write their trip and items', async () => {
  await assertSucceeds(get(as.alice, 'trips/t1'));
  await assertSucceeds(get(as.alice, 'items/t1'));
  await assertSucceeds(upd(as.alice, { 'trips/t1/name': 'New name', 'items/t1/i2': { id: 'i2', cat: 'food', name: 'y', price: 0 } }));
});

test('non-members cannot read a trip or the whole trips list', async () => {
  await assertFails(get(as.bob, 'trips/t1'));
  await assertFails(get(as.bob, 'items/t1'));
  await assertFails(get(as.bob, 'trips'));
  await assertFails(upd(as.bob, { 'items/t1/i9': { id: 'i9', cat: 'food', name: 'z', price: 0 } }));
});

test('admin reads everything', async () => {
  await assertSucceeds(get(as.admin, 'trips'));
  await assertSucceeds(get(as.admin, 'items'));
  await assertSucceeds(get(as.admin, 'users'));
});

test('owner adds a member in one update and the member can then read', async () => {
  await assertSucceeds(upd(as.alice, { 'trips/t1/members/bob': true, 'userTrips/bob/t1': true }));
  await assertSucceeds(get(as.bob, 'trips/t1'));
  await assertSucceeds(get(as.bob, 'userTrips/bob'));
});

test('a plain member cannot add members, change owner, or delete the trip, but can edit details', async () => {
  await env.withSecurityRulesDisabled((ctx) => upd(ctx.database(), { 'trips/t1/members/bob': true, 'userTrips/bob/t1': true }));
  await assertFails(upd(as.bob, { 'trips/t1/members/carol': true, 'userTrips/carol/t1': true }));
  await assertFails(upd(as.bob, { 'trips/t1/ownerId': 'bob' }));
  await assertFails(upd(as.bob, { 'trips/t1': null, 'items/t1': null }));
  await assertSucceeds(upd(as.bob, { 'trips/t1/name': 'Bob edit' }));
});

test('a member can leave a trip', async () => {
  await env.withSecurityRulesDisabled((ctx) => upd(ctx.database(), { 'trips/t1/members/bob': true, 'userTrips/bob/t1': true }));
  await assertSucceeds(upd(as.bob, { 'trips/t1/members/bob': null, 'userTrips/bob/t1': null }));
  await assertFails(get(as.bob, 'trips/t1'));
});

test('the owner cannot leave their own trip by removing themselves', async () => {
  await assertFails(upd(as.alice, { 'trips/t1/members/alice': null, 'userTrips/alice/t1': null }));
});

test('owner can delete their trip, items and member index', async () => {
  await assertSucceeds(upd(as.alice, { 'trips/t1': null, 'items/t1': null, 'userTrips/alice/t1': null }));
});

test('users create trips only as themselves', async () => {
  await assertSucceeds(upd(as.bob, { 'trips/t2': { id: 't2', name: 'Bob trip', ownerId: 'bob', members: { bob: true } }, 'userTrips/bob/t2': true }));
  await assertFails(upd(as.bob, { 'trips/t3': { id: 't3', name: 'Fake', ownerId: 'alice', members: { bob: true, alice: true } }, 'userTrips/bob/t3': true }));
  await assertFails(upd(as.mallory, { 'trips/t4': { id: 't4', name: 'M', ownerId: 'mallory', members: { mallory: true } }, 'userTrips/mallory/t4': true }));
});

test('users cannot add themselves to someone else\'s trip index', async () => {
  await assertFails(upd(as.bob, { 'userTrips/bob/t1': true }));
  await assertFails(upd(as.bob, { 'trips/t1/members/bob': true }));
});

test('profiles: own name only, admin manages users and usernames', async () => {
  await assertSucceeds(upd(as.alice, { 'users/alice/name': 'Alice A.' }));
  await assertFails(upd(as.alice, { 'users/alice/username': 'boss' }));
  await assertFails(upd(as.alice, { 'users/bob/name': 'x' }));
  await assertFails(upd(as.alice, { 'usernames/x': 'alice' }));
  await assertSucceeds(upd(as.admin, { 'users/dave': { username: 'dave', name: 'Dave', createdAt: 2 }, 'usernames/dave': 'dave' }));
  await assertSucceeds(upd(as.admin, { 'users/adminUid': { username: 'hwangning', name: 'hwangning', createdAt: 3 }, 'usernames/hwangning': 'adminUid' }));
  await assertSucceeds(get(as.alice, 'users'));
  await assertSucceeds(get(as.alice, 'usernames'));
});

test('admin can claim an ownerless trip and add any member', async () => {
  await env.withSecurityRulesDisabled((ctx) => upd(ctx.database(), { 'trips/old': { id: 'old', name: 'Old trip' } }));
  // แอปสร้างโปรไฟล์ admin ตอน login ครั้งแรก ก่อนรับทริปเดิม
  await assertSucceeds(upd(as.admin, { 'users/adminUid': { username: 'hwangning', name: 'hwangning', createdAt: 3 }, 'usernames/hwangning': 'adminUid' }));
  await assertSucceeds(upd(as.admin, { 'trips/old/ownerId': 'adminUid', 'trips/old/members/adminUid': true, 'userTrips/adminUid/old': true }));
  await assertSucceeds(upd(as.admin, { 'trips/t1/members/carol': true, 'userTrips/carol/t1': true }));
});

test('existing validation still applies', async () => {
  await assertFails(upd(as.alice, { 'items/t1/bad': { id: 'bad', cat: 'food', name: 'x', price: -5 } }));
  await assertFails(upd(as.alice, { 'trips/t1/name': '' }));
  await assertFails(upd(as.alice, { 'thumbs/p2': 'not-an-image', 'photoTrip/p2': 't1' }));
  await assertSucceeds(upd(as.alice, { 'thumbs/p2': 'data:image/jpeg;base64,BB', 'photoTrip/p2': 't1' }));
  await assertSucceeds(get(as.bob, 'thumbs/p1'));
});

test('admin replaces an account: new profile and trip membership in one update', async () => {
  await assertSucceeds(upd(as.admin, {
    'users/alice2': { username: 'alice', name: 'Alice', createdAt: 9 },
    'usernames/alice': 'alice2',
    'users/alice': null,
    'trips/t1/ownerId': 'alice2',
    'trips/t1/members/alice': null,
    'trips/t1/members/alice2': true,
    'userTrips/alice': null,
    'userTrips/alice2/t1': true
  }));
});

test('admin deactivates a user and takes over their trips', async () => {
  await assertSucceeds(upd(as.admin, { 'users/adminUid': { username: 'hwangning', name: 'hwangning', createdAt: 3 } }));
  await assertSucceeds(upd(as.admin, {
    'users/alice': null, 'usernames/alice': null, 'userTrips/alice': null,
    'trips/t1/members/alice': null, 'trips/t1/ownerId': 'adminUid', 'trips/t1/members/adminUid': true, 'userTrips/adminUid/t1': true
  }));
  await assertFails(get(as.alice, 'trips/t1'));
});

// ===== review fixes =====
const memberBob = () => env.withSecurityRulesDisabled((ctx) => upd(ctx.database(), { 'trips/t1/members/bob': true, 'userTrips/bob/t1': true }));

test('trip fields reject markup and wrong types', async () => {
  await memberBob();
  await assertFails(upd(as.bob, { 'trips/t1/people': '<img src=x onerror=alert(1)>' }));
  await assertFails(upd(as.bob, { 'trips/t1/people': 0 }));
  await assertSucceeds(upd(as.bob, { 'trips/t1/people': 4 }));
  await assertFails(upd(as.bob, { 'trips/t1/start': 5 }));
  await assertFails(upd(as.bob, { 'trips/t1/start': '"><img src=x>' }));
  await assertSucceeds(upd(as.bob, { 'trips/t1/start': '2026-12-10', 'trips/t1/end': '' }));
  await assertFails(upd(as.bob, { 'trips/t1/theme': '"><script>' }));
  await assertSucceeds(upd(as.bob, { 'trips/t1/theme': 'sunset' }));
  await assertFails(upd(as.bob, { 'trips/t1/coverId': 12 }));
  await assertFails(upd(as.bob, { 'trips/t1/days/bad"key': { tagline: 'x' } }));
  await assertSucceeds(upd(as.bob, { 'trips/t1/days/2026-12-10': { tagline: 'x', tips: ['a'] } }));
});

test('members cannot change a trip id', async () => {
  await memberBob();
  await assertFails(upd(as.bob, { 'trips/t1/id': 't2' }));
  await assertSucceeds(upd(as.alice, { 'trips/t1/id': 't1' }));
  await assertFails(upd(as.alice, { 'trips/t1/id': 'other' }));
});

test('item fields reject markup in date and qty', async () => {
  await assertFails(upd(as.alice, { 'items/t1/i3': { id: 'i3', cat: 'food', name: 'x', price: 1, date: '"><img src=x onerror=alert(1)>' } }));
  await assertFails(upd(as.alice, { 'items/t1/i3': { id: 'i3', cat: 'food', name: 'x', price: 1, qty: '<b>' } }));
  await assertFails(upd(as.alice, { 'items/t1/i3': { id: 'i4', cat: 'food', name: 'x', price: 1 } }));
  await assertSucceeds(upd(as.alice, { 'items/t1/i3': { id: 'i3', cat: 'food', name: 'x', price: 1, qty: 2, date: '2026-12-10', timeStart: '09:00' } }));
});

test('photos: only members of the owning trip can overwrite or delete', async () => {
  await env.withSecurityRulesDisabled((ctx) => upd(ctx.database(), {
    'trips/t9': { id: 't9', name: 'Bob only', ownerId: 'bob', members: { bob: true } }, 'userTrips/bob/t9': true,
    'thumbs/pa': 'data:image/jpeg;base64,AA', 'photos/pa': 'data:image/jpeg;base64,AA', 'photoTrip/pa': 't1',
    'thumbs/legacy': 'data:image/jpeg;base64,AA'
  }));
  // bob is not in t1: cannot touch its photo
  await assertFails(upd(as.bob, { 'thumbs/pa': null }));
  await assertFails(upd(as.bob, { 'photos/pa': 'data:image/jpeg;base64,ZZ' }));
  await assertFails(upd(as.bob, { 'photoTrip/pa': 't9' }));
  // legacy photo with no index: only admin
  await assertFails(upd(as.alice, { 'thumbs/legacy': null }));
  await assertSucceeds(upd(as.admin, { 'thumbs/legacy': null }));
  // alice (member of t1) can delete it together with its index
  await assertSucceeds(upd(as.alice, { 'thumbs/pa': null, 'photos/pa': null, 'photoTrip/pa': null }));
  // anyone with a profile can add a new photo with its index
  await assertSucceeds(upd(as.bob, { 'thumbs/pn': 'data:image/jpeg;base64,AA', 'photos/pn': 'data:image/jpeg;base64,AA', 'photoTrip/pn': 't9' }));
  await assertFails(upd(as.bob, { 'thumbs/pz': 'data:image/jpeg;base64,AA' }));
  await assertFails(upd(as.mallory, { 'thumbs/pm': 'data:image/jpeg;base64,AA', 'photoTrip/pm': 't9' }));
  await assertSucceeds(get(as.bob, 'thumbs/p1'));
});

test('holidays: everyone signed in reads, only admin edits', async () => {
  await assertSucceeds(upd(as.admin, { 'holidays/2026-11-30': { name: 'วันหยุดพิเศษ' }, 'holidays/2026-01-01': { off: true } }));
  await assertSucceeds(get(as.bob, 'holidays'));
  await assertFails(get(as.anon, 'holidays'));
  await assertFails(get(as.mallory, 'holidays'));
  await assertFails(upd(as.alice, { 'holidays/2026-12-01': { name: 'x' } }));
  await assertFails(upd(as.admin, { 'holidays/not-a-date': { name: 'x' } }));
  await assertFails(upd(as.admin, { 'holidays/2026-12-02': { name: '<img src=x>'.repeat(30) } }));
  await assertFails(upd(as.admin, { 'holidays/2026-12-03': { name: 5 } }));
  await assertSucceeds(upd(as.admin, { 'holidays/2026-11-30': null }));
});
