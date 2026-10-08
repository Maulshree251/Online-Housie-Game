import crypto from "crypto";

import {
    PasswordResetTokenModel,
    PasswordResetTokenDocument,
} from "../database/models/passwordResetTokenModel";

import {
    PasswordResetToken,
} from "../models/passwordResetToken";

function hashToken(token: string): string {
    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
}

export class PasswordResetTokenRepository {

    public async create(
        resetToken: PasswordResetToken,
        rawToken: string
    ): Promise<PasswordResetToken> {

        const document =
            await PasswordResetTokenModel.create({
                id: resetToken.id,
                userId: resetToken.userId,
                tokenHash: hashToken(rawToken),
                expiresAt: resetToken.expiresAt,
                usedAt: resetToken.usedAt,
                createdAt: resetToken.createdAt,
            });

        return this.databaseToToken(document);
    }

    public async findValidByToken(
        rawToken: string
    ): Promise<PasswordResetToken | null> {

        const tokenHash =
            hashToken(rawToken);

        const document =
            await PasswordResetTokenModel.findOne({
                tokenHash,
                usedAt: null,
                expiresAt: {
                    $gt: new Date(),
                },
            });

        if (!document) {
            return null;
        }

        return this.databaseToToken(document);
    }

    public async markUsed(
        id: string
    ): Promise<void> {

        await PasswordResetTokenModel.updateOne(
            {
                id,
                usedAt: null,
            },
            {
                $set: {
                    usedAt: new Date(),
                },
            }
        );
    }

    public async invalidateUserTokens(
        userId: string
    ): Promise<void> {

        await PasswordResetTokenModel.updateMany(
            {
                userId,
                usedAt: null,
            },
            {
                $set: {
                    usedAt: new Date(),
                },
            }
        );
    }

    private databaseToToken(
        document: PasswordResetTokenDocument
    ): PasswordResetToken {

        return {
            id: document.id,
            userId: document.userId,
            tokenHash: document.tokenHash,
            expiresAt: document.expiresAt,
            usedAt: document.usedAt,
            createdAt: document.createdAt,
        };
    }
}