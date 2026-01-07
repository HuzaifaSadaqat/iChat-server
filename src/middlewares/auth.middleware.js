import admin from "../firebase-admin.js";
import { User } from "../models/user.models.js";

export const verifyToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];

        if (!token) {
            return res.status(401).json({
                status: "error",
                message: "Unauthorized: No token provided"
            });
        }

        const decodedToken = await admin.auth().verifyIdToken(token);
        const { uid, email, name, picture } = decodedToken;

        // console.log("Auth Middleware - Decoded Token UID:", uid);

        // Find or create user in our MongoDB
        let user = await User.findOne({ uid });

        if (!user) {
            console.log("Auth Middleware - User not found in MongoDB, creating new user for UID:", uid);
            user = await User.create({
                uid,
                email,
                displayName: name || email.split("@")[0],
                photoURL: picture || ""
            });
            console.log("Auth Middleware - Successfully created user in MongoDB:", user._id);
        } else {
            // console.log("Auth Middleware - User found in MongoDB:", user._id);
        }


        req.user = user;
        next();
    } catch (error) {
        console.error("Auth middleware error:", error.message);
        return res.status(401).json({
            status: "error",
            message: "Unauthorized: Invalid token"
        });
    }
};
