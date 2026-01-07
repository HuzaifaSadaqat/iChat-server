import { Group } from "../models/group.models.js";
import { v4 as uuidv4 } from "uuid";

const createGroup = async (req, res) => {
    try {
        const { name, description, members } = req.body;
        const adminId = req.user.uid;

        if (!name || !members || !Array.isArray(members)) {
            return res.status(400).json({
                status: "error",
                message: "Name and members are required"
            });
        }

        // Add admin to members if not already present
        const groupMembers = [...new Set([...members, adminId])];

        const group = await Group.create({
            name,
            description,
            members: groupMembers,
            admin: adminId,
            inviteToken: uuidv4()
        });

        if (!group) {
            return res.status(500).json({
                status: "error",
                message: "Failed to create group"
            });
        }

        return res.status(201).json({
            status: "success",
            data: group,
            message: "Group created successfully"
        });
    } catch (error) {
        console.error("Error in createGroup controller:", error);
        return res.status(500).json({
            status: "error",
            message: error.message || "Internal server error"
        });
    }
};

const getUserGroups = async (req, res) => {
    try {
        const userId = req.user.uid;

        const groups = await Group.find({
            members: userId
        }).sort({ createdAt: -1 });

        // Ensure all groups have an invite token (for groups created before this feature)
        const updatedGroups = await Promise.all(groups.map(async (group) => {
            if (!group.inviteToken) {
                group.inviteToken = uuidv4();
                await group.save();
            }
            return group;
        }));

        return res.status(200).json({
            status: "success",
            data: updatedGroups,
            message: "Groups fetched successfully"
        });
    } catch (error) {
        console.error("Error in getUserGroups controller:", error);
        return res.status(500).json({
            status: "error",
            message: error.message || "Internal server error"
        });
    }
};

const joinGroupByToken = async (req, res) => {
    try {
        const { token } = req.params;
        const userId = req.user.uid;

        if (!token) {
            return res.status(400).json({
                status: "error",
                message: "Invite token is required"
            });
        }

        const group = await Group.findOne({ inviteToken: token });

        if (!group) {
            return res.status(404).json({
                status: "error",
                message: "Invalid or expired invite link"
            });
        }

        // Check if user is already a member
        if (group.members.includes(userId)) {
            return res.status(200).json({
                status: "success",
                data: group,
                message: "You are already a member of this group"
            });
        }

        // Add user to group members
        group.members.push(userId);
        await group.save();

        return res.status(200).json({
            status: "success",
            data: group,
            message: "Successfully joined the group"
        });
    } catch (error) {
        console.error("Error in joinGroupByToken controller:", error);
        return res.status(500).json({
            status: "error",
            message: error.message || "Internal server error"
        });
    }
};

const removeMember = async (req, res) => {
    try {
        const { groupId, memberId } = req.body;
        const adminId = req.user.uid;

        if (!groupId || !memberId) {
            return res.status(400).json({
                status: "error",
                message: "GroupId and MemberId are required"
            });
        }

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({
                status: "error",
                message: "Group not found"
            });
        }

        // Check if the requester is the admin
        if (group.admin !== adminId) {
            return res.status(403).json({
                status: "error",
                message: "Only admin can remove members"
            });
        }

        // Check if member exists in group
        if (!group.members.includes(memberId)) {
            return res.status(400).json({
                status: "error",
                message: "User is not a member of this group"
            });
        }

        // Cannot remove yourself if you are admin (must transfer ownership or delete group)
        if (memberId === adminId) {
            return res.status(400).json({
                status: "error",
                message: "Admin cannot be removed from the group"
            });
        }

        // Remove the member
        group.members = group.members.filter(id => id !== memberId);
        await group.save();

        return res.status(200).json({
            status: "success",
            data: group,
            message: "Member removed successfully"
        });
    } catch (error) {
        console.error("Error in removeMember controller:", error);
        return res.status(500).json({
            status: "error",
            message: error.message || "Internal server error"
        });
    }
};

const getGroupMembers = async (req, res) => {
    try {
        const { groupId } = req.params;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({
                status: "error",
                message: "Group not found"
            });
        }

        // Fetch user details for all members from User collection
        // Importing User model inside function to avoid circular dependency if any
        const { User } = await import("../models/user.models.js");
        
        const members = await User.find({
            uid: { $in: group.members }
        }).select("-email -createdAt -updatedAt -__v");

        return res.status(200).json({
            status: "success",
            data: members,
            message: "Members fetched successfully"
        });
    } catch (error) {
        console.error("Error in getGroupMembers controller:", error);
        return res.status(500).json({
            status: "error",
            message: error.message || "Internal server error"
        });
    }
};

export { createGroup, getUserGroups, joinGroupByToken, removeMember, getGroupMembers };
