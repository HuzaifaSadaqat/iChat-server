import 'dotenv/config';
import connectDB from "./db/index.js";
import { app, httpServer } from "./app.js";
import { connectRabbitMQ } from "./config/rabbitmq.js";
import { startPersistWorker } from "./workers/persistWorker.js";
import { initCronJobs } from "./cron/index.js";

connectDB()
    .then(async () => {
        await connectRabbitMQ();
        
        // Start cron jobs
        initCronJobs();

        // Start background workers
        // await startPersistWorker(); // Disabled: Messages will stay in queue for batch processing

        const port = process.env.PORT || 8000;
        httpServer.listen(port, () => {
            console.log(`🚀 Server Instance running on port: ${port}`);
        })  
        httpServer.on("error", (error) => {
            console.log("Errr: ", error);
            throw error
        })

    })
    .catch((err) => {
        console.log("Mongo conn failed: ", err);
    })