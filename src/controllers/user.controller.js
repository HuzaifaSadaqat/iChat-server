import { User } from "../models/user.models.js";
import redis from "../config/redis.config.js";

export const getUsers = async (req, res) => {
    try {
        const loggedInUserUid = req.user.uid;
        
        // Fetch all users except the current one
        const users = await User.find({
            uid: { $ne: loggedInUserUid }
        }).select("uid displayName email photoURL");

        // Get online users from Redis
        const onlineUserIds = await redis.smembers("online_users");
        const onlineSet = new Set(onlineUserIds);

        // Add online status to each user
        const usersWithStatus = users.map(user => ({
            ...user.toObject(),
            isOnline: onlineSet.has(user.uid)
        }));

        return res.status(200).json({
            status: "success",
            data: usersWithStatus
        });
    } catch (error) {
        console.error("Error fetching users:", error.message);
        return res.status(500).json({
            status: "error",
            message: "Failed to fetch users"
        });
    }
};
