import { Router } from "express";

import { requireAuth } from "../middleware/authMiddleware";
import { UserRepository } from "../repositories/userRepository";
import { UserService } from "../services/userService";
import { UserController } from "../controllers/userController";

const router = Router();

const userRepository =
    new UserRepository();

const userService =
    new UserService(userRepository);

const userController =
    new UserController(userService);

router.get(
    "/me",
    requireAuth,
    userController.me
);
router.patch(
    "/me",
    requireAuth,
    userController.updateMe
);

export default router;