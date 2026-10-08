import { Request, Response } from "express";
import { AuthService } from "../auth/authService"; import { AuthenticatedRequest } from "../middleware/authMiddleware";

export class AuthController {

    private authService: AuthService;

    constructor(authService: AuthService) {
        this.authService = authService;
    }

    public register = async (
        req: Request,
        res: Response
    ): Promise<void> => {

        try {
            const { name, email, password } = req.body;

            const user =
                await this.authService.register({
                    name,
                    email,
                    password,
                });

            res.status(201).json({
                success: true,
                data: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    createdAt: user.createdAt,
                },
            });

        } catch (error) {

            const message =
                error instanceof Error
                    ? error.message
                    : "Unable to register user.";

            res.status(400).json({
                success: false,
                error: {
                    code: "REGISTRATION_FAILED",
                    message,
                },
            });
        }
    };
    public login = async (
        req: Request,
        res: Response
    ): Promise<void> => {
        try {
            const result = await this.authService.login(req.body);

            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error) {
            res.status(401).json({
                success: false,
                error: {
                    code: "INVALID_CREDENTIALS",
                    message:
                        error instanceof Error
                            ? error.message
                            : "Invalid email or password.",
                },
            });
        }
    };
    public me = async (
        req: AuthenticatedRequest,
        res: Response
    ): Promise<void> => {
        try {
            if (!req.userId) {
                res.status(401).json({
                    success: false,
                    error: {
                        code: "UNAUTHENTICATED",
                        message: "Authentication required.",
                    },
                });
                return;
            }

            const user = await this.authService.getCurrentUser(req.userId);

            res.status(200).json({
                success: true,
                data: user,
            });
        } catch (error) {
            res.status(404).json({
                success: false,
                error: {
                    code: "USER_NOT_FOUND",
                    message:
                        error instanceof Error
                            ? error.message
                            : "User not found.",
                },
            });
        }
    };

    public refresh = async (
        req: Request,
        res: Response
    ): Promise<void> => {

        try {
            const { refreshToken } = req.body;

            const result =
                await this.authService.refresh(
                    refreshToken
                );

            res.status(200).json({
                success: true,
                data: result,
            });

        } catch (error) {

            res.status(401).json({
                success: false,
                error: {
                    code: "INVALID_REFRESH_TOKEN",
                    message:
                        error instanceof Error
                            ? error.message
                            : "Invalid refresh token.",
                },
            });
        }
    };

    public logout = async (
        req: Request,
        res: Response
    ): Promise<void> => {

        try {
            const { refreshToken } = req.body;

            await this.authService.logout(
                refreshToken
            );

            res.status(200).json({
                success: true,
                data: {
                    message: "Logged out successfully.",
                },
            });

        } catch (error) {

            res.status(400).json({
                success: false,
                error: {
                    code: "LOGOUT_FAILED",
                    message:
                        error instanceof Error
                            ? error.message
                            : "Logout failed.",
                },
            });
        }
    };

    public changePassword = async (
        req: AuthenticatedRequest,
        res: Response
    ): Promise<void> => {

        try {
            const userId = req.userId;

            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: {
                        code: "UNAUTHENTICATED",
                        message: "Authentication required.",
                    },
                });
                return;
            }

            const {
                currentPassword,
                newPassword,
            } = req.body;

            await this.authService.changePassword(
                userId,
                currentPassword,
                newPassword
            );

            res.status(200).json({
                success: true,
                data: {
                    message:
                        "Password changed successfully.",
                },
            });

        } catch (error) {

            res.status(400).json({
                success: false,
                error: {
                    code: "PASSWORD_CHANGE_FAILED",
                    message:
                        error instanceof Error
                            ? error.message
                            : "Failed to change password.",
                },
            });
        }
    };

    public forgotPassword = async (
        req: Request,
        res: Response
    ): Promise<void> => {

        try {

            const { email } = req.body;

            const result =
                await this.authService.forgotPassword(
                    email
                );

            res.status(200).json({
                success: true,
                data: result,
            });

        } catch (error) {

            res.status(400).json({
                success: false,
                error: {
                    code: "FORGOT_PASSWORD_FAILED",
                    message:
                        error instanceof Error
                            ? error.message
                            : "Unable to process request.",
                },
            });
        }
    };

    public resetPassword = async (
        req: Request,
        res: Response
    ): Promise<void> => {

        try {

            const {
                resetToken,
                newPassword,
            } = req.body;

            await this.authService.resetPassword(
                resetToken,
                newPassword
            );

            res.status(200).json({
                success: true,
                data: {
                    message:
                        "Password reset successfully.",
                },
            });

        } catch (error) {

            res.status(400).json({
                success: false,
                error: {
                    code: "PASSWORD_RESET_FAILED",
                    message:
                        error instanceof Error
                            ? error.message
                            : "Unable to reset password.",
                },
            });
        }
    };
}