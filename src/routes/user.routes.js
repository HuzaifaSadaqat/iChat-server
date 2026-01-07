import { Router } from "express";
import { getUsers } from "../controllers/user.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply verifyToken middleware to all user routes
router.use(verifyToken);

router.route("/").get(getUsers);

export default router;
