import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { Activity, Team, User, Workout } from '../src/models/index.js';

let mongo: MongoMemoryServer;
const app = createApp();

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
}, 60_000);
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  await Promise.all([Activity.deleteMany({}), Team.deleteMany({}), User.deleteMany({}), Workout.deleteMany({})]);
});

async function createFixtures() {
  const team = await Team.create({ name: 'Octocats', mascot: 'Mona' });
  const user = await User.create({ name: 'Mona', email: 'mona@example.com', team: team._id, fitnessGoal: 'strength' });
  await Workout.create([
    { title: 'Intervals', focus: 'endurance', minutes: 30, difficulty: 'moderate' },
    { title: 'Strength Circuit', focus: 'strength', minutes: 30, difficulty: 'moderate' },
  ]);
  return { user, team };
}

describe('workout suggestion behavior', () => {
  it('falls back to the fitness goal without activities', async () => {
    await createFixtures();
    const response = await request(app).get('/api/workouts/suggestions/mona%40example.com');
    expect(response.status).toBe(200);
    expect(response.body.suggestions).toHaveLength(1);
    expect(response.body.suggestions[0]).toMatchObject({
      title: 'Strength Circuit', focus: 'strength', reason: expect.stringMatching(/strength.*fitness goal/i),
    });
  });

  it('ignores stale, future, unrecognized, and other-user activities', async () => {
    const { user, team } = await createFixtures();
    const otherUser = await User.create({ name: 'Hubot', email: 'hubot@example.com', team: team._id, fitnessGoal: 'endurance' });
    const now = Date.now();
    await Activity.create([
      { user: user._id, team: team._id, type: 'run', minutes: 40, points: 40, occurredAt: new Date(now - 31 * 24 * 60 * 60 * 1000) },
      { user: user._id, team: team._id, type: 'cycle', minutes: 40, points: 40, occurredAt: new Date(now + 24 * 60 * 60 * 1000) },
      { user: user._id, team: team._id, type: 'walk', minutes: 40, points: 40, occurredAt: new Date(now) },
      { user: otherUser._id, team: team._id, type: 'run', minutes: 40, points: 40, occurredAt: new Date(now) },
    ]);
    const response = await request(app).get('/api/workouts/suggestions/mona%40example.com');
    expect(response.status).toBe(200);
    expect(response.body.suggestions).toHaveLength(1);
    expect(response.body.suggestions[0]).toMatchObject({ focus: 'strength', reason: expect.stringMatching(/fitness goal/i) });
  });

  it('uses the latest recognized activity instead of the goal or older activity', async () => {
    const { user, team } = await createFixtures();
    const now = Date.now();
    await Activity.create([
      { user: user._id, team: team._id, type: 'strength', minutes: 50, points: 50, occurredAt: new Date(now - 2000) },
      { user: user._id, team: team._id, type: 'cycle', minutes: 20, points: 20, occurredAt: new Date(now - 1000) },
      { user: user._id, team: team._id, type: 'walk', minutes: 10, points: 10, occurredAt: new Date(now) },
    ]);
    const response = await request(app).get('/api/workouts/suggestions/mona%40example.com');
    expect(response.status).toBe(200);
    expect(response.body.suggestions).toHaveLength(1);
    expect(response.body.suggestions[0]).toMatchObject({ focus: 'endurance', reason: expect.stringMatching(/cycle activity/i) });
  });

  it('returns an empty array rather than an unrelated workout when no focus matches', async () => {
    const { user } = await createFixtures();
    await User.updateOne({ _id: user._id }, { $set: { fitnessGoal: 'mobility' } });
    const response = await request(app).get('/api/workouts/suggestions/mona%40example.com');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ suggestions: [] });
  });

  it('returns an explicit 404 for an unknown user', async () => {
    await createFixtures();
    const response = await request(app).get('/api/workouts/suggestions/nobody%40example.com');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'User not found' });
  });
});
