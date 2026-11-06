import { isObjectIdOrHexString } from 'mongoose';
import { Activity, Team, User, Workout } from '../models/index.js';

export async function listActivities() {
  return Activity.find().lean();
}

export async function createActivity(input: unknown) {
  if (
    !input || typeof input !== 'object' || Array.isArray(input) ||
    !('userId' in input) || !('teamId' in input) || !('type' in input) || !('minutes' in input)
  ) {
    throw Object.assign(new Error('userId, teamId, type, and minutes are required'), { status: 400 });
  }
  const { userId, teamId, type, minutes } = input;
  if (
    typeof userId !== 'string' || !isObjectIdOrHexString(userId) ||
    typeof teamId !== 'string' || !isObjectIdOrHexString(teamId)
  ) {
    throw Object.assign(new Error('userId and teamId must be valid record IDs'), { status: 400 });
  }
  if (typeof type !== 'string' || !type.trim() || typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) {
    throw Object.assign(new Error('type must be non-empty and minutes must be a positive finite number'), { status: 400 });
  }
  const [user, team] = await Promise.all([User.exists({ _id: userId }), Team.exists({ _id: teamId })]);
  if (!user || !team) {
    throw Object.assign(new Error('User or team not found'), { status: 404 });
  }
  return Activity.create({ user: userId, team: teamId, type, minutes, points: minutes, occurredAt: new Date() });
}

export async function listTeams() {
  return Team.find().lean();
}

export async function createTeam(input: unknown) {
  if (
    !input || typeof input !== 'object' || Array.isArray(input) ||
    !('name' in input) || !('mascot' in input) ||
    typeof input.name !== 'string' || !input.name.trim() ||
    typeof input.mascot !== 'string' || !input.mascot.trim()
  ) {
    throw Object.assign(new Error('name and mascot must be non-empty strings'), { status: 400 });
  }
  const members = 'members' in input ? input.members : [];
  if (
    !Array.isArray(members) ||
    !members.every((member: unknown): member is string => typeof member === 'string' && isObjectIdOrHexString(member))
  ) {
    throw Object.assign(new Error('members must be an array of valid user IDs'), { status: 400 });
  }
  const uniqueMembers = [...new Set(members.map((member) => member.toLowerCase()))];
  if (uniqueMembers.length && await User.countDocuments({ _id: { $in: uniqueMembers } }) !== uniqueMembers.length) {
    throw Object.assign(new Error('One or more members were not found'), { status: 404 });
  }
  return Team.create({ name: input.name, mascot: input.mascot, members });
}

export async function getLeaderboard() {
  const entries = await Activity.aggregate<{ teamName: string; totalPoints: number }>([
    { $group: { _id: '$team', totalPoints: { $sum: '$points' } } },
    { $lookup: { from: Team.collection.name, localField: '_id', foreignField: '_id', as: 'team' } },
    { $unwind: '$team' },
    { $sort: { totalPoints: -1, 'team.name': 1, _id: 1 } },
    { $project: { _id: 0, teamName: '$team.name', totalPoints: 1 } },
  ]);
  return entries.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export async function suggestWorkouts(userEmail: string) {
  const user = await User.findOne({ email: userEmail }).lean();
  if (!user) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }
  const now = new Date();
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const activities = await Activity.find({ user: user._id, occurredAt: { $gte: since, $lte: now } })
    .sort({ occurredAt: -1, _id: -1 })
    .select('type')
    .lean();
  const recent = activities.find(({ type }) => type === 'run' || type === 'cycle' || type === 'strength');
  const focus = recent ? (recent.type === 'strength' ? 'strength' : 'endurance') : user.fitnessGoal;
  const reason = recent
    ? `Recommended for ${focus} based on your recent ${recent.type} activity.`
    : `Recommended for your ${focus} fitness goal.`;
  const workouts = await Workout.find({ focus }).sort({ title: 1, _id: 1 }).lean();
  return workouts.map((workout) => ({ ...workout, reason }));
}

export { User };
