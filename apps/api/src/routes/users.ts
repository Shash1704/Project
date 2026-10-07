import { getUser, searchUsers, updateUser } from '@pulse/db';
import { LANGS } from '@pulse/shared';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware';
import { h } from '../http-error';

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.get(
  '/me',
  h(async (req, res) => {
    res.json(await getUser(req.userId));
  }),
);

usersRouter.patch(
  '/me',
  h(async (req, res) => {
    const patch = z
      .object({
        name: z.string().trim().min(1).max(80).optional(),
        about: z.string().trim().max(160).nullable().optional(),
        lang: z.enum(LANGS).optional(),
        avatarUrl: z.string().url().max(512).nullable().optional(),
      })
      .parse(req.body);
    await updateUser(req.userId, patch);
    res.json(await getUser(req.userId));
  }),
);

usersRouter.get(
  '/search',
  h(async (req, res) => {
    const { q } = z.object({ q: z.string().trim().max(80).default('') }).parse(req.query);
    res.json(await searchUsers(q, req.userId));
  }),
);
