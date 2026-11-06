import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { Activity, Team, User } from '../src/models/index.js';

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
  await Promise.all([Activity.deleteMany({}), Team.deleteMany({}), User.deleteMany({})]);
});

describe('leaderboard behavior', () => {
  it('returns an empty leaderboard when there are no scored activities', async () => {
    await Team.create({ name: 'Octocats', mascot: 'Mona' });
    const response = await request(app).get('/api/leaderboard');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ leaderboard: [] });
  });

  it('sums points across members and orders tied totals by team name', async () => {
    const robocats = await Team.create({ name: 'Robocats', mascot: 'Hubot' });
    const octocats = await Team.create({ name: 'Octocats', mascot: 'Mona' });
    const mona = await User.create({ name: 'Mona', email: 'mona@example.com', team: octocats._id, fitnessGoal: 'endurance' });
    const copilot = await User.create({ name: 'Copilot', email: 'copilot@example.com', team: octocats._id, fitnessGoal: 'endurance' });
    const hubot = await User.create({ name: 'Hubot', email: 'hubot@example.com', team: robocats._id, fitnessGoal: 'strength' });
    await Activity.create([
      { user: hubot._id, team: robocats._id, type: 'strength', minutes: 15, points: 30, occurredAt: new Date() },
      { user: mona._id, team: octocats._id, type: 'run', minutes: 5, points: 10, occurredAt: new Date() },
      { user: copilot._id, team: octocats._id, type: 'cycle', minutes: 10, points: 20, occurredAt: new Date() },
    ]);
    const expected = {
      leaderboard: [
        { teamName: 'Octocats', totalPoints: 30, rank: 1 },
        { teamName: 'Robocats', totalPoints: 30, rank: 2 },
      ],
    };
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await request(app).get('/api/leaderboard');
      expect(response.status).toBe(200);
      expect(response.body).toEqual(expected);
    }
  });
});
