import mongoose from 'mongoose';
import { Folder, Activity, DomainEvent } from '../models/index.js';
import { assert } from '../utils/errors.js';
import { teamFolderRole } from './teamAccess.js';
import { beginCollecting, queueEvent, flushEvents } from '../realtime/bus.js';
export function roleOf(folder, user) {
  if (!user) return folder.visibility === 'global' ? 'viewer' : null;
  if (String(folder.owner._id ?? folder.owner) === String(user._id ?? user)) return 'owner';
  const member = folder.members.find(m => String(m.user._id ?? m.user) === String(user._id ?? user));
  return member?.role ?? (folder.visibility === 'global' ? 'viewer' : null);
}
export async function accessFolder(id, user, level = 'viewer', session) {
  assert(mongoose.isValidObjectId(id), 404, 'Folder not found.');
  const folder = await Folder.findById(id).session(session ?? null);
  assert(folder, 404, 'Folder not found.');
  // A team folder grants access through the roster, so only fall back to that when nothing else fits.
  const role = roleOf(folder, user) ?? (folder.team ? await teamFolderRole(folder, user, session) : null);
  assert(role, 404, 'Folder not found or access has been removed.');
  assert(level === 'viewer' || role === 'owner' || (level === 'editor' && role === 'editor'), 403, 'You do not have permission to make this change.');
  return folder;
}
export async function mutateFolder(id, user, level, operation) {
  let current;
  const result = await mongoose.connection.transaction(async session => {
    current = session; beginCollecting(session); // reset per attempt so a retried transaction never double-publishes
    const folder = await accessFolder(id, user, level, session);
    // All folder-scoped writes touch the ACL document in the same transaction.
    // Revocations and concurrent edits therefore serialize with authorized writes.
    await Folder.updateOne({ _id: folder._id }, { $inc: { writeEpoch: 1 } }, { session });
    return operation(folder, session);
  });
  if (current) flushEvents(current); // committed: now tell live subscribers
  return result;
}
export async function recordEvent(folder, actor, action, detail, session, aggregateId = folder.id, extra = {}) {
  await Activity.create([{ folder: folder.id, actor: actor.id, action, detail }], { session });
  await DomainEvent.create([{ type: action, aggregateId, payload: { folderId: folder.id } }], { session });
  queueEvent(session, { type: action, folderId: String(folder.id), aggregateId: String(aggregateId), detail, actor: { id: String(actor.id), name: actor.name, username: actor.username }, at: new Date().toISOString(), ...extra });
}
