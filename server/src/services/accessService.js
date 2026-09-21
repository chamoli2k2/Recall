import mongoose from 'mongoose';
import { Folder, Activity, DomainEvent } from '../models/index.js';
import { assert } from '../utils/errors.js';
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
  const role = roleOf(folder, user);
  assert(role, 404, 'Folder not found or access has been removed.');
  assert(level === 'viewer' || role === 'owner' || (level === 'editor' && role === 'editor'), 403, 'You do not have permission to make this change.');
  return folder;
}
export async function mutateFolder(id, user, level, operation) {
  return mongoose.connection.transaction(async session => {
    const folder = await accessFolder(id, user, level, session);
    // All folder-scoped writes touch the ACL document in the same transaction.
    // Revocations and concurrent edits therefore serialize with authorized writes.
    await Folder.updateOne({ _id: folder._id }, { $inc: { writeEpoch: 1 } }, { session });
    return operation(folder, session);
  });
}
export async function recordEvent(folder, actor, action, detail, session, aggregateId = folder.id) {
  await Activity.create([{ folder: folder.id, actor: actor.id, action, detail }], { session });
  await DomainEvent.create([{ type: action, aggregateId, payload: { folderId: folder.id } }], { session });
}
