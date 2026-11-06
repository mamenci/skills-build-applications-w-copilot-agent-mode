import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { Team, User } from '../src/models/index.js';
import { createTeam } from '../src/services/octofitService.js';

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
  await Promise.all([Team.deleteMany({}), User.deleteMany({})]);
});

describe('team creation validation', () => {
  it('rejects malformed bodies, empty fields, and malformed member IDs without writes', async () => {
    const valid = { name: 'Octocats', mascot: 'Mona' };
    for (const input of [
      null, [], {}, { mascot: 'Mona' }, { name: 'Octocats' },
      { ...valid, name: '   ' }, { ...valid, name: 123 },
      { ...valid, mascot: '' }, { ...valid, mascot: false },
      { ...valid, members: null }, { ...valid, members: 'not-an-array' },
      { ...valid, members: ['not-an-id'] }, { ...valid, members: [123] },
    ]) {
      await expect(createTeam(input)).rejects.toMatchObject({ status: 400 });
    }
    expect(await Team.countDocuments()).toBe(0);
  });

  it('rejects missing members with a deliberate 404 and no writes', async () => {
    const member = await User.create({ name: 'Mona', email: 'mona@example.com', fitnessGoal: 'endurance' });
    const response = await request(app).post('/api/teams').send({
      name: 'Octocats', mascot: 'Mona',
      members: [member._id.toString(), new mongoose.Types.ObjectId().toString()],
    });
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('One or more members were not found');
    expect(await Team.countDocuments()).toBe(0);
    expect(await User.countDocuments()).toBe(1);
  });

  it('defaults omitted members to an empty array', async () => {
    const response = await request(app).post('/api/teams').send({ name: 'Octocats', mascot: 'Mona' });
    expect(response.status).toBe(201);
    expect(response.body.team).toMatchObject({ name: 'Octocats', mascot: 'Mona', members: [] });
    const listed = await request(app).get('/api/teams');
    expect(listed.status).toBe(200);
    expect(listed.body.teams).toHaveLength(1);
    expect(listed.body.teams[0].members).toEqual([]);
  });

  it('preserves existing member IDs, including repeated IDs with different casing', async () => {
    const member = await User.create({ name: 'Mona', email: 'mona@example.com', fitnessGoal: 'endurance' });
    const id = member._id.toString();
    const response = await request(app).post('/api/teams').send({
      name: 'Octocats', mascot: 'Mona', members: [id, id.toUpperCase()],
    });
    expect(response.status).toBe(201);
    expect(response.body.team.members).toEqual([id, id]);
    expect(await User.countDocuments()).toBe(1);
    expect(await Team.countDocuments()).toBe(1);
  });

  it('keeps User.team and Team.members consistent when members join a new team', async () => {
    const previous = await Team.create({ name: 'Robocats', mascot: 'Hubot' });
    const member = await User.create({ name: 'Mona', email: 'mona@example.com', team: previous._id, fitnessGoal: 'endurance' });
    await Team.updateOne({ _id: previous._id }, { $addToSet: { members: member._id } });
    const response = await request(app).post('/api/teams').send({ name: 'Octocats', mascot: 'Mona', members: [member._id.toString()] });
    expect(response.status).toBe(201);
    expect((await User.findById(member._id))?.team?.toString()).toBe(response.body.team._id);
    expect((await Team.findById(previous._id))?.members).toHaveLength(0);
  });

  it('lists member names next to the member IDs', async () => {
    const member = await User.create({ name: 'Mona', email: 'mona@example.com', fitnessGoal: 'endurance' });
    await request(app).post('/api/teams').send({ name: 'Octocats', mascot: 'Mona', members: [member._id.toString()] });
    const listed = await request(app).get('/api/teams');
    expect(listed.body.teams[0].members).toEqual([member._id.toString()]);
    expect(listed.body.teams[0].memberNames).toEqual(['Mona']);
  });
});
