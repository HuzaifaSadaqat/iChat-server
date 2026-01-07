import 'dotenv/config';
import connectDB from "./db/index.js";
import { app, httpServer } from "./app.js";

connectDB()
    .then(() => {
        httpServer.listen(process.env.PORT || 8000, () => {
            console.log(`⚙️  Server is running on ${process.env.PORT}`);
        })
        httpServer.on("error", (error) => {
            console.log("Errr: ", error);
            throw error
        })

    })
    .catch((err) => {
        console.log("Mongo conn failed: ", err);
    })