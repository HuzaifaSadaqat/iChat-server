import mongoose, { Schema } from "mongoose";

const userSchema = new Schema(
    {
        uid: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        displayName: {
            type: String,
            required: true,
            trim: true
        },
        photoURL: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

export const User = mongoose.model("User", userSchema);
