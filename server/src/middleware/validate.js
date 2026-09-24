import { z } from 'zod';
import { hasCloze } from '../../../shared/cloze.js';
import { PLAN_IDS } from '../../../shared/account.js';
import { TEAM_PLAN_IDS, SEATS } from '../../../shared/teams.js';
export const idSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
export const usernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/, 'Use 3–24 letters, numbers, or underscores');
export const signupSchema = z.object({ username: usernameSchema, name: z.string().trim().min(1).max(60), email: z.email().toLowerCase(), password: z.string().min(10).max(128) });
export const passwordChangeSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(10).max(128) });
export const deleteAccountSchema = z.object({ password: z.string().min(1).max(128), confirm: z.literal('delete my account') });
export const verifyEmailSchema = z.object({ token: z.string().regex(/^[a-f\d]{64}$/i, 'That confirmation link is not valid.') });
export const folderSchema = z.object({ title: z.string().trim().min(1).max(80), description: z.string().max(500).default(''), color: z.enum(['violet', 'blue', 'orange', 'green', 'pink', 'slate']).default('violet'), icon: z.enum(['layers', 'code', 'globe', 'brain', 'book', 'flask', 'terminal', 'palette']).default('layers'), visibility: z.enum(['private', 'global']).default('private'), thumbnail: idSchema.nullable().optional() });
export const projectSchema = z.object({ title: z.string().trim().min(1).max(80), description: z.string().max(500).default(''), visibility: z.enum(['private', 'global']).default('private') });
// The billing fields are shared, because seats and a personal plan are bought through one pipeline.
const billing = z.object({ method: z.enum(['manual', 'razorpay']).optional(), name: z.string().trim().min(1).max(80), email: z.email().toLowerCase(), phone: z.string().trim().min(8).max(20), country: z.string().trim().min(2).max(56), address: z.string().trim().min(6).max(300) });
export const premiumOrderSchema = billing.extend({ plan: z.enum(PLAN_IDS) });
const seats = z.coerce.number().int().min(SEATS.min).max(SEATS.max);
export const seatQuoteSchema = z.object({ plan: z.enum(TEAM_PLAN_IDS), seats });
export const teamOrderSchema = billing.extend({ plan: z.enum(TEAM_PLAN_IDS), seats });
export const teamSchema = z.object({ name: z.string().trim().min(2).max(60), kind: z.enum(['classroom', 'team']).default('classroom'), description: z.string().max(300).default('') });
export const teamInviteSchema = z.object({ role: z.enum(['teacher', 'student']).default('student'), maxUses: z.number().int().min(0).max(500).default(0), expiresInDays: z.number().int().min(1).max(90).optional() });
export const joinCodeSchema = z.object({ code: z.string().trim().min(6).max(16) });
export const assignmentSchema = z.object({ folderId: idSchema, title: z.string().trim().max(80).default(''), instructions: z.string().max(500).default(''), dueAt: z.iso.datetime().nullish() });
const side = z.object({ text: z.string().max(10000).default(''), image: idSchema.nullable().optional() });
const filled = v => v.text.trim() || v.image;
// A cloze card ({{c1::…}} on the front) needs no back: the hidden text is the answer.
export const cardSchema = z.object({ front: side.refine(filled, 'Add text or an image to the front'), back: side, tags: z.array(z.string().trim().toLowerCase().min(1).max(30)).max(10).default([]).transform(v => [...new Set(v)]), hint: z.string().max(1000).default(''), source: z.union([z.literal(''), z.url().refine(v => /^https?:\/\//.test(v), 'Use an http or https URL')]).default('') })
  .refine(v => filled(v.back) || hasCloze(v.front.text), { path: ['back'], message: 'Add text or an image to the back, or use a cloze deletion like {{c1::answer}} on the front' });
export const validate = schema => (req, _res, next) => { try { req.body = schema.parse(req.body); next(); } catch (e) { next(e); } };
