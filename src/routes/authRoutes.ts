import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware";
import { UserRepository } from "../repositories/userRepository";
import { AuthService } from "../auth/authService";
import { AuthController } from "../controllers/authController";
import { RefreshSessionRepository } from "../repositories/refreshSessionRepository";
import { PasswordResetTokenRepository } from "../repositories/passwordResetTokenRepository";

const router = Router();

const userRepository = new UserRepository();
const refreshSessionRepository = new RefreshSessionRepository();
const passwordResetTokenRepository =
    new PasswordResetTokenRepository();

const authService =
    new AuthService(userRepository, refreshSessionRepository, passwordResetTokenRepository);

const authController =
    new AuthController(authService);

router.post(
    "/register",
    authController.register
);

router.post("/login", authController.login);
router.post(
    "/refresh",
    authController.refresh
);
router.post(
    "/logout",
    authController.logout
);
router.post(
    "/change-password",
    requireAuth,
    authController.changePassword
);
router.post(
    "/forgot-password",
    authController.forgotPassword
);

router.post(
    "/reset-password",
    authController.resetPassword
);
router.get("/me", requireAuth, authController.me);


export default router;