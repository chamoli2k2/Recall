import { z } from 'zod';
export const idSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
export const usernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/, 'Use 3–24 letters, numbers, or underscores');
export const signupSchema = z.object({ username: usernameSchema, name: z.string().trim().min(1).max(60), email: z.email().toLowerCase(), password: z.string().min(10).max(128) });
export const folderSchema = z.object({ title: z.string().trim().min(1).max(80), description: z.string().max(500).default(''), color: z.enum(['violet', 'blue', 'orange', 'green', 'pink', 'slate']).default('violet'), icon: z.enum(['layers', 'code', 'globe', 'brain', 'book', 'flask', 'terminal', 'palette']).default('layers'), visibility: z.enum(['private', 'global']).default('private') });
const side = z.object({ text: z.string().max(10000).default(''), image: idSchema.nullable().optional() }).refine(v => v.text.trim() || v.image, 'Add text or an image to each side');
export const cardSchema = z.object({ front: side, back: side, tags: z.array(z.string().trim().toLowerCase().min(1).max(30)).max(10).default([]).transform(v => [...new Set(v)]), hint: z.string().max(1000).default(''), source: z.union([z.literal(''), z.url().refine(v => /^https?:\/\//.test(v), 'Use an http or https URL')]).default('') });
export const validate = schema => (req, _res, next) => { try { req.body = schema.parse(req.body); next(); } catch (e) { next(e); } };
