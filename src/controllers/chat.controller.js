import { Chat } from "../models/chat.models.js";
import mongoose from "mongoose";
import { getChannel, peekQueueMessages } from "../config/rabbitmq.js";
import { io } from "../app.js";
import crypto from "crypto";

const sendMessage = async (req, res) => {
    try {
        const { content, receiverId, receiverType = "user" } = req.body;
        const senderId = req.user.uid;

        if (!content || !receiverId) {
            return res.status(400).json({
                status: "error",
                message: "Content and receiverId are required"
            });
        }

        const messagePayload = {
            _id: crypto.randomUUID(), // Generate unique ID immediately
            content,
            sender: senderId,
            senderName: req.user.displayName || req.user.email || "Unknown User",
            receiverId,
            receiverType,
            timestamp: new Date(),
            createdAt: new Date()
        };

        // 1. REAL-TIME BROADCAST (Immediate)
        // This ensures the other user sees the message instantly
        if (receiverType === "group") {
            io.to(receiverId).emit("betaResponse", messagePayload);
        } else {
            io.to(receiverId).emit("betaResponse", messagePayload);
        }

        // 2. ASYNC PERSISTENCE (RabbitMQ)
        const channel = getChannel();
        const exchange = "chat_exchange";
        
        const dbPayload = {
            ...messagePayload,
            receiver: receiverId // Map to DB field name
        };

        channel.publish(exchange, "persist", Buffer.from(JSON.stringify(dbPayload)));
        channel.publish(exchange, "notify", Buffer.from(JSON.stringify(dbPayload)));

        return res.status(201).json({
            status: "success",
            data: messagePayload,
            message: "Message sent"
        });

    } catch (error) {
        console.error("Error in sendMessage controller:", error);
        return res.status(500).json({
            status: "error",
            message: error.message || "Internal server error"
        });
    }
}

const getMessages = async (req, res) => {
    try {
        const { receiverId, receiverType = "user" } = req.query;
        
        // Use the authenticated user's Firebase uid
        const senderId = req.user.uid;

        if (!receiverId) {
            return res.status(400).json({
                status: "error",
                message: "receiverId is required to fetch chat history"
            });
        }

        let query;
        if (receiverType === "group") {
            query = { receiver: receiverId, receiverType: "group" };
        } else {
            // Find messages where (sender is user AND receiver is receiverId) OR (sender is receiverId AND receiver is user)
            query = {
                $or: [
                    { sender: senderId, receiver: receiverId, receiverType: "user" },
                    { sender: receiverId, receiver: senderId, receiverType: "user" }
                ]
            };
        }

        const dbMessages = await Chat.aggregate([
            { $match: query },
            {
                $lookup: {
                    from: "users",
                    localField: "sender",
                    foreignField: "uid",
                    as: "senderDetails"
                }
            },
            {
                $addFields: {
                    senderName: { $arrayElemAt: ["$senderDetails.displayName", 0] }
                }
            },
            { $project: { senderDetails: 0 } },
            { $sort: { createdAt: 1 } }
        ]);

        // 2. Fetch Pending messages from RabbitMQ Queue
        const pendingQueueMessages = await peekQueueMessages("chat.persist");
        
        // Filter queue messages to only those relevant to this specific chat
        const relevantPending = pendingQueueMessages.filter(msg => {
            if (receiverType === "group") {
                return msg.receiverId === receiverId && msg.receiverType === "group";
            } else {
                const isFromMe = msg.sender === senderId && msg.receiverId === receiverId;
                const isToMe = msg.sender === receiverId && msg.receiverId === senderId;
                return (isFromMe || isToMe) && msg.receiverType === "user";
            }
        }).map(msg => ({
            ...msg,
            isPending: true
        }));

        // 3. Merge and Sort
        const allMessages = [...dbMessages, ...relevantPending].sort((a, b) => 
            new Date(a.createdAt || a.timestamp) - new Date(b.createdAt || b.timestamp)
        );

        return res.status(200).json({
            status: "success",
            data: allMessages,
            message: "Messages fetched successfully (including pending)"
        });
    } catch (error) {
        console.error("Error in getMessages controller:", error);
        return res.status(500).json({
            status: "error",
            message: error.message || "Internal server error"
        });
    }
}

export { sendMessage, getMessages };