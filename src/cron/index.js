import cron from "node-cron";
import { getChannel } from "../config/rabbitmq.js";
import { Chat } from "../models/chat.models.js";

/**
 * Cron job to persist messages from RabbitMQ to MongoDB.
 * It runs every 30 minutes and processes all messages currently in the 'chat.persist' queue.
 */
export function initCronJobs() {
    console.log("⏲️  Initializing Cron Jobs...");

    // Run every 30 minutes
    cron.schedule("*/3 * * * *", async () => {
        console.log("🧹 Running Persist Cron: Checking for messages to save...");
        
        try {
            const channel = getChannel();
            if (!channel) {
                console.warn("⚠️  RabbitMQ channel not available for cron job");
                return;
            }

            const queue = "chat.persist";
            let processedCount = 0;
            const MAX_MESSAGES_PER_RUN = 500; // Process in chunks to avoid blocking
            let msg;

            // Process messages in the queue
            while (processedCount < MAX_MESSAGES_PER_RUN && (msg = await channel.get(queue, { noAck: false }))) {
                try {
                    const messageData = JSON.parse(msg.content.toString());
                    
                    // Save to MongoDB
                    await Chat.create({
                        content: messageData.content,
                        sender: messageData.sender,
                        receiver: messageData.receiver || messageData.receiverId,
                        receiverType: messageData.receiverType || "user"
                    });

                    // Acknowledge the message (remove from queue)
                    channel.ack(msg);
                    processedCount++;

                    // Yield to event loop every 50 messages
                    if (processedCount % 50 === 0) {
                        await new Promise(resolve => setImmediate(resolve));
                    }
                } catch (error) {
                    console.error("❌ Error persisting message in cron:", error);
                    channel.nack(msg, false, true); 
                    break; 
                }
            }

            if (processedCount > 0) {
                console.log(`✅ Cron saved ${processedCount} messages to DB`);
            } else {
                console.log("ℹ️  No messages to persist in this run");
            }
        } catch (error) {
            console.error("❌ Persist Cron failed:", error);
        }
    });

    console.log("✅ Persist Cron Job scheduled (Every 30 minutes)");
}
