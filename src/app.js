import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import redis from "./redis.config.js";

const app = express();

const httpServer = http.createServer(app);

/* ================= REDIS ================= */

const redisConfig = {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT) || 6379,
    maxRetriesPerRequest: 6, // Important: prevents crash if Redis is down
    enableReadyCheck: false,
    retryStrategy: (times) => {
        // Keep retrying with increasing delay
        const delay = Math.min(times * 100, 3000);
        return delay;
    },
};

const pubClient = new Redis(redisConfig);
const subClient = new Redis(redisConfig);

// Add error handlers
pubClient.on('error', (err) => {
    if (err.message.includes('ECONNREFUSED')) {
        console.warn('⚠️ Redis is not running. Please start your Redis server (e.g., redis-server).');
    } else {
        console.error('Redis Pub Client Error:', err.message);
    }
});

subClient.on('error', (err) => {
    if (err.message.includes('ECONNREFUSED')) {
        // Silent or minimal log for subClient to avoid double warnings
    } else {
        console.error('Redis Sub Client Error:', err.message);
    }
});

pubClient.on('connect', () => {
    console.log('🚀 Redis Pub Client Connected');
});

subClient.on('connect', () => {
    console.log('🚀 Redis Sub Client Connected');
});

/* ================= SOCKET.IO ================= */

// Parse CORS_ORIGIN if it's a JSON string, otherwise use it directly
let corsOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];

// Initialize Socket.IO with Redis adapter
export const io = new Server(httpServer, {
    cors: {
        origin: corsOrigins,
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true
    },
    adapter: createAdapter(pubClient, subClient)
});


io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("join", async ({ userId }) => {
        // Join personal room
        socket.join(userId);
        console.log("User joined room:", userId);

        // Store presence
        await redis.set(`presence:${userId}`, "online");
        await redis.sadd("online_users", userId);

        // Save userId on socket
        socket.data.userId = userId;

        // Broadcast to others that this user is online
        io.emit("user_status_changed", { userId, status: "online" });
    });

    socket.on("join_group", (groupId) => {
        socket.join(groupId);
        console.log(`User ${socket.id} joined group: ${groupId}`);
    });

    socket.on("new_msg", (message) => {
        if (message.receiverType === "group") {
            // Send to everyone in the group room except the sender
            socket.to(message.receiverId).emit("betaResponse", message);
        } else {
            // Send to the receiver's personal room
            io.to(message.receiverId).emit("betaResponse", message);
        }
    });

    socket.on("disconnect", async () => {
        const userId = socket.data.userId;
        if (!userId) return;

        // Check if user has other active connections before marking offline
        const sockets = await io.in(userId).fetchSockets();
        if (sockets.length === 0) {
            await redis.del(`presence:${userId}`);
            await redis.srem("online_users", userId);
            
            // Broadcast to others that this user is offline
            io.emit("user_status_changed", { userId, status: "offline" });
            console.log("User went offline:", userId);
        }
    });
});

/* ================= MIDDLEWARES & ROUTES ================= */
app.use(cors({
    origin: corsOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

//routes import
import chatRouter from './routes/chat.routes.js'
import userRouter from './routes/user.routes.js'
import groupRouter from './routes/group.routes.js'

// health check route
app.get('/health', (req, res) => {
    return res.status(200).json({
        status: 'success',
        message: 'Server is up and running'
    });
});

// routes declaration
app.use("/api/v1/messages", chatRouter)
app.use("/api/v1/users", userRouter)
app.use("/api/v1/groups", groupRouter)

export { app, httpServer };