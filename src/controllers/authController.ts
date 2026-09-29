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

}