import { Request, Response } from "express";
import { AuthService } from "../auth/authService";

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
}