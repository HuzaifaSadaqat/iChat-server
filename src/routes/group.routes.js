import { Router } from "express";
import { createGroup, getUserGroups, joinGroupByToken, removeMember, getGroupMembers } from "../controllers/group.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply verifyToken middleware to all group routes
router.use(verifyToken);

router.route("/").post(createGroup).get(getUserGroups);
router.route("/join/:token").post(joinGroupByToken);
router.route("/remove").post(removeMember);
router.route("/members/:groupId").get(getGroupMembers);

export default router;
