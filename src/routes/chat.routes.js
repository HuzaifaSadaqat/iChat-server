import { Router } from "express";
import { sendMessage, getMessages } from "../controllers/chat.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply verifyToken middleware to all chat routes
router.use(verifyToken);

router.route("/send").post(sendMessage);
router.route("/").get(getMessages);

export default router;