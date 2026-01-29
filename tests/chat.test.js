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
        }
    };
});

// Mock Auth Middleware
jest.unstable_mockModule('../src/middlewares/auth.middleware.js', () => ({
    verifyToken: (req, res, next) => {
        // Mock a user with UID
        req.user = { uid: 'test-sender-uid', email: 'test@example.com' };
        next();
    }
}));

// Mock RabbitMQ
jest.unstable_mockModule('../src/config/rabbitmq.js', () => ({
    getChannel: () => ({
        publish: jest.fn()
    }),
    peekQueueMessages: jest.fn().mockResolvedValue([])
}));

// Set env vars
process.env.CORS_ORIGIN = '*';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

const { app } = await import('../src/app.js');
const { Chat } = await import('../src/models/chat.models.js');

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
    await Chat.deleteMany({});
});

describe('Chat API', () => {
    const senderId = 'test-sender-uid';
    const receiverId = 'test-receiver-uid';

    describe('POST /api/v1/messages/send', () => {
        it('should send a message successfully', async () => {
            const res = await request(app)
                .post('/api/v1/messages/send')
                .send({
                    content: 'Hello World',
                    receiverId
                });

            // Expect 201 Created
            expect(res.statusCode).toBe(201);
            expect(res.body.status).toBe('success');
            expect(res.body.data.content).toBe('Hello World');
            expect(res.body.data.sender).toBe(senderId);
            expect(res.body.data.receiverId).toBe(receiverId);

            // Note: We don't verify DB persistence here because the controller 
            // uses RabbitMQ for async persistence, which we mocked.
        });

        it('should fail if content is missing', async () => {
            const res = await request(app)
                .post('/api/v1/messages/send')
                .send({
                    receiverId
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.status).toBe('error');
        });
    });

    describe('GET /api/v1/messages', () => {
        it('should retrieve messages between two users', async () => {
            // Seed messages directly into DB with explicit timestamps to ensure order
            const baseTime = new Date();
            await Chat.create([
                { 
                    content: 'Message 1', 
                    sender: senderId, 
                    receiver: receiverId,
                    createdAt: new Date(baseTime.getTime() - 2000)
                },
                { 
                    content: 'Message 2', 
                    sender: receiverId, 
                    receiver: senderId,
                    createdAt: new Date(baseTime.getTime() - 1000)
                }, // Reply
                { 
                    content: 'Message 3', 
                    sender: senderId, 
                    receiver: receiverId,
                    createdAt: baseTime
                }
            ]);

            const res = await request(app)
                .get('/api/v1/messages')
                .query({
                    receiverId
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.status).toBe('success');
            // Check data length
            expect(res.body.data.length).toBe(3);
            expect(res.body.data[0].content).toBe('Message 1');
            expect(res.body.data[1].content).toBe('Message 2');
            expect(res.body.data[2].content).toBe('Message 3');
        });

        it('should return empty array if no messages exist', async () => {
            const res = await request(app)
                .get('/api/v1/messages')
                .query({
                    receiverId
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.data).toEqual([]);
        });
        
        it('should fail if receiverId is missing', async () => {
             const res = await request(app)
                .get('/api/v1/messages');
            
            expect(res.statusCode).toBe(400);
        });
    });
});
