import mongoose, {
    Schema,
    Document,
} from "mongoose";

export interface PasswordResetTokenDocument
    extends Document {

    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    usedAt: Date | null;
    createdAt: Date;
}

const passwordResetTokenSchema =
    new Schema<PasswordResetTokenDocument>(
        {
            id: {
                type: String,
                required: true,
                unique: true,
            },

            userId: {
                type: String,
                required: true,
                index: true,
            },

            tokenHash: {
                type: String,
                required: true,
                unique: true,
            },

            expiresAt: {
                type: Date,
                required: true,
                index: true,
            },

            usedAt: {
                type: Date,
                default: null,
            },

            createdAt: {
                type: Date,
                default: Date.now,
            },
        }
    );

export const PasswordResetTokenModel =
    mongoose.model<PasswordResetTokenDocument>(
        "PasswordResetToken",
        passwordResetTokenSchema
    );