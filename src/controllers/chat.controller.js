import { Chat } from "../models/chat.models.js";
import mongoose from "mongoose";

const sendMessage = async (req, res) => {
    try {
        const { content, receiverId, receiverType = "user" } = req.body;
        
        // Use the authenticated user's Firebase uid
        const senderId = req.user.uid;

        if (!content || !receiverId) {

            return res.status(400).json({
                status: "error",
                message: "Content and receiverId are required"
            });
        }

        const chat = await Chat.create({
            content,
            sender: senderId,
            receiver: receiverId,
            receiverType
        });

        if (!chat) {
            return res.status(500).json({
                status: "error",
                message: "Failed to send message"
            });
        }

        return res.status(201).json({
            status: "success",
            data: chat,
            message: "Message sent successfully"
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

        const messages = await Chat.aggregate([
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

        return res.status(200).json({
            status: "success",
            data: messages,
            message: "Messages fetched successfully"
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