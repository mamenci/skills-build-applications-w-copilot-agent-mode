import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { Activity, Team, User } from '../src/models/index.js';
import { createActivity } from '../src/services/octofitService.js';

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

describe('activity creation validation', () => {
  it('rejects malformed bodies and invalid values before writing', async () => {
    const valid = {
      userId: new mongoose.Types.ObjectId().toString(),
      teamId: new mongoose.Types.ObjectId().toString(),
      type: 'run',
      minutes: 30,
    };
    for (const input of [
      null, [], {}, { ...valid, userId: 123 }, { ...valid, teamId: 'not-an-id' },
      { ...valid, type: '' }, { ...valid, type: '   ' }, { ...valid, type: 123 },
      ...[0, -1, '30', null, Infinity, NaN].map((minutes) => ({ ...valid, minutes })),
    ]) {
      await expect(createActivity(input)).rejects.toMatchObject({ status: 400 });
    }
    expect(await Activity.countDocuments()).toBe(0);
  });

  it('rejects each missing reference without creating users or teams', async () => {
    const team = await Team.create({ name: 'Octocats', mascot: 'Mona' });
    const user = await User.create({ name: 'Mona', email: 'mona@example.com', team: team._id, fitnessGoal: 'endurance' });
    for (const references of [
      { userId: new mongoose.Types.ObjectId().toString(), teamId: team._id.toString() },
      { userId: user._id.toString(), teamId: new mongoose.Types.ObjectId().toString() },
    ]) {
      const response = await request(app).post('/api/activities').send({ ...references, type: 'run', minutes: 30 });
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User or team not found');
    }
    expect(await Activity.countDocuments()).toBe(0);
    expect(await User.countDocuments()).toBe(1);
    expect(await Team.countDocuments()).toBe(1);
  });

  it('rejects an activity whose team is not the user\'s team without writing', async () => {
    const [team, other] = await Team.create([{ name: 'Octocats', mascot: 'Mona' }, { name: 'Robocats', mascot: 'Hubot' }]);
    const user = await User.create({ name: 'Mona', email: 'mona@example.com', team: team._id, fitnessGoal: 'endurance' });
    const response = await request(app).post('/api/activities').send({
      userId: user._id.toString(), teamId: other._id.toString(), type: 'run', minutes: 30,
    });
    expect(response.status).toBe(409);
    expect(response.body.error).toBe('User does not belong to the team');
    expect(await Activity.countDocuments()).toBe(0);
  });

  it('computes points and timestamps on the server while preserving submitted values', async () => {
    const team = await Team.create({ name: 'Octocats', mascot: 'Mona' });
    const user = await User.create({ name: 'Mona', email: 'mona@example.com', team: team._id, fitnessGoal: 'endurance' });
    const start = Date.now();
    const response = await request(app).post('/api/activities').send({
      userId: user._id.toString(), teamId: team._id.toString(), type: 'run', minutes: 12.5,
      points: 999, occurredAt: '2000-01-01T00:00:00.000Z',
    });
    expect(response.status).toBe(201);
    expect(response.body.activity).toMatchObject({
      user: user._id.toString(), team: team._id.toString(), type: 'run', minutes: 12.5, points: 12.5,
    });
    expect(Date.parse(response.body.activity.occurredAt)).toBeGreaterThanOrEqual(start);
    expect(Date.parse(response.body.activity.occurredAt)).toBeLessThanOrEqual(Date.now());
    expect(await Activity.countDocuments()).toBe(1);
    expect(await User.countDocuments()).toBe(1);
    expect(await Team.countDocuments()).toBe(1);
  });
});
