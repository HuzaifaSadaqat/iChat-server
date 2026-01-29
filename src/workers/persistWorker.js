import { getChannel } from "../config/rabbitmq.js";
import { Chat } from "../models/chat.models.js";

export async function startPersistWorker() {
    try {
        const channel = getChannel();
        const queue = "chat.persist";

        console.log(`👷 Persist Worker waiting for messages in ${queue}...`);

        channel.consume(queue, async (msg) => {
            if (msg !== null) {
                try {
                    const messageData = JSON.parse(msg.content.toString());
                    
                    // Save to MongoDB
                    await Chat.create({
                        content: messageData.content,
                        sender: messageData.sender,
                        receiver: messageData.receiver,
                        receiverType: messageData.receiverType || "user"
                    });

                    // Acknowledge the message (remove from queue)
                    channel.ack(msg);
                } catch (error) {
                    console.error("❌ Error persisting message:", error);
                    // Reject and requeue if it's a temporary failure, 
                    // or move to dead letter if it's a data error
                    channel.nack(msg, false, false); 
                }
            }
        });
    } catch (error) {
        console.error("❌ Persist Worker failed to start:", error);
    }
}
