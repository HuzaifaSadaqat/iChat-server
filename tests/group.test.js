import { jest } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Mock IORedis
jest.unstable_mockModule('ioredis', () => {
    return {
        default: class RedisMock {
            constructor() {}
            on(event, callback) { return this; }
            set() { return Promise.resolve('OK'); }
            sadd() { return Promise.resolve(1); }
            quit() { return Promise.resolve('OK'); }
            disconnect() { return Promise.resolve('OK'); }
            duplicate() { return this; }
            connect() { return Promise.resolve(); }
            publish() { return Promise.resolve(1); }
            subscribe() { return Promise.resolve('OK'); }
            psubscribe() { return Promise.resolve('OK'); }
            del() { return Promise.resolve(1); }
            srem() { return Promise.resolve(1); }
        },
        Redis: class RedisMock {
            constructor() {}
            on(event, callback) { return this; }
            set() { return Promise.resolve('OK'); }
            sadd() { return Promise.resolve(1); }
            quit() { return Promise.resolve('OK'); }
            disconnect() { return Promise.resolve('OK'); }
            duplicate() { return this; }
            connect() { return Promise.resolve(); }
            publish() { return Promise.resolve(1); }
            subscribe() { return Promise.resolve('OK'); }
            psubscribe() { return Promise.resolve('OK'); }
            del() { return Promise.resolve(1); }
            srem() { return Promise.resolve(1); }
        }
    };
});

// Mock Auth Middleware
jest.unstable_mockModule('../src/middlewares/auth.middleware.js', () => ({
    verifyToken: (req, res, next) => {
        // Mock a user with UID
        req.user = { uid: 'test-admin-uid', email: 'admin@example.com' };
        next();
    }
}));

// Mock RabbitMQ
jest.unstable_mockModule('../src/config/rabbitmq.js', () => ({
    getChannel: () => ({
        publish: jest.fn(),
        assertQueue: jest.fn()
    }),
    peekQueueMessages: jest.fn().mockResolvedValue([]),
    connectRabbitMQ: jest.fn().mockResolvedValue()
}));

// Set env vars
process.env.CORS_ORIGIN = '*';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

const { app } = await import('../src/app.js');
const { Group } = await import('../src/models/group.models.js');

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

afterEach(async () => {
    await Group.deleteMany({});
});

describe('Group API', () => {
    const adminId = 'test-admin-uid';
    const memberId = 'test-member-uid';

    describe('POST /api/v1/groups', () => {
        it('should create a group successfully', async () => {
            const res = await request(app)
                .post('/api/v1/groups')
                .send({
                    name: 'Test Group',
                    description: 'A test group',
                    members: [memberId]
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.status).toBe('success');
            expect(res.body.data.name).toBe('Test Group');
            expect(res.body.data.admin).toBe(adminId);
            expect(res.body.data.members).toContain(adminId);
            expect(res.body.data.members).toContain(memberId);
            expect(res.body.data.inviteToken).toBeDefined();
        });

        it('should return 400 if name is missing', async () => {
            const res = await request(app)
                .post('/api/v1/groups')
                .send({
                    description: 'No name group',
                    members: []
                });

            expect(res.statusCode).toBe(400);
        });
    });

    describe('GET /api/v1/groups', () => {
        it('should fetch groups for the user', async () => {
            // Seed a group
            await Group.create({
                name: 'My Group',
                members: [adminId], // adminId is the mocked user
                admin: adminId,
                inviteToken: 'some-token'
            });

            const res = await request(app).get('/api/v1/groups');

            expect(res.statusCode).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].name).toBe('My Group');
        });
    });

    describe('POST /api/v1/groups/join/:token', () => {
        it('should join a group via token', async () => {
            const token = 'valid-token';
            await Group.create({
                name: 'Joinable Group',
                members: ['other-user'],
                admin: 'other-user',
                inviteToken: token
            });

            const res = await request(app).post(`/api/v1/groups/join/${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toContain('Successfully joined');
            
            // Verify DB
            const group = await Group.findOne({ inviteToken: token });
            expect(group.members).toContain(adminId);
        });

        it('should return 404 for invalid token', async () => {
            const res = await request(app).post('/api/v1/groups/join/invalid-token');
            expect(res.statusCode).toBe(404);
        });
    });

    describe('POST /api/v1/groups/remove', () => {
        it('should remove a member', async () => {
            // Create group where current user is admin
            const group = await Group.create({
                name: 'Remove Test',
                members: [adminId, memberId],
                admin: adminId,
                inviteToken: 'remove-token'
            });

            const res = await request(app)
                .post('/api/v1/groups/remove')
                .send({
                    groupId: group._id,
                    memberId: memberId
                });

            expect(res.statusCode).toBe(200);
            
            const updatedGroup = await Group.findById(group._id);
            expect(updatedGroup.members).not.toContain(memberId);
        });
    });
});