import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const ref = (name, required = true) => ({ type: Schema.Types.ObjectId, ref: name, required });
const options = { timestamps: true, toJSON: { transform: (_doc, ret) => { ret.id = ret._id.toString(); delete ret._id; delete ret.__v; return ret; } } };
const user = new Schema({ username: { type: String, required: true, unique: true, lowercase: true }, email: { type: String, required: true, unique: true, lowercase: true, select: false }, passwordHash: { type: String, required: true, select: false }, name: { type: String, required: true }, bio: { type: String, default: '' }, dailyGoal: { type: Number, default: 20 }, desiredRetention: { type: Number, default: 0.9, min: 0.7, max: 0.97 }, savedFolders: [ref('Folder')] }, options);
const session = new Schema({ tokenHash: { type: String, required: true, unique: true }, user: ref('User'), expiresAt: { type: Date, required: true, expires: 0 } }, options);
const folder = new Schema({ title: { type: String, required: true }, description: { type: String, default: '' }, color: { type: String, default: 'violet' }, icon: { type: String, default: 'layers' }, visibility: { type: String, enum: ['private', 'global'], default: 'private' }, owner: ref('User'), members: [{ user: ref('User'), role: { type: String, enum: ['viewer', 'editor'], required: true }, _id: false }], version: { type: Number, default: 0 }, writeEpoch: { type: Number, default: 0 }, archived: { type: Boolean, default: false }, copiedFrom: ref('Folder', false), originalCreator: { type: String, default: '' } }, options);
folder.index({ owner: 1, updatedAt: -1 }); folder.index({ 'members.user': 1 }); folder.index({ visibility: 1, archived: 1 });
const side = { text: { type: String, default: '' }, image: ref('Media', false) };
const card = new Schema({ folder: ref('Folder'), front: side, back: side, tags: [String], hint: { type: String, default: '' }, source: { type: String, default: '' }, version: { type: Number, default: 0 }, createdBy: ref('User'), updatedBy: ref('User') }, options);
card.index({ folder: 1, createdAt: 1 }); card.index({ folder: 1, tags: 1 });
const media = new Schema({ folder: ref('Folder'), uploadedBy: ref('User'), data: { type: Buffer, required: true, select: false }, contentType: { type: String, default: 'image/webp' }, name: String }, options);
// FSRS memory state (stability, difficulty, state) plus the legacy SM-2 fields (interval, repetitions, ease) kept for compatibility.
const progress = new Schema({ user: ref('User'), card: ref('Card'), repetitions: { type: Number, default: 0 }, interval: { type: Number, default: 0 }, ease: { type: Number, default: 2.5 }, stability: { type: Number, default: 0 }, difficulty: { type: Number, default: 0 }, state: { type: String, enum: ['new', 'learning', 'review', 'relearning'], default: 'new' }, reps: { type: Number, default: 0 }, lapses: { type: Number, default: 0 }, elapsedDays: { type: Number, default: 0 }, scheduledDays: { type: Number, default: 0 }, dueAt: { type: Date, default: Date.now }, lastReviewedAt: Date, version: { type: Number, default: 0 }, bookmarked: { type: Boolean, default: false } }, options);
progress.index({ user: 1, card: 1 }, { unique: true }); progress.index({ user: 1, dueAt: 1 });
const review = new Schema({ user: ref('User'), card: ref('Card'), folder: ref('Folder', false), requestId: { type: String, required: true }, rating: { type: String, enum: ['again', 'hard', 'good', 'easy'] }, elapsedDays: Number, result: Schema.Types.Mixed }, options);
review.index({ user: 1, requestId: 1 }, { unique: true }); review.index({ user: 1, createdAt: -1 });
const activity = new Schema({ folder: ref('Folder'), actor: ref('User'), action: String, detail: String }, options);
activity.index({ folder: 1, createdAt: -1 });
const revision = new Schema({ card: ref('Card'), folder: ref('Folder'), editor: ref('User'), version: Number, snapshot: Schema.Types.Mixed }, options);
revision.index({ card: 1, version: 1 }, { unique: true });
// Durable domain events are the future integration boundary. No AI calls or indexing run in v1.
const event = new Schema({ type: String, aggregateId: String, payload: Schema.Types.Mixed, processedAt: Date }, options);
event.index({ processedAt: 1, createdAt: 1 });
// Persisted Yjs CRDT state for live co-editing. The Card document remains the authoritative, versioned text.
const cardDoc = new Schema({ card: { ...ref('Card'), unique: true }, state: { type: Buffer, required: true, select: false } }, options);
export const User = model('User', user), Session = model('Session', session), Folder = model('Folder', folder), Card = model('Card', card), Media = model('Media', media), Progress = model('Progress', progress), Review = model('Review', review), Activity = model('Activity', activity), Revision = model('Revision', revision), DomainEvent = model('DomainEvent', event), CardDoc = model('CardDoc', cardDoc);
export const allModels = [User, Session, Folder, Card, Media, Progress, Review, Activity, Revision, DomainEvent, CardDoc];
