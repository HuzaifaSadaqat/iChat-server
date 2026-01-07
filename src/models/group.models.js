import mongoose, { Schema } from "mongoose";

const groupSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            trim: true
        },
        members: [
            {
                type: String, // Storing Firebase uids
                required: true
            }
        ],
        admin: {
            type: String, // Storing Firebase uid of the creator
            required: true
        },
        photoURL: {
            type: String,
            default: ""
        },
        inviteToken: {
            type: String,
            unique: true,
            index: true
        }
    },
    {
        timestamps: true
    }
);

export const Group = mongoose.model("Group", groupSchema);
