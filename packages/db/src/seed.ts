import { pathToFileURL } from 'node:url';
import { errorMessage, loadRootEnv } from '@pulse/aiven';
import type { RowDataPacket } from 'mysql2';
import { closeValkey, valkey } from './cache';
import { closeDb, db } from './client';
import { newId } from './ids';
import { migrateMysql } from './migrate';

/**
 * Demo data for judges: 3 judge accounts, friends, 5 groups with multilingual (English / Hindi / Kannada)
 * history — one with 150+ messages so Catch Me Up has something to chew on — plus 1:1 chats and photos.
 * Writes to MySQL (source of truth) and drops derived Valkey caches so they rebuild. Re-runnable: `--reset`
 * removes previously seeded data first.
 */

type P = { key: string; name: string; email: string; lang: string; about: string; demo?: boolean };

const people: P[] = [
  { key: 'asha', name: 'Asha (Judge)', email: 'judge.asha@pulse.demo', lang: 'en', about: 'Judging with coffee ☕', demo: true },
  { key: 'rohan', name: 'Rohan (Judge)', email: 'judge.rohan@pulse.demo', lang: 'hi', about: 'Ship it 🚀', demo: true },
  { key: 'kavya', name: 'Kavya (Judge)', email: 'judge.kavya@pulse.demo', lang: 'kn', about: 'ನಮಸ್ಕಾರ 👋', demo: true },
  { key: 'meera', name: 'Meera Iyer', email: 'meera@pulse.demo', lang: 'en', about: 'Design lead' },
  { key: 'arjun', name: 'Arjun Rao', email: 'arjun@pulse.demo', lang: 'kn', about: 'Backend · Bengaluru' },
  { key: 'zoya', name: 'Zoya Khan', email: 'zoya@pulse.demo', lang: 'hi', about: 'PM who writes code' },
  { key: 'dev', name: 'Dev Malhotra', email: 'dev@pulse.demo', lang: 'hi', about: 'Frontend & memes' },
  { key: 'nila', name: 'Nila Selvam', email: 'nila@pulse.demo', lang: 'ta', about: 'ML · Chennai' },
  { key: 'sam', name: 'Sam Thomas', email: 'sam@pulse.demo', lang: 'en', about: 'Ops' },
];

type Line = [who: string, text: string] | [who: string, text: null, photo: string];

const photo = (id: number) => `https://picsum.photos/id/${id}/900/1200`;

// ── The busy group: a hackathon team (150+ messages over 3 days) ───────────
const hackathonCore: Line[] = [
  ['meera', 'Morning team! Hackathon kickoff is Friday. Let’s lock the plan today 🙌'],
  ['arjun', 'ನಮಸ್ಕಾರ! I’m in. Backend on Aiven — Kafka + MySQL + Valkey'],
  ['zoya', 'Haan bilkul. Main roadmap bana deti hoon, then we split work'],
  ['dev', 'I’ll take the frontend. Bento cards, cream screens, the works'],
  ['meera', 'Decision: we build a chat app with AI catch-up. Everyone ok?'],
  ['arjun', '+1'],
  ['zoya', '+1, strong idea'],
  ['dev', 'Yes!! 🔥'],
  ['meera', 'Great — that’s decided. App name ideas?'],
  ['dev', 'Pulse?'],
  ['zoya', 'Pulse is nice. Short and works in Hindi conversations too'],
  ['arjun', 'Pulse it is'],
  ['meera', '@Asha can you review the pitch deck by Thursday evening?'],
  ['asha', 'Sure, send it over when ready'],
  ['zoya', 'Deadline reminder: submission closes Friday 6 PM, not midnight ⏰'],
  ['dev', 'Wait really? I thought midnight'],
  ['zoya', 'Checked the rules page — 6 PM IST. Pinning this'],
  ['arjun', 'Kafka topics: messages.sent, receipts, presence, ai.jobs, analytics. Free tier allows 5'],
  ['meera', 'Perfect. Arjun owns the pipeline'],
  ['arjun', 'ಸರಿ, I’ll have the consumer groups up by tomorrow'],
  ['nila', 'Joining late — I can do the embeddings + pgvector search'],
  ['meera', 'Welcome Nila! Yes please, semantic search is yours'],
  ['nila', 'Using cosine similarity, scoped to the user’s chats'],
  ['dev', 'Venue for the demo day dinner? Rooftop or the café?'],
  ['zoya', 'Rooftop! 🌇'],
  ['arjun', 'Rooftop'],
  ['meera', 'Café is closer…'],
  ['dev', 'Rooftop wins 4–1 😄'],
  ['meera', 'Fine fine, decision: rooftop dinner Friday 8 PM'],
  ['zoya', 'Booking it now'],
  ['zoya', 'Booked ✅ table for 7 at 8 PM'],
  ['dev', null, photo(1067)],
  ['dev', 'Mood board for the UI ^'],
  ['meera', 'Love the colours. Keep the coral and periwinkle'],
  ['rohan', 'Hey all, Rohan here — I’ll test on Android'],
  ['meera', 'Thanks Rohan! @Rohan please test the PWA install too'],
  ['rohan', 'Will do, kal subah tak'],
  ['arjun', 'Valkey adapter working across two API instances 🎉'],
  ['dev', 'Ticks are live! grey → double → blue'],
  ['zoya', 'Kal ka standup 10 baje. Sab aa jana'],
  ['nila', 'Embeddings backfill done for 2k messages'],
  ['meera', 'Decision: we demo on two phones side by side'],
  ['arjun', 'Need someone to write the README architecture section'],
  ['kavya', 'I can do that, ನಾನು ಮಾಡುತ್ತೇನೆ'],
  ['meera', 'Thanks Kavya! README due Thursday noon'],
  ['dev', 'Found a bug: typing indicator sticks if you close the tab'],
  ['arjun', 'Fixed — added a TTL on the typing key'],
  ['zoya', 'Deadline: demo video recorded by Thursday 9 PM 🎬'],
  ['sam', 'Render + Vercel set up. Keep-alive pings every 10 min'],
  ['meera', '@Dev can you finish the shared-element transition by Wednesday?'],
  ['dev', 'On it. Card → chat morph looks sick already'],
  ['nila', 'Translate works for Hindi, Kannada and Tamil now'],
  ['zoya', 'Bahut badhiya! 👏'],
  ['arjun', 'Load test: 200 msgs/sec, p95 delivery 180 ms'],
  ['meera', 'That’s our Under the Hood slide right there'],
  ['asha', 'Deck reviewed — left comments on slides 3 and 7'],
  ['meera', 'Thank you Asha!! fixing now'],
  ['zoya', 'Final check: everyone push by Friday 4 PM so we have buffer'],
  ['arjun', 'ಸರಿ 👍'],
  ['dev', 'Yes'],
  ['nila', 'Will do'],
];

const chatter = [
  'haha', '😂', 'true', 'ok', '👍', 'nice', 'on it', 'agreed', 'one sec', 'brb', 'done', 'lol yes', 'ठीक है', 'हाँ', 'सही', 'ಸರಿ',
  'ಹೌದು', 'cool', '🔥🔥', 'makes sense', 'can we sync later?', 'sending in 5', 'pushed', 'pulling now', 'looks good', 'nice catch',
  'coffee break ☕', 'back', 'kal milte hain', 'thoda late hoga', 'which branch?', 'main', 'merged', 'CI is green ✅', 'tests pass',
];

function expand(core: Line[], filler: number, crowd: string[]): Line[] {
  const out: Line[] = [];
  let seed = 7;
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const per = Math.ceil(filler / core.length);
  for (const line of core) {
    out.push(line);
    const n = Math.floor(rand() * (per + 1));
    for (let i = 0; i < n && out.length < core.length + filler; i++) {
      out.push([crowd[Math.floor(rand() * crowd.length)]!, chatter[Math.floor(rand() * chatter.length)]!]);
    }
  }
  return out;
}

const groups: { title: string; members: string[]; lines: Line[]; days: number; ai?: boolean }[] = [
  {
    title: 'Hackathon Crew',
    members: ['meera', 'arjun', 'zoya', 'dev', 'nila', 'asha', 'rohan', 'kavya', 'sam'],
    lines: expand(hackathonCore, 110, ['meera', 'arjun', 'zoya', 'dev', 'nila']),
    days: 3,
    ai: true,
  },
  {
    title: 'Goa Trip ’26',
    members: ['zoya', 'dev', 'asha', 'rohan', 'meera'],
    lines: [
      ['zoya', 'Goa plan final? 15–18 Dec'],
      ['dev', 'Yesss 🏖️'],
      ['rohan', 'Flights abhi book karein? Prices badh rahe hain'],
      ['asha', 'Booking tonight. Budget ₹12k each for flights'],
      ['meera', 'Decision: we stay in Assagao, the villa with the pool'],
      ['dev', null, photo(1015)],
      ['zoya', 'That view 😍'],
      ['rohan', 'Deadline: pay Zoya ₹8,000 for the villa by Sunday'],
      ['asha', 'Paid ✅'],
      ['dev', null, photo(1036)],
    ],
    days: 5,
  },
  {
    title: 'ಮನೆ · Family',
    members: ['kavya', 'arjun', 'asha'],
    lines: [
      ['arjun', 'ಅಮ್ಮ ಕೇಳ್ತಿದ್ರು ಭಾನುವಾರ ಊಟಕ್ಕೆ ಬರ್ತೀರಾ?'],
      ['kavya', 'ಹೌದು, 1 ಗಂಟೆಗೆ ಬರ್ತೀನಿ'],
      ['asha', 'I’ll bring dessert 🍰'],
      ['arjun', 'Super! Sunday 1 PM at home then'],
      ['kavya', 'ಸರಿ 👍'],
    ],
    days: 2,
  },
  {
    title: 'Design Guild',
    members: ['meera', 'dev', 'kavya', 'rohan'],
    lines: [
      ['meera', 'New tokens shipping tonight — radii are now 32 / 24 / 36'],
      ['dev', 'Muted text needed 0.74 alpha for AA on coral, FYI'],
      ['kavya', 'Good catch. Contrast first'],
      ['rohan', 'Review on Friday 11 AM?'],
      ['meera', 'Friday 11 AM works. Bring screenshots at 390 and 1440'],
    ],
    days: 4,
  },
  {
    title: 'Book Club',
    members: ['asha', 'nila', 'sam', 'kavya', 'zoya'],
    lines: [
      ['nila', 'Chapter 7 for next week?'],
      ['sam', 'Yes. Also who’s hosting?'],
      ['asha', 'I can host — Saturday 5 PM'],
      ['zoya', 'Main snacks laungi'],
      ['kavya', 'See you all Saturday!'],
    ],
    days: 6,
  },
];

const directs: { a: string; b: string; lines: Line[]; pinFor?: string }[] = [
  {
    a: 'asha',
    b: 'meera',
    pinFor: 'asha',
    lines: [
      ['meera', 'Hey! Thanks for judging today 🙏'],
      ['asha', 'Happy to! Excited to see Pulse'],
      ['meera', 'Try “Catch me up” in Hackathon Crew — 150+ messages'],
    ],
  },
  { a: 'rohan', b: 'zoya', pinFor: 'rohan', lines: [['zoya', 'Rohan, demo 4 baje hai'], ['rohan', 'Done, main aa jaunga']] },
  { a: 'kavya', b: 'arjun', pinFor: 'kavya', lines: [['arjun', 'ನಾಳೆ ಸಿಗೋಣ?'], ['kavya', 'ಸರಿ, 10 ಗಂಟೆಗೆ']] },
  { a: 'asha', b: 'rohan', lines: [['rohan', 'Asha, scorecard ready?'], ['asha', 'Almost, sending by 5']] },
];

async function reset() {
  const pool = db();
  const [users] = await pool.query<RowDataPacket[]>(`SELECT id FROM users WHERE email LIKE '%@pulse.demo'`);
  const ids = users.map((u) => u.id as string);
  if (!ids.length) return;
  const [convs] = await pool.query<RowDataPacket[]>(
    'SELECT DISTINCT conversation_id AS id FROM conversation_members WHERE user_id IN (?)',
    [ids],
  );
  const convIds = convs.map((c) => c.id as string);
  if (convIds.length) {
    await pool.query('DELETE FROM message_receipts WHERE message_id IN (SELECT id FROM messages WHERE conversation_id IN (?))', [convIds]);
    await pool.query('DELETE FROM reactions WHERE message_id IN (SELECT id FROM messages WHERE conversation_id IN (?))', [convIds]);
    await pool.query('DELETE FROM moments WHERE conversation_id IN (?)', [convIds]);
    await pool.query('DELETE FROM messages WHERE conversation_id IN (?)', [convIds]);
    await pool.query('DELETE FROM conversation_members WHERE conversation_id IN (?)', [convIds]);
    await pool.query('DELETE FROM conversations WHERE id IN (?)', [convIds]);
  }
  await pool.query('DELETE FROM media WHERE uploader_id IN (?)', [ids]);
  await pool.query('DELETE FROM users WHERE id IN (?)', [ids]);
}

export async function seed({ resetFirst = false } = {}): Promise<{ users: number; messages: number }> {
  const pool = db();
  if (resetFirst) await reset();
  const [existing] = await pool.query<RowDataPacket[]>(`SELECT id FROM users WHERE email = 'judge.asha@pulse.demo'`);
  if (existing.length) {
    console.log('Already seeded (run with --reset to recreate).');
    return { users: 0, messages: 0 };
  }

  const uid: Record<string, string> = {};
  for (const p of people) {
    uid[p.key] = newId();
    await pool.query('INSERT INTO users (id, email, name, avatar_seed, about, lang, is_demo) VALUES (?, ?, ?, ?, ?, ?, ?)', [
      uid[p.key],
      p.email,
      p.name,
      p.key,
      p.about,
      p.lang,
      p.demo ? 1 : 0,
    ]);
  }

  let messageCount = 0;
  async function writeHistory(convId: string, lines: Line[], days: number) {
    const end = Date.now() - 5 * 60_000;
    const start = end - days * 86_400_000;
    const step = (end - start) / Math.max(lines.length, 1);
    const rows: unknown[][] = [];
    let lastId = '';
    let lastAt = new Date(start);
    for (let i = 0; i < lines.length; i++) {
      const [who, text, img] = lines[i]!;
      const at = Math.round(start + i * step + (i % 3) * 7_000);
      const id = newId(at);
      let mediaId: string | null = null;
      if (img) {
        mediaId = newId(at);
        await pool.query(
          `INSERT INTO media (id, uploader_id, kind, url, mime, bytes, width, height) VALUES (?, ?, 'image', ?, 'image/jpeg', 180000, 900, 1200)`,
          [mediaId, uid[who], img],
        );
      }
      rows.push([id, convId, uid[who], img ? 'image' : 'text', text, mediaId, new Date(at)]);
      lastId = id;
      lastAt = new Date(at);
    }
    for (let i = 0; i < rows.length; i += 200) {
      await pool.query('INSERT INTO messages (id, conversation_id, sender_id, kind, body, media_id, created_at) VALUES ?', [
        rows.slice(i, i + 200),
      ]);
    }
    await pool.query('UPDATE conversations SET last_message_id = ?, last_message_at = ? WHERE id = ?', [lastId, lastAt, convId]);
    // Everyone has received the history; judges have read none of it, so unread badges are real.
    const judges = new Set(people.filter((p) => p.demo).map((p) => uid[p.key]));
    await pool.query(
      `UPDATE conversation_members SET last_delivered_message_id = ?, last_read_message_id = IF(user_id IN (?), NULL, ?) WHERE conversation_id = ?`,
      [lastId, [...judges], lastId, convId],
    );
    messageCount += rows.length;
  }

  for (const g of groups) {
    const id = newId(Date.now() - g.days * 86_400_000 - 3_600_000);
    const creator = uid[g.members[0]!]!;
    await pool.query(`INSERT INTO conversations (id, kind, title, created_by) VALUES (?, 'group', ?, ?)`, [id, g.title, creator]);
    await pool.query('INSERT INTO conversation_members (conversation_id, user_id, role, ai_enabled) VALUES ?', [
      g.members.map((m, i) => [id, uid[m], i === 0 ? 'admin' : 'member', g.ai ? 1 : 0]),
    ]);
    await writeHistory(id, g.lines, g.days);
  }

  for (const d of directs) {
    const id = newId(Date.now() - 86_400_000);
    const key = [uid[d.a]!, uid[d.b]!].sort().join(':');
    await pool.query(`INSERT INTO conversations (id, kind, direct_key, created_by) VALUES (?, 'direct', ?, ?)`, [id, key, uid[d.a]]);
    await pool.query('INSERT INTO conversation_members (conversation_id, user_id, role, pinned) VALUES ?, ?', [
      [id, uid[d.a], 'admin', d.pinFor === d.a ? 1 : 0],
      [id, uid[d.b], 'admin', d.pinFor === d.b ? 1 : 0],
    ]);
    await writeHistory(id, d.lines, 1);
  }

  // Derived caches rebuild from MySQL on next read.
  const v = valkey();
  for (const pattern of ['members:*', 'convs:*', 'unread:*', 'chats:*']) {
    let cursor = '0';
    do {
      const [next, found] = await v.scan(cursor, 'MATCH', pattern, 'COUNT', 500);
      cursor = next;
      if (found.length) await v.del(...found);
    } while (cursor !== '0');
  }
  return { users: people.length, messages: messageCount };
}

async function main() {
  loadRootEnv();
  await migrateMysql(() => {});
  const r = await seed({ resetFirst: process.argv.includes('--reset') });
  if (r.users) console.log(`Seeded ${r.users} people and ${r.messages} messages.`);
  await closeDb();
  await closeValkey();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`Seed failed: ${errorMessage(e)}`);
    process.exit(1);
  });
}
