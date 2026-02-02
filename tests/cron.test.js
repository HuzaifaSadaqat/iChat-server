import { jest } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

// Mock RabbitMQ
const mockChannel = {
    get: jest.fn(),
    ack: jest.fn(),
    nack: jest.fn()
};

jest.unstable_mockModule('../src/config/rabbitmq.js', () => ({
    getChannel: jest.fn(() => mockChannel)
}));

const { persistMessagesWorker } = await import('../src/cron/index.js');
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
    jest.clearAllMocks();
});

describe('Cron Job: Persist Messages', () => {
    it('should process messages from queue and save to DB', async () => {
        // Setup mock message
        const messageContent = {
            content: 'Hello Queue',
            sender: 'sender-id',
            receiverId: 'receiver-id',
            receiverType: 'user'
        };

        const mockMsg = {
            content: Buffer.from(JSON.stringify(messageContent))
        };

        // Mock channel.get to return message once, then null
        mockChannel.get
            .mockResolvedValueOnce(mockMsg)
            .mockResolvedValueOnce(null);

        await persistMessagesWorker();

        // Verify Chat creation
        const chats = await Chat.find();
        expect(chats).toHaveLength(1);
        expect(chats[0].content).toBe('Hello Queue');
        expect(chats[0].sender).toBe('sender-id');

        // Verify Ack
        expect(mockChannel.ack).toHaveBeenCalledWith(mockMsg);
    });

    it('should handle empty queue', async () => {
        mockChannel.get.mockResolvedValue(null);

        await persistMessagesWorker();

        const chats = await Chat.find();
        expect(chats).toHaveLength(0);
        expect(mockChannel.ack).not.toHaveBeenCalled();
    });
});