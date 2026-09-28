import { Router } from "express";

import { UserRepository } from "../repositories/userRepository";
import { AuthService } from "../auth/authService";
import { AuthController } from "../controllers/authController";

const router = Router();

const userRepository = new UserRepository();

const authService =
    new AuthService(userRepository);

const authController =
    new AuthController(authService);

router.post(
    "/register",
    authController.register
);

export default router;