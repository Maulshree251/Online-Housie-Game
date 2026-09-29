import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware";
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

router.post("/login", authController.login);
router.get("/me", requireAuth, authController.me);


export default router;