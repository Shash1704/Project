import {
  addMembers,
  cachedMemberIds,
  clearUnread,
  createGroup,
  ensureDirect,
  getConversation,
  getUnread,
  getUsers,
  invalidateMembership,
  isMember,
  listConversations,
  listMessages,
  listMessagesAfter,
  membership,
  removeMember,
  setMemberFlags,
  setRole,
  updateGroup,
  watermarks,
} from '@pulse/db';
import { tickFor, ulid } from '@pulse/shared';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware';
import { HttpError, forbidden, h, notFound } from '../http-error';
import { io } from '../socket-ref';

export const conversationsRouter = Router();
conversationsRouter.use(requireAuth);

async function assertMember(conversationId: string, userId: string) {
  if (!(await isMember(conversationId, userId))) throw notFound('Conversation not found');
}

async function assertAdmin(conversationId: string, userId: string) {
  const m = await membership(conversationId, userId);
  if (!m) throw notFound('Conversation not found');
  if (m.role !== 'admin') throw forbidden('Only admins can do that');
}

/** Tell every member's sockets to refetch this conversation (and join its room). */
async function notifyChanged(conversationId: string, extraUserIds: string[] = []) {
  const members = await cachedMemberIds(conversationId);
  const s = io();
  if (!s) return;
  for (const u of new Set([...members, ...extraUserIds])) {
    s.in(`user:${u}`).socketsJoin(`conv:${conversationId}`);
    s.to(`user:${u}`).emit('conversation:updated', { id: conversationId });
  }
}

conversationsRouter.get(
  '/',
  h(async (req, res) => {
    const unread = await getUnread(req.userId);
    res.json(await listConversations(req.userId, unread));
  }),
);

conversationsRouter.get(
  '/:id',
  h(async (req, res) => {
    const id = ulid.parse(req.params.id);
    const unread = await getUnread(req.userId);
    const conv = await getConversation(id, req.userId, unread[id] ?? 0);
    if (!conv) throw notFound('Conversation not found');
    res.json(conv);
  }),
);

conversationsRouter.get(
  '/:id/messages',
  h(async (req, res) => {
    const id = ulid.parse(req.params.id);
    const q = z
      .object({
        before: ulid.optional(),
        after: ulid.optional(),
        limit: z.coerce.number().int().min(1).max(200).optional(),
      })
      .parse(req.query);
    await assertMember(id, req.userId);
    const messages = q.after
      ? await listMessagesAfter(id, q.after)
      : await listMessages(id, { beforeId: q.before, limit: q.limit });
    // Ticks for the viewer's own messages, from member watermarks.
    const marks = await watermarks(id);
    res.json(
      messages.map((m) =>
        m.senderId === req.userId ? { ...m, status: tickFor(m.id, m.senderId, marks) } : m,
      ),
    );
  }),
);

/** Member delivered/read watermarks, so the client can update ticks from live receipt events. */
conversationsRouter.get(
  '/:id/receipts',
  h(async (req, res) => {
    const id = ulid.parse(req.params.id);
    await assertMember(id, req.userId);
    res.json(await watermarks(id));
  }),
);

conversationsRouter.post(
  '/direct',
  h(async (req, res) => {
    const { userId } = z.object({ userId: ulid }).parse(req.body);
    if (userId === req.userId) throw new HttpError(400, 'Pick someone else');
    const [other] = await getUsers([userId]);
    if (!other) throw notFound('User not found');
    const id = await ensureDirect(req.userId, userId);
    await invalidateMembership(id, [req.userId, userId]);
    await notifyChanged(id);
    res.status(201).json(await getConversation(id, req.userId));
  }),
);

conversationsRouter.post(
  '/group',
  h(async (req, res) => {
    const body = z
      .object({
        title: z.string().trim().min(1).max(80),
        memberIds: z.array(ulid).min(1).max(255),
        avatarUrl: z.string().url().max(512).nullable().optional(),
      })
      .parse(req.body);
    const found = await getUsers(body.memberIds);
    if (found.length !== new Set(body.memberIds).size)
      throw new HttpError(400, 'Some members were not found');
    const id = await createGroup(req.userId, body.title, body.memberIds, body.avatarUrl ?? null);
    await invalidateMembership(id, [req.userId, ...body.memberIds]);
    await notifyChanged(id);
    res.status(201).json(await getConversation(id, req.userId));
  }),
);

conversationsRouter.patch(
  '/:id',
  h(async (req, res) => {
    const id = ulid.parse(req.params.id);
    const body = z
      .object({
        title: z.string().trim().min(1).max(80).optional(),
        avatarUrl: z.string().url().max(512).nullable().optional(),
      })
      .parse(req.body);
    await assertAdmin(id, req.userId);
    await updateGroup(id, body);
    await notifyChanged(id);
    res.json(await getConversation(id, req.userId));
  }),
);

/** Per-member flags: pin, mute and the per-chat AI opt-in. */
conversationsRouter.patch(
  '/:id/me',
  h(async (req, res) => {
    const id = ulid.parse(req.params.id);
    const flags = z
      .object({
        pinned: z.boolean().optional(),
        muted: z.boolean().optional(),
        aiEnabled: z.boolean().optional(),
      })
      .parse(req.body);
    await assertMember(id, req.userId);
    await setMemberFlags(id, req.userId, flags);
    res.json(await getConversation(id, req.userId));
  }),
);

conversationsRouter.post(
  '/:id/read',
  h(async (req, res) => {
    const id = ulid.parse(req.params.id);
    await assertMember(id, req.userId);
    await clearUnread(req.userId, id);
    res.json({ ok: true });
  }),
);

conversationsRouter.post(
  '/:id/members',
  h(async (req, res) => {
    const id = ulid.parse(req.params.id);
    const { userIds } = z.object({ userIds: z.array(ulid).min(1).max(50) }).parse(req.body);
    await assertAdmin(id, req.userId);
    const conv = await getConversation(id, req.userId);
    if (conv?.kind !== 'group') throw new HttpError(400, 'Only groups have members to add');
    await addMembers(id, userIds);
    await invalidateMembership(id, userIds);
    await notifyChanged(id, userIds);
    res.json(await getConversation(id, req.userId));
  }),
);

conversationsRouter.delete(
  '/:id/members/:userId',
  h(async (req, res) => {
    const id = ulid.parse(req.params.id);
    const target = ulid.parse(req.params.userId);
    // Anyone may leave; only admins remove others.
    if (target !== req.userId) await assertAdmin(id, req.userId);
    else await assertMember(id, req.userId);
    await removeMember(id, target);
    await invalidateMembership(id, [target]);
    io()?.in(`user:${target}`).socketsLeave(`conv:${id}`);
    io()?.to(`user:${target}`).emit('conversation:updated', { id });
    await notifyChanged(id);
    res.json({ ok: true });
  }),
);

conversationsRouter.patch(
  '/:id/members/:userId',
  h(async (req, res) => {
    const id = ulid.parse(req.params.id);
    const target = ulid.parse(req.params.userId);
    const { role } = z.object({ role: z.enum(['admin', 'member']) }).parse(req.body);
    await assertAdmin(id, req.userId);
    await setRole(id, target, role);
    await notifyChanged(id);
    res.json(await getConversation(id, req.userId));
  }),
);
