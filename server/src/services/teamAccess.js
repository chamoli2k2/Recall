import mongoose from 'mongoose';
import { Team, TeamMember } from '../models/index.js';
import { hasPremium } from '../../../shared/account.js';
import { teamActive, seatEntitles, canManageTeam, canManageRoster, canSeeProgress } from '../../../shared/teams.js';
import { assert } from '../utils/errors.js';

const idOf = value => value?._id ?? value ?? null;
export const membershipOf = (teamId, user, session) =>
  user ? TeamMember.findOne({ team: idOf(teamId), user: user._id ?? user.id }).session(session ?? null) : Promise.resolve(null);
/** Teams a user holds a seat in, used to fold team folders into their library. */
export const teamIdsFor = async user => user ? (await TeamMember.find({ user: user._id ?? user.id }).select('team')).map(m => m.team) : [];

/**
 * Inside a team's own folders a teacher edits and a student reads, but only while the team is paid
 * up. Letting the lapse close access here means nobody has to remember to revoke anything.
 */
export async function teamFolderRole(folder, user, session) {
  if (!folder?.team || !user) return null;
  const [team, membership] = await Promise.all([
    Team.findById(idOf(folder.team)).session(session ?? null),
    membershipOf(folder.team, user, session),
  ]);
  if (!membership || !teamActive(team)) return null;
  return membership.role === 'student' ? 'viewer' : 'editor';
}

const NEEDS = { member: () => true, teacher: canManageRoster, progress: canSeeProgress, owner: canManageTeam };

/** A team you are not in is indistinguishable from one that does not exist. */
export async function accessTeam(id, user, need = 'member', session) {
  assert(mongoose.isValidObjectId(id), 404, 'Team not found.');
  const team = await Team.findById(id).session(session ?? null);
  assert(team && !team.archived, 404, 'Team not found.');
  const membership = await membershipOf(team.id, user, session);
  assert(membership, 404, 'Team not found.');
  assert(NEEDS[need](membership.role), 403, need === 'owner' ? 'Only the team owner can do that.' : 'Only a teacher can do that.');
  return { team, membership };
}

/**
 * The one question every Premium gate now asks. A personal subscription unlocks everything you own;
 * a seat unlocks the same toolkit but only within the team's folders, so a student's own library is
 * untouched by joining or leaving a class.
 */
export async function entitledOnFolder(user, folder) {
  if (hasPremium(user)) return true;
  if (!folder?.team || !user) return false;
  const [team, membership] = await Promise.all([Team.findById(idOf(folder.team)), membershipOf(folder.team, user)]);
  return seatEntitles(team, membership);
}

export async function requireFolderPremium(user, folder, what = 'This') {
  assert(await entitledOnFolder(user, folder), 402,
    `${what} is a Premium feature. Upgrade, or open it in a team you hold a seat in.`, 'PREMIUM_REQUIRED');
}
