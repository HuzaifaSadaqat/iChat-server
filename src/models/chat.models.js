import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const chatSchema = new Schema(
    {
        content: {
            type: String,
            required: true,
        },
        sender: {
            type: String, // Storing Firebase uid
            required: true,
        },
        receiver: {
            type: String, // Storing Firebase uid or Group _id
            required: true,
        },
        receiverType: {
            type: String,
            enum: ["user", "group"],
            default: "user"
        },

    },
    {
        timestamps: true
    }
)

chatSchema.plugin(mongooseAggregatePaginate)

export const Chat = mongoose.model("Chat", chatSchema)