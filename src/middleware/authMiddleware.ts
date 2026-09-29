import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../auth/tokenService";

export interface AuthenticatedRequest extends Request {
    userId?: string;
}

export function requireAuth(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): void {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            res.status(401).json({
                success: false,
                error: {
                    code: "UNAUTHENTICATED",
                    message: "Authentication required.",
                },
            });
            return;
        }

        if (!authHeader.startsWith("Bearer ")) {
            res.status(401).json({
                success: false,
                error: {
                    code: "INVALID_TOKEN",
                    message: "Invalid authorization header.",
                },
            });
            return;
        }

        const token = authHeader.substring(7);

        const payload = verifyAccessToken(token);

        req.userId = payload.userId;

        next();
    } catch {
        res.status(401).json({
            success: false,
            error: {
                code: "INVALID_TOKEN",
                message: "Invalid or expired access token.",
            },
        });
    }
}