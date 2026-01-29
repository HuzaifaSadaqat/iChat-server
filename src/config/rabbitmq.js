import amqp from "amqplib";

let channel;

export async function connectRabbitMQ() {
	try {
		const connection = await amqp.connect("amqp://localhost");
		channel = await connection.createChannel();

		await channel.assertExchange("chat_exchange", "direct", {
			durable: true
		});

		await channel.assertQueue("chat.persist", {
			durable: true
		});

		await channel.assertQueue("chat.notify", {
			durable: true
		});

		await channel.assertQueue("chat.dead", {
			durable: true
		});

		channel.bindQueue("chat.persist", "chat_exchange", "persist");
		channel.bindQueue("chat.notify", "chat_exchange", "notify");

		console.log("✅ RabbitMQ connected");
	} catch (error) {
		console.error("❌ RabbitMQ connection failed:", error.message);
		// In production, you might want to retry or exit
		// process.exit(1); 
	}
}

export function getChannel() {
	if (!channel) {
		throw new Error("RabbitMQ channel not initialized");
	}
	return channel;
}

/**
 * Retrieves messages from a queue without acknowledging them,
 * so they stay in the queue for later processing (e.g., cron job).
 */
export async function peekQueueMessages(queueName) {
	if (!channel) return [];

	const messages = [];
	const fetchedMessages = [];
	let msg;

	try {
		// 1. Get messages without requeueing them immediately 
		// to avoid picking up the same message in the same loop
		while (true) {
			msg = await channel.get(queueName, { noAck: false });
			if (!msg) break;

			messages.push(JSON.parse(msg.content.toString()));
			fetchedMessages.push(msg);

			// Safety limit: Don't peek more than 500 messages at once
			if (messages.length >= 500) break; 
			
			// Yield to event loop every 50 messages to keep the server responsive
			if (messages.length % 50 === 0) {
				await new Promise(resolve => setImmediate(resolve));
			}
		}

		// 2. NOW nack them all with requeue: true 
		// so they are available for the next call and the cron job
		for (const rawMsg of fetchedMessages) {
			channel.nack(rawMsg, false, true);
		}

	} catch (error) {
		console.error("Error peeking queue:", error);
	}

	return messages;
}
