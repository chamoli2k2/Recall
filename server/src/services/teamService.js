import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { Team, TeamMember, TeamInvite, Assignment, Folder, Card, Progress, Review } from '../models/index.js';
import { accessTeam } from './teamAccess.js';
import { notify } from './notificationService.js';
import { TEAM_KINDS, teamPlanById, teamActive, teamDaysLeft, seatsLeft, roleLabel } from '../../../shared/teams.js';
import { assert, badRequest, notFound } from '../utils/errors.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1, because these get read aloud
const newCode = () => Array.from(crypto.randomBytes(8)).map(b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
const hashCode = code => crypto.createHash('sha256').update(String(code).trim().toUpperCase()).digest('hex');
const personSelect = 'name username';

export const presentTeam = (team, membership) => ({
  id: team.id, name: team.name, kind: team.kind, description: team.description,
  plan: team.plan || '', planLabel: teamPlanById(team.plan)?.label || '',
  seats: team.seats, memberCount: team.memberCount, seatsLeft: seatsLeft(team),
  expiresAt: team.expiresAt || null, daysLeft: teamDaysLeft(team), active: teamActive(team),
  version: team.version, createdAt: team.createdAt,
  role: membership?.role || null, roleLabel: membership ? roleLabel(team.kind, membership.role) : null,
});

/**
 * A team starts unpaid with no seats. Nothing can be invited into it until seats are bought, which
 * keeps the seat count and the money in step without a trial state to expire.
 */
export async function createTeam(user, body) {
  assert(TEAM_KINDS.some(k => k.id === body.kind), 400, 'Choose a classroom or a team.', 'UNKNOWN_KIND');
  const mine = await TeamMember.countDocuments({ user: user.id, role: 'owner' });
  assert(mine < 10, 400, 'You already own ten teams.', 'TOO_MANY_TEAMS');
  const team = await mongoose.connection.transaction(async session => {
    const [created] = await Team.create([{ name: body.name, kind: body.kind, description: body.description || '', owner: user.id, memberCount: 1 }], { session });
    await TeamMember.create([{ team: created.id, user: user.id, role: 'owner' }], { session });
    return created;
  });
  return presentTeam(team, { role: 'owner' });
}

export async function myTeams(user) {
  const memberships = await TeamMember.find({ user: user.id }).populate('team');
  return memberships
    .filter(m => m.team && !m.team.archived)
    .sort((a, b) => b.team.updatedAt - a.team.updatedAt)
    .map(m => presentTeam(m.team, m));
}

export async function teamDetail(user, id) {
  const { team, membership } = await accessTeam(id, user);
  const [members, folders, assignments] = await Promise.all([
    TeamMember.find({ team: team.id }).populate('user', personSelect).sort({ createdAt: 1 }),
    Folder.find({ team: team.id, archived: false }).select('title color icon updatedAt').sort({ updatedAt: -1 }).limit(100),
    Assignment.find({ team: team.id, archived: false }).populate('folder', 'title color icon').sort({ dueAt: 1, createdAt: -1 }).limit(60),
  ]);
  const counts = await Card.aggregate([{ $match: { folder: { $in: folders.map(f => f._id) } } }, { $group: { _id: '$folder', n: { $sum: 1 } } }]);
  const cardCount = new Map(counts.map(c => [String(c._id), c.n]));
  return {
    team: presentTeam(team, membership),
    members: members.map(m => ({ id: m.user?.id, name: m.user?.name, username: m.user?.username, role: m.role, roleLabel: roleLabel(team.kind, m.role), joinedAt: m.createdAt })),
    folders: folders.map(f => ({ id: f.id, title: f.title, color: f.color, icon: f.icon, updatedAt: f.updatedAt, cardCount: cardCount.get(f.id) || 0 })),
    assignments: assignments.map(presentAssignment),
  };
}

export async function updateTeam(user, id, body) {
  const { team, membership } = await accessTeam(id, user, 'owner');
  assert(team.version === body.version, 409, 'This team changed. Refresh and try again.', 'VERSION_CONFLICT');
  Object.assign(team, { name: body.name, description: body.description || '' });
  team.version += 1;
  await team.save();
  return presentTeam(team, membership);
}

/** Archiving keeps the folders and the study history; it only takes the team out of everyone's list. */
export async function archiveTeam(user, id) {
  const { team } = await accessTeam(id, user, 'owner');
  team.archived = true;
  await team.save();
  return { archived: true };
}

// --- Roster ---------------------------------------------------------------

/**
 * The plaintext code is returned exactly once and only the hash is stored, so a leaked database
 * cannot be used to walk into a classroom.
 */
export async function createInvite(user, id, body) {
  const { team } = await accessTeam(id, user, 'teacher');
  assert(teamActive(team), 402, 'Buy seats before inviting people.', 'TEAM_INACTIVE');
  const open = await TeamInvite.countDocuments({ team: team.id, revokedAt: null });
  assert(open < 20, 400, 'Revoke an unused invite link first.', 'TOO_MANY_INVITES');
  const code = newCode();
  const invite = await TeamInvite.create({
    team: team.id, codeHash: hashCode(code), role: body.role || 'student', createdBy: user.id,
    maxUses: body.maxUses || 0,
    expiresAt: body.expiresInDays ? new Date(Date.now() + body.expiresInDays * 86400000) : null,
  });
  return { invite: presentInvite(invite, team), code };
}

const presentInvite = (invite, team) => ({
  id: invite.id, role: invite.role, roleLabel: roleLabel(team?.kind, invite.role),
  uses: invite.uses, maxUses: invite.maxUses, expiresAt: invite.expiresAt || null, createdAt: invite.createdAt,
});

export async function listInvites(user, id) {
  const { team } = await accessTeam(id, user, 'teacher');
  const invites = await TeamInvite.find({ team: team.id, revokedAt: null }).sort({ createdAt: -1 }).limit(20);
  return { invites: invites.map(i => presentInvite(i, team)) };
}

export async function revokeInvite(user, id, inviteId) {
  const { team } = await accessTeam(id, user, 'teacher');
  const invite = await TeamInvite.findOneAndUpdate({ _id: inviteId, team: team.id, revokedAt: null }, { $set: { revokedAt: new Date() } });
  assert(invite, 404, 'Invite not found.');
  return { revoked: true };
}

/** A code only says which team; it never reveals anything about it until the seat is actually taken. */
export async function previewCode(code) {
  const invite = await TeamInvite.findOne({ codeHash: hashCode(code), revokedAt: null }).populate('team', 'name kind seats memberCount plan expiresAt archived');
  if (!invite || !invite.team || invite.team.archived) throw notFound('That code does not match an open invite.', 'BAD_CODE');
  return { team: { name: invite.team.name, kind: invite.team.kind }, role: invite.role, roleLabel: roleLabel(invite.team.kind, invite.role) };
}

/**
 * Taking a seat is one transaction: the membership and the counter that guards the seat cap move
 * together, and the counter is only incremented while it is still below the paid seat count. Two
 * students racing for the last seat therefore cannot both get in.
 */
export async function joinWithCode(user, code) {
  const hash = hashCode(code);
  const result = await mongoose.connection.transaction(async session => {
    const invite = await TeamInvite.findOne({ codeHash: hash, revokedAt: null }).session(session);
    if (!invite) throw notFound('That code does not match an open invite.', 'BAD_CODE');
    if (invite.expiresAt && invite.expiresAt.getTime() <= Date.now()) throw badRequest('That invite link has expired.', 'INVITE_EXPIRED');
    if (invite.maxUses && invite.uses >= invite.maxUses) throw badRequest('That invite link has been used up.', 'INVITE_USED_UP');

    const team = await Team.findById(invite.team).session(session);
    if (!team || team.archived) throw notFound('That code does not match an open invite.', 'BAD_CODE');
    if (!teamActive(team)) throw badRequest('That team is not paid up right now. Ask the owner to renew.', 'TEAM_INACTIVE');
    if (await TeamMember.findOne({ team: team.id, user: user.id }).session(session)) throw badRequest('You are already in this team.', 'ALREADY_MEMBER');

    const claimed = await Team.findOneAndUpdate(
      { _id: team.id, $expr: { $lt: ['$memberCount', '$seats'] } },
      { $inc: { memberCount: 1 } },
      { new: true, session },
    );
    if (!claimed) throw badRequest('Every seat in this team is taken. Ask the owner to add one.', 'NO_SEATS');

    await TeamMember.create([{ team: team.id, user: user.id, role: invite.role, invitedBy: invite.createdBy }], { session });
    await TeamInvite.updateOne({ _id: invite.id }, { $inc: { uses: 1 } }, { session });
    return { team: claimed, role: invite.role, owner: team.owner };
  });
  await notify(result.owner, 'team.joined', { actor: user, data: { teamId: String(result.team.id), teamName: result.team.name, role: result.role } });
  return presentTeam(result.team, { role: result.role });
}

export async function setRole(actor, id, userId, role) {
  const { team } = await accessTeam(id, actor, 'owner');
  assert(['teacher', 'student'].includes(role), 400, 'Pick teacher or student.', 'UNKNOWN_ROLE');
  assert(String(userId) !== String(actor.id), 400, 'You cannot change your own role.', 'SELF_ROLE');
  const membership = await TeamMember.findOneAndUpdate({ team: team.id, user: userId, role: { $ne: 'owner' } }, { $set: { role } }, { new: true });
  assert(membership, 404, 'That person is not in this team.');
  return { role: membership.role };
}

/** Removing someone frees their seat immediately, so the owner is never billed for an empty chair. */
export async function removeMember(actor, id, userId) {
  const { team, membership: mine } = await accessTeam(id, actor, 'member');
  const self = String(userId) === String(actor.id);
  assert(self || mine.role === 'owner' || mine.role === 'teacher', 403, 'Only a teacher can remove someone.');
  assert(!(self && mine.role === 'owner'), 400, 'The owner cannot leave. Archive the team instead.', 'OWNER_CANNOT_LEAVE');
  await mongoose.connection.transaction(async session => {
    const gone = await TeamMember.findOneAndDelete({ team: team.id, user: userId, role: { $ne: 'owner' } }).session(session);
    assert(gone, 404, 'That person is not in this team.');
    await Team.updateOne({ _id: team.id, memberCount: { $gt: 1 } }, { $inc: { memberCount: -1 } }, { session });
  });
  if (!self) await notify(userId, 'team.removed', { actor, data: { teamName: team.name } });
  return { removed: true };
}

// --- Folders and assignments ---------------------------------------------

/** A team folder belongs to the team, so the roster decides who can open it, not an invite list. */
export async function createTeamFolder(user, id, body) {
  const { team } = await accessTeam(id, user, 'teacher');
  assert(teamActive(team), 402, 'Buy seats before adding team folders.', 'TEAM_INACTIVE');
  const { thumbnail, ...rest } = body;
  const folder = await Folder.create({ ...rest, visibility: 'private', owner: user.id, team: team.id });
  return { folder: { id: folder.id, title: folder.title, color: folder.color, icon: folder.icon, cardCount: 0, updatedAt: folder.updatedAt } };
}

const presentAssignment = a => ({
  id: a.id, title: a.title, instructions: a.instructions, dueAt: a.dueAt || null,
  folder: a.folder ? { id: a.folder.id ?? String(a.folder), title: a.folder.title, color: a.folder.color, icon: a.folder.icon } : null,
  createdAt: a.createdAt,
});

export async function createAssignment(user, id, body) {
  const { team } = await accessTeam(id, user, 'teacher');
  const folder = await Folder.findOne({ _id: body.folderId, team: team.id, archived: false });
  assert(folder, 404, 'Pick one of this team\'s folders.', 'NOT_TEAM_FOLDER');
  const open = await Assignment.countDocuments({ team: team.id, archived: false });
  assert(open < 100, 400, 'Archive an assignment first.', 'TOO_MANY_ASSIGNMENTS');
  const assignment = await Assignment.create({
    team: team.id, folder: folder.id, createdBy: user.id,
    title: body.title || folder.title, instructions: body.instructions || '',
    dueAt: body.dueAt ? new Date(body.dueAt) : null,
  });
  await assignment.populate('folder', 'title color icon');
  const students = await TeamMember.find({ team: team.id, user: { $ne: user.id } }).select('user');
  await Promise.all(students.map(s => notify(s.user, 'team.assignment', { actor: user, data: { teamId: team.id, teamName: team.name, folderId: folder.id, title: assignment.title, dueAt: assignment.dueAt } })));
  return { assignment: presentAssignment(assignment) };
}

export async function archiveAssignment(user, id, assignmentId) {
  const { team } = await accessTeam(id, user, 'teacher');
  const gone = await Assignment.findOneAndUpdate({ _id: assignmentId, team: team.id }, { $set: { archived: true } });
  assert(gone, 404, 'Assignment not found.');
  return { archived: true };
}

/**
 * The teacher's view of the class. Everyone keeps their own study progress, so this reads the same
 * per-user Progress and Review rows the learner sees, and it shadow-copies nothing.
 */
export async function teamProgress(user, id, folderId) {
  const { team } = await accessTeam(id, user, 'progress');
  const folders = await Folder.find({ team: team.id, archived: false }).select('title');
  const scope = folderId ? folders.filter(f => f.id === String(folderId)) : folders;
  assert(!folderId || scope.length, 404, 'Pick one of this team\'s folders.', 'NOT_TEAM_FOLDER');

  const cards = await Card.find({ folder: { $in: scope.map(f => f._id) } }).select('_id');
  const cardIds = cards.map(c => c._id);
  const members = await TeamMember.find({ team: team.id }).populate('user', personSelect).sort({ createdAt: 1 });
  const userIds = members.map(m => m.user?._id).filter(Boolean);

  const [states, recent] = cardIds.length && userIds.length ? await Promise.all([
    Progress.aggregate([
      { $match: { user: { $in: userIds }, card: { $in: cardIds } } },
      { $group: { _id: '$user', studied: { $sum: 1 }, due: { $sum: { $cond: [{ $lte: ['$dueAt', new Date()] }, 1, 0] } }, lapses: { $sum: '$lapses' }, reps: { $sum: '$reps' }, lastReviewedAt: { $max: '$lastReviewedAt' } } },
    ]),
    Review.aggregate([
      { $match: { user: { $in: userIds }, card: { $in: cardIds } } },
      { $group: { _id: '$user', total: { $sum: 1 }, good: { $sum: { $cond: [{ $in: ['$rating', ['good', 'easy']] }, 1, 0] } } } },
    ]),
  ]) : [[], []];

  const byUser = new Map(states.map(s => [String(s._id), s]));
  const grades = new Map(recent.map(r => [String(r._id), r]));
  const total = cardIds.length;
  return {
    team: presentTeam(team, { role: 'teacher' }),
    folders: folders.map(f => ({ id: f.id, title: f.title })),
    totalCards: total,
    rows: members.map(m => {
      const s = byUser.get(String(m.user?._id)) || {};
      const g = grades.get(String(m.user?._id)) || {};
      return {
        id: m.user?.id, name: m.user?.name, username: m.user?.username,
        role: m.role, roleLabel: roleLabel(team.kind, m.role),
        studied: s.studied || 0, coverage: total ? Math.round(((s.studied || 0) / total) * 100) : 0,
        due: s.due || 0, reviews: g.total || 0,
        accuracy: g.total ? Math.round((g.good / g.total) * 100) : null,
        lapses: s.lapses || 0, lastReviewedAt: s.lastReviewedAt || null,
      };
    }),
  };
}