/**
 * ตัวกลางเรียก Claude สำหรับปุ่ม "ให้ AI ช่วยจัดแพลน"
 * วางไฟล์นี้ใน Cloudflare Workers (ดูขั้นตอนใน README.md)
 *
 * ตั้งค่าใน Worker → Settings → Variables and Secrets
 *   ANTHROPIC_API_KEY  (Secret)  API key จาก console.anthropic.com
 *   ACCESS_CODE        (Secret)  รหัสที่ต้องใส่ในเว็บก่อนใช้ AI กันคนอื่นแอบใช้ key ของคุณ
 *   ALLOWED_ORIGINS    (Text)    เว็บที่อนุญาต คั่นด้วยจุลภาค เช่น https://ningbenya.github.io
 *   MODEL              (Text)    ไม่บังคับ ค่าเริ่มต้น claude-sonnet-5-5
 */

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2026-10-21';
const DEFAULT_MODEL = 'claude-sonnet-5-5';
const MAX_BODY = 60000;
const CATS = ['travel', 'stay', 'place', 'food', 'shop'];

const STOP = {
  type: 'object',
  properties: {
    cat: { type: 'string', enum: CATS, description: 'travel=การเดินทาง stay=ที่พัก place=ที่เที่ยว food=อาหาร shop=ช้อปปิ้ง' },
    name: { type: 'string', description: 'ชื่อสถานที่จริง ภาษาไทย (วงเล็บชื่ออังกฤษได้)' },
    timeStart: { type: 'string', description: 'HH:MM แบบ 24 ชั่วโมง' },
    timeEnd: { type: 'string', description: 'HH:MM แบบ 24 ชั่วโมง หรือ "" ถ้าไม่มี' },
    note: { type: 'string', description: 'รายละเอียดสั้น ๆ 1-2 ประโยค ว่าทำอะไร ไฮไลต์ เมนูเด็ด' },
    travel: { type: 'string', description: 'การเดินทางจากจุดก่อนหน้า เช่น "รถ 20–30 นาที (~12 กม.)" หรือ "" สำหรับจุดแรก' },
    address: { type: 'string', description: 'ย่าน/ตำบล/อำเภอ ที่ตั้งโดยประมาณ หรือ ""' },
    hours: { type: 'string', description: 'เวลาเปิด–ปิดที่ทราบ (ที่พัก: เช็กอิน/เช็กเอาต์) หรือ ""' },
    price: { type: 'number', description: 'ราคาประมาณต่อหน่วย (บาท) 0 ถ้าฟรีหรือไม่ทราบ' },
    qty: { type: 'integer', description: 'จำนวนหน่วย เช่น จำนวนคน จำนวนคืน' },
    mapQuery: { type: 'string', description: 'คำค้นใน Google Maps ที่เจอสถานที่นี้แน่นอน เช่น ชื่ออังกฤษ + เมือง' }
  },
  required: ['cat', 'name', 'timeStart', 'timeEnd', 'note', 'travel', 'address', 'hours', 'price', 'qty', 'mapQuery'],
  additionalProperties: false
};
const SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'สรุปแนวคิดของแพลนนี้ 1-3 ประโยค' },
    days: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'yyyy-mm-dd ตามที่ได้รับ' },
          tagline: { type: 'string', description: 'คำโปรยของวันสั้น ๆ' },
          tips: { type: 'array', items: { type: 'string' }, description: 'เคล็ดลับ 2-4 ข้อ' },
          stops: { type: 'array', items: STOP, description: 'เฉพาะจุดแวะใหม่ที่จะเพิ่ม ห้ามซ้ำกับของเดิม' }
        },
        required: ['date', 'tagline', 'tips', 'stops'],
        additionalProperties: false
      }
    }
  },
  required: ['summary', 'days'],
  additionalProperties: false
};

const SYSTEM = `คุณคือผู้ช่วยวางแผนเที่ยวมืออาชีพ ช่วยเติมแผนเที่ยวรายวันให้สมบูรณ์
กติกา:
- ตอบเป็นภาษาไทยทั้งหมด
- ใช้สถานที่ที่มีอยู่จริงและเป็นที่รู้จักในจุดหมายนั้น ห้ามแต่งชื่อสถานที่ขึ้นเอง
- จุดแวะที่ผู้ใช้มีอยู่แล้วต้องคงไว้ ห้ามส่งซ้ำ ให้จัดจุดใหม่แทรกรอบ ๆ ช่วงเวลาที่ว่าง ไม่ให้เวลาทับกัน
- เรียงจุดให้เส้นทางต่อเนื่อง ไม่ย้อนไปมา เผื่อเวลาเดินทางตามจริง
- มีมื้ออาหารในเวลาที่เหมาะสม (เช้า/เที่ยง/เย็น) ตามความเหมาะสมของวันนั้น
- วันแรกเริ่มหลังเวลาเดินทางมาถึง วันสุดท้ายจบก่อนเวลาเดินทางกลับ ถ้ามีข้อมูลการเดินทางอยู่แล้ว
- ราคาเป็นบาทโดยประมาณต่อหน่วย ให้ qty ตามจำนวนคนหรือจำนวนคืน ถ้าไม่ทราบให้ price = 0
- ถ้าไม่แน่ใจเวลาเปิด–ปิด ให้เว้นว่าง ห้ามเดา เบอร์โทรไม่ต้องใส่
- ทำตามสไตล์ จังหวะ และงบที่ผู้ใช้บอก
- days ต้องมีครบทุกวันที่ได้รับ วันที่ไม่ต้องเพิ่มอะไรให้ stops เป็น []`;

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Access-Code',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}
function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, origin ? corsHeaders(origin) : {})
  });
}
function safeEqual(a, b) {
  a = String(a || ''); b = String(b || '');
  if (!a || !b || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function str(v, max) { return String(v == null ? '' : v).slice(0, max || 300); }

function buildPrompt(body) {
  const t = body.trip || {}, p = body.prefs || {};
  const days = (Array.isArray(body.days) ? body.days : []).slice(0, 30);
  const lines = [];
  lines.push('ทริป: ' + str(t.name, 200));
  lines.push('จุดหมาย: ' + (str(t.destination, 200) || '-'));
  lines.push('จำนวนคน: ' + (parseInt(t.people, 10) || 1));
  lines.push('ช่วงวันที่: ' + str(t.start, 10) + ' ถึง ' + str(t.end, 10));
  lines.push('');
  lines.push('ความต้องการ:');
  lines.push('- สไตล์ที่ชอบ: ' + ((Array.isArray(p.styles) && p.styles.length) ? p.styles.map(s => str(s, 40)).join(', ') : 'ทั่วไป'));
  lines.push('- จังหวะ: ' + (str(p.pace, 40) || 'ปานกลาง'));
  if (p.budget) lines.push('- งบประมาณต่อคนทั้งทริป (ไม่รวมที่มีอยู่แล้ว): ประมาณ ' + (parseFloat(p.budget) || 0) + ' บาท');
  lines.push('- ขอบเขต: ' + (p.scope === 'empty' ? 'เติมเฉพาะวันที่ยังไม่มีจุดแวะเลย วันที่มีจุดแล้วให้ stops = []' : 'เติมทุกวันให้สมบูรณ์ โดยคงจุดเดิมไว้'));
  lines.push('- ที่พัก: ' + (p.addStay ? 'ถ้าคืนไหนยังไม่มีที่พัก ให้แนะนำที่พัก 1 แห่ง (cat=stay)' : 'ไม่ต้องเพิ่มที่พัก'));
  if (p.notes) lines.push('- หมายเหตุเพิ่มเติมจากผู้ใช้: ' + str(p.notes, 1000));
  lines.push('');
  lines.push('แผนปัจจุบัน:');
  days.forEach(d => {
    lines.push('Day ' + (parseInt(d.dayNo, 10) || '?') + ' (' + str(d.date, 10) + ')' + (d.tagline ? ' — ' + str(d.tagline, 200) : ''));
    const ex = (Array.isArray(d.existing) ? d.existing : []).slice(0, 40);
    if (!ex.length) lines.push('  (ยังว่าง)');
    ex.forEach(s => {
      lines.push('  - ' + (s.timeStart ? str(s.timeStart, 5) + (s.timeEnd ? '–' + str(s.timeEnd, 5) : '') : 'ไม่ระบุเวลา') +
        ' [' + str(s.cat, 10) + '] ' + str(s.name, 200) + (s.note ? ' : ' + str(s.note, 200) : ''));
    });
  });
  return lines.join('\n');
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const okOrigin = allowed.includes(origin);

    if (request.method === 'OPTIONS') {
      return okOrigin ? new Response(null, { status: 204, headers: corsHeaders(origin) }) : new Response(null, { status: 403 });
    }
    if (!okOrigin) return json({ error: 'origin', message: 'เว็บนี้ไม่ได้รับอนุญาต (ตั้ง ALLOWED_ORIGINS ใน Worker)' }, 403);
    if (request.method !== 'POST') return json({ error: 'method', message: 'ใช้ POST เท่านั้น' }, 405, origin);
    if (!env.ANTHROPIC_API_KEY || !env.ACCESS_CODE) return json({ error: 'config', message: 'Worker ยังตั้งค่า ANTHROPIC_API_KEY หรือ ACCESS_CODE ไม่ครบ' }, 500, origin);
    if (!safeEqual(request.headers.get('X-Access-Code'), env.ACCESS_CODE)) return json({ error: 'access', message: 'รหัสใช้งาน AI ไม่ถูกต้อง' }, 401, origin);

    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({ error: 'size', message: 'ข้อมูลทริปใหญ่เกินไป' }, 413, origin);
    let body;
    try { body = JSON.parse(raw); } catch (e) { return json({ error: 'body', message: 'ข้อมูลไม่ถูกต้อง' }, 400, origin); }
    if (!Array.isArray(body.days) || !body.days.length) return json({ error: 'body', message: 'ไม่มีวันในทริป' }, 400, origin);

    let res;
    try {
      res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': API_VERSION },
        body: JSON.stringify({
          model: env.MODEL || DEFAULT_MODEL,
          max_tokens: 16000,
          system: SYSTEM,
          messages: [{ role: 'user', content: buildPrompt(body) }],
          output_config: { format: { type: 'json_schema', schema: SCHEMA } }
        })
      });
    } catch (e) {
      return json({ error: 'upstream', message: 'ติดต่อ Claude ไม่ได้ ลองใหม่อีกครั้ง' }, 502, origin);
    }
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      const msg = data && data.error && data.error.message ? data.error.message : 'HTTP ' + res.status;
      const busy = res.status === 429 || res.status === 529;
      return json({ error: busy ? 'busy' : 'upstream', message: busy ? 'AI มีผู้ใช้เยอะ ลองใหม่ในอีกสักครู่' : 'Claude ตอบกลับผิดพลาด: ' + msg }, busy ? 503 : 502, origin);
    }
    if (data.stop_reason === 'refusal') return json({ error: 'refusal', message: 'AI ไม่สามารถจัดแพลนนี้ได้' }, 422, origin);
    if (data.stop_reason === 'max_tokens') return json({ error: 'long', message: 'แพลนยาวเกินไป ลองเลือกเติมเฉพาะวันที่ว่าง หรือแบ่งทำทีละช่วง' }, 422, origin);
    const block = (data.content || []).find(b => b.type === 'text');
    let plan;
    try { plan = JSON.parse(block ? block.text : ''); } catch (e) { return json({ error: 'parse', message: 'อ่านคำตอบของ AI ไม่ได้ ลองใหม่อีกครั้ง' }, 502, origin); }
    return json({ plan: plan, model: data.model || null, usage: data.usage || null }, 200, origin);
  }
};
