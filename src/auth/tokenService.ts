import jwt from "jsonwebtoken";

export interface TokenPayload {
    userId: string;
    type: "access" | "refresh";
}

function getAccessSecret(): string {
    const secret = process.env.JWT_ACCESS_SECRET;

    if (!secret) {
        throw new Error("JWT_ACCESS_SECRET is not defined.");
    }

    return secret;
}

function getRefreshSecret(): string {
    const secret = process.env.JWT_REFRESH_SECRET;

    if (!secret) {
        throw new Error("JWT_REFRESH_SECRET is not defined.");
    }

    return secret;
}

export function generateAccessToken(userId: string): string {
    const payload: TokenPayload = {
        userId,
        type: "access",
    };

    return jwt.sign(payload, getAccessSecret(), {
        expiresIn: "15m",
    });
}

export function generateRefreshToken(userId: string): string {
    const payload: TokenPayload = {
        userId,
        type: "refresh",
    };

    return jwt.sign(payload, getRefreshSecret(), {
        expiresIn: "7d",
    });
}

export function verifyAccessToken(token: string): TokenPayload {
    const decoded = jwt.verify(token, getAccessSecret());

    if (
        typeof decoded !== "object" ||
        decoded === null ||
        decoded.type !== "access" ||
        typeof decoded.userId !== "string"
    ) {
        throw new Error("Invalid access token.");
    }

    return decoded as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
    const decoded = jwt.verify(token, getRefreshSecret());

    if (
        typeof decoded !== "object" ||
        decoded === null ||
        decoded.type !== "refresh" ||
        typeof decoded.userId !== "string"
    ) {
        throw new Error("Invalid refresh token.");
    }

    return decoded as TokenPayload;
}