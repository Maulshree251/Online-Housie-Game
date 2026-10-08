import crypto from "crypto";
import { RefreshSessionRepository } from "../repositories/refreshSessionRepository";
import { verifyPassword } from "./passwordService";
import { User } from "../models/user";
import { UserRepository } from "../repositories/userRepository";
import { PasswordResetTokenRepository } from "../repositories/passwordResetTokenRepository";
import { hashPassword } from "./passwordService";
import { v4 as uuidv4 } from "uuid";
import {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken,
} from "./tokenService";

export interface RegisterInput {
    name: string;
    email: string;
    password: string;
}

export interface LoginInput {
    email: string;
    password: string;
}

export class AuthService {

    constructor(
        private userRepository: UserRepository,
        private refreshSessionRepository: RefreshSessionRepository,
        private passwordResetTokenRepository: PasswordResetTokenRepository
    ) { }

    public async register(
        input: RegisterInput
    ): Promise<User> {

        const name = input.name.trim();
        const email = input.email
            .trim()
            .toLowerCase();

        if (!name) {
            throw new Error("Name is required.");
        }

        if (!email) {
            throw new Error("Email is required.");
        }

        if (!input.password) {
            throw new Error("Password is required.");
        }

        if (input.password.length < 8) {
            throw new Error(
                "Password must be at least 8 characters."
            );
        }

        const existingUser =
            await this.userRepository.findByEmail(email);

        if (existingUser) {
            throw new Error(
                "An account with this email already exists."
            );
        }

        const passwordHash =
            await hashPassword(input.password);

        const user: User = {
            id: crypto.randomUUID(),
            name,
            email,
            passwordHash,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        return this.userRepository.create(user);
    }

    public async login(input: LoginInput) {

        const email = input.email?.trim().toLowerCase();
        const password = input.password;

        if (!email || !password) {
            throw new Error("Email and password are required.");
        }

        const user =
            await this.userRepository.findByEmail(email);

        if (!user) {
            throw new Error("Invalid email or password.");
        }

        const passwordValid =
            await verifyPassword(
                password,
                user.passwordHash
            );

        if (!passwordValid) {
            throw new Error("Invalid email or password.");
        }

        const accessToken =
            generateAccessToken(user.id);

        const refreshToken =
            generateRefreshToken(user.id);

        const refreshSessionId =
            uuidv4();

        const now = new Date();

        const expiresAt = new Date(
            now.getTime() +
            7 * 24 * 60 * 60 * 1000
        );

        await this.refreshSessionRepository.create(
            {
                id: refreshSessionId,
                userId: user.id,
                refreshTokenHash: refreshToken,
                createdAt: now,
                expiresAt,
                revokedAt: null,
            }
        );

        return {
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                createdAt: user.createdAt,
            },
        };
    }

    public async getCurrentUser(userId: string) {
        const user = await this.userRepository.findById(userId);

        if (!user) {
            throw new Error("User not found.");
        }

        return {
            id: user.id,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt,
        };
    }

    public async refresh(refreshToken: string) {

        if (!refreshToken) {
            throw new Error("Refresh token is required.");
        }

        let payload;

        try {
            payload = verifyRefreshToken(refreshToken);
        } catch {
            throw new Error("Invalid or expired refresh token.");
        }

        const session =
            await this.refreshSessionRepository.findActiveByToken(
                refreshToken
            );

        if (!session) {
            throw new Error(
                "Refresh token is invalid or has been revoked."
            );
        }

        if (session.userId !== payload.userId) {
            throw new Error("Invalid refresh token.");
        }

        // Revoke the old refresh session
        await this.refreshSessionRepository.revoke(
            session.id
        );

        // Generate a completely new token pair
        const newAccessToken =
            generateAccessToken(payload.userId);

        const newRefreshToken =
            generateRefreshToken(payload.userId);

        const newSessionId = uuidv4();

        const now = new Date();

        const expiresAt = new Date(
            now.getTime() +
            7 * 24 * 60 * 60 * 1000
        );

        await this.refreshSessionRepository.create(
            {
                id: newSessionId,
                userId: payload.userId,
                refreshTokenHash: newRefreshToken,
                createdAt: now,
                expiresAt,
                revokedAt: null,
            }
        );

        return {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
        };
    }

    public async logout(refreshToken: string): Promise<void> {

        if (!refreshToken) {
            throw new Error("Refresh token is required.");
        }

        const session =
            await this.refreshSessionRepository.findActiveByToken(
                refreshToken
            );

        // Make logout idempotent.
        // Even if the token is already revoked/invalid,
        // we don't reveal whether the session existed.
        if (!session) {
            return;
        }

        await this.refreshSessionRepository.revoke(
            session.id
        );
    }

    public async changePassword(
        userId: string,
        currentPassword: string,
        newPassword: string
    ): Promise<void> {

        if (!currentPassword || !newPassword) {
            throw new Error(
                "Current password and new password are required."
            );
        }

        if (newPassword.length < 8) {
            throw new Error(
                "New password must be at least 8 characters."
            );
        }

        if (currentPassword === newPassword) {
            throw new Error(
                "New password must be different from the current password."
            );
        }

        const user =
            await this.userRepository.findById(userId);

        if (!user) {
            throw new Error("User not found.");
        }

        const currentPasswordValid =
            await verifyPassword(
                currentPassword,
                user.passwordHash
            );

        if (!currentPasswordValid) {
            throw new Error(
                "Current password is incorrect."
            );
        }

        const newPasswordHash =
            await hashPassword(newPassword);

        await this.userRepository.updatePassword(
            userId,
            newPasswordHash
        );

        await this.refreshSessionRepository.revokeAllForUser(
            userId
        );
    }

    public async forgotPassword(
        email: string
    ) {

        const normalizedEmail =
            email?.trim().toLowerCase();

        if (!normalizedEmail) {
            throw new Error("Email is required.");
        }

        const user =
            await this.userRepository.findByEmail(
                normalizedEmail
            );

        /*
         * In production, don't reveal whether
         * an email exists in the database.
         *
         * For our development/testing phase,
         * we return the token so Postman can test
         * the complete reset flow.
         */
        if (!user) {
            throw new Error("User not found.");
        }

        // Invalidate any previous reset tokens
        await this.passwordResetTokenRepository
            .invalidateUserTokens(user.id);

        // Generate a cryptographically secure token
        const resetToken =
            crypto.randomBytes(32).toString("hex");

        const now = new Date();

        // Token valid for 15 minutes
        const expiresAt =
            new Date(
                now.getTime() +
                15 * 60 * 1000
            );

        const resetTokenId =
            uuidv4();

        await this.passwordResetTokenRepository.create(
            {
                id: resetTokenId,
                userId: user.id,
                tokenHash: "",
                expiresAt,
                usedAt: null,
                createdAt: now,
            },
            resetToken
        );

        return {
            resetToken,
            expiresAt,
        };
    }

    public async resetPassword(
        resetToken: string,
        newPassword: string
    ): Promise<void> {

        if (!resetToken || !newPassword) {
            throw new Error(
                "Reset token and new password are required."
            );
        }

        if (newPassword.length < 8) {
            throw new Error(
                "Password must be at least 8 characters."
            );
        }

        const resetSession =
            await this.passwordResetTokenRepository
                .findValidByToken(resetToken);

        if (!resetSession) {
            throw new Error(
                "Invalid or expired reset token."
            );
        }

        const user =
            await this.userRepository.findById(
                resetSession.userId
            );

        if (!user) {
            throw new Error("User not found.");
        }

        const newPasswordHash =
            await hashPassword(newPassword);

        await this.userRepository.updatePassword(
            user.id,
            newPasswordHash
        );

        // Reset token can only be used once
        await this.passwordResetTokenRepository
            .markUsed(resetSession.id);

        // Log out every existing session
        await this.refreshSessionRepository
            .revokeAllForUser(user.id);

        // Invalidate any other reset tokens
        await this.passwordResetTokenRepository
            .invalidateUserTokens(user.id);
    }
}

