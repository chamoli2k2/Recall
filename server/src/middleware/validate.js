import { z } from 'zod';
import { hasCloze } from '../../../shared/cloze.js';
import { PLAN_IDS } from '../../../shared/account.js';
export const idSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
export const usernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/, 'Use 3–24 letters, numbers, or underscores');
export const signupSchema = z.object({ username: usernameSchema, name: z.string().trim().min(1).max(60), email: z.email().toLowerCase(), password: z.string().min(10).max(128) });
export const folderSchema = z.object({ title: z.string().trim().min(1).max(80), description: z.string().max(500).default(''), color: z.enum(['violet', 'blue', 'orange', 'green', 'pink', 'slate']).default('violet'), icon: z.enum(['layers', 'code', 'globe', 'brain', 'book', 'flask', 'terminal', 'palette']).default('layers'), visibility: z.enum(['private', 'global']).default('private'), thumbnail: idSchema.nullable().optional() });
export const projectSchema = z.object({ title: z.string().trim().min(1).max(80), description: z.string().max(500).default(''), visibility: z.enum(['private', 'global']).default('private') });
export const premiumOrderSchema = z.object({ plan: z.enum(PLAN_IDS), method: z.enum(['manual', 'razorpay']).optional(), name: z.string().trim().min(1).max(80), email: z.email().toLowerCase(), phone: z.string().trim().min(8).max(20), country: z.string().trim().min(2).max(56), address: z.string().trim().min(6).max(300) });
const side = z.object({ text: z.string().max(10000).default(''), image: idSchema.nullable().optional() });
const filled = v => v.text.trim() || v.image;
// A cloze card ({{c1::…}} on the front) needs no back: the hidden text is the answer.
export const cardSchema = z.object({ front: side.refine(filled, 'Add text or an image to the front'), back: side, tags: z.array(z.string().trim().toLowerCase().min(1).max(30)).max(10).default([]).transform(v => [...new Set(v)]), hint: z.string().max(1000).default(''), source: z.union([z.literal(''), z.url().refine(v => /^https?:\/\//.test(v), 'Use an http or https URL')]).default('') })
  .refine(v => filled(v.back) || hasCloze(v.front.text), { path: ['back'], message: 'Add text or an image to the back, or use a cloze deletion like {{c1::answer}} on the front' });
export const validate = schema => (req, _res, next) => { try { req.body = schema.parse(req.body); next(); } catch (e) { next(e); } };
