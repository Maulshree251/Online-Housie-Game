import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { UserService } from "../services/userService";

export class UserController {

    constructor(
        private userService: UserService
    ) { }

    public me = async (
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
                        message:
                            "Authentication required.",
                    },
                });

                return;
            }

            const user =
                await this.userService.getProfile(
                    userId
                );

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

    public updateMe = async (
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
                        message:
                            "Authentication required.",
                    },
                });

                return;
            }

            const user =
                await this.userService.updateProfile(
                    userId,
                    req.body
                );

            res.status(200).json({
                success: true,
                data: user,
            });

        } catch (error) {

            res.status(400).json({
                success: false,
                error: {
                    code: "PROFILE_UPDATE_FAILED",
                    message:
                        error instanceof Error
                            ? error.message
                            : "Unable to update profile.",
                },
            });
        }
    };
}