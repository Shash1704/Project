import { AiUnavailableError, catchMeUp, type ChatLine } from '@pulse/ai';
import {
  getConversation,
  getUser,
  getUsers,
  listMessages,
  membership,
  rateLimit,
  valkey,
} from '@pulse/db';
import { ulid } from '@pulse/shared';
import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { HttpError, forbidden, h, notFound } from '../http-error';
import { publishAnalytics } from '../kafka';

export const aiRouter = Router();
aiRouter.use(requireAuth);

const WINDOW = 150;
const LANG_NAME: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
  kn: 'Kannada',
  ta: 'Tamil',
};

export interface CatchUpDto {
  summary: string[];
  decisions: { text: string; messageId: string }[];
  deadlines: { text: string; when: string; messageId: string }[];
  mentions: { who: string; text: string; messageId: string }[];
  actionItems: { text: string; messageId: string }[];
  messageCount: number;
  lastMessageId: string;
  cached: boolean;
}

/**
 * Catch Me Up: summary, decisions, deadlines and @mentions over the latest messages, each linked to its
 * source message. Cached in Valkey as summary:{conv}:{last_msg_id}[:lang], so it's computed once per new message.
 */
aiRouter.post(
  '/conversations/:id/catch-up',
  h(async (req, res) => {
    const id = ulid.parse(req.params.id);
    const m = await membership(id, req.userId);
    if (!m) throw notFound('Conversation not found');
    if (!m.aiEnabled) throw forbidden('Turn on AI for this chat first');
    if (!(await rateLimit('ai', req.userId, 20, 600)))
      throw new HttpError(429, 'AI is cooling down, try again in a minute');

    const [conv, me, messages] = await Promise.all([
      getConversation(id, req.userId),
      getUser(req.userId),
      listMessages(id, { limit: WINDOW }),
    ]);
    const text = messages.filter((x) => !x.deletedAt && (x.body || x.kind === 'image'));
    const last = text.at(-1);
    if (!conv || !last) throw new HttpError(400, 'Nothing to catch up on yet');

    const lang = me?.lang ?? 'en';
    const key = `summary:${id}:${last.id}${lang === 'en' ? '' : `:${lang}`}`;
    const v = valkey();
    const hit = await v.get(key);
    if (hit) {
      void v.incr('stats:cache:hit');
      res.json({ ...(JSON.parse(hit) as CatchUpDto), cached: true });
      return;
    }
    void v.incr('stats:cache:miss');

    const names = new Map(conv.members.map((x) => [x.userId, x.name]));
    const missing = [...new Set(text.map((x) => x.senderId))].filter((u) => !names.has(u));
    for (const u of await getUsers(missing)) names.set(u.id, u.name);

    const lines: ChatLine[] = text.map((x, i) => ({
      ref: i,
      author: names.get(x.senderId) ?? 'Someone',
      text: x.body ?? '[photo]',
      at: new Date(x.createdAt).toISOString().slice(5, 16).replace('T', ' '),
    }));

    let raw;
    try {
      raw = await catchMeUp(lines, { title: conv.title, readerLang: LANG_NAME[lang] ?? 'English' });
    } catch (e) {
      if (e instanceof AiUnavailableError) throw new HttpError(503, e.message);
      throw e;
    }
    const idOf = (ref: number) => text[ref]!.id;
    const dto: CatchUpDto = {
      summary: raw.summary,
      decisions: raw.decisions.map((d) => ({ text: d.text, messageId: idOf(d.ref) })),
      deadlines: raw.deadlines.map((d) => ({ text: d.text, when: d.when, messageId: idOf(d.ref) })),
      mentions: raw.mentions.map((d) => ({ who: d.who, text: d.text, messageId: idOf(d.ref) })),
      actionItems: raw.actionItems.map((d) => ({ text: d.text, messageId: idOf(d.ref) })),
      messageCount: text.length,
      lastMessageId: last.id,
      cached: false,
    };
    await v.set(key, JSON.stringify(dto), 'EX', 24 * 3600);
    await v.set(`summary:latest:${id}`, JSON.stringify(dto), 'EX', 7 * 24 * 3600);
    void publishAnalytics({
      type: 'ai_used',
      userId: req.userId,
      conversationId: id,
      meta: { feature: 'catch_up' },
    });
    res.json(dto);
  }),
);
