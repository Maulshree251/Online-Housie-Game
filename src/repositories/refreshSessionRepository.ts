import crypto from "crypto";
import { RefreshSession } from "../models/refreshSession";
import {
  RefreshSessionModel,
  RefreshSessionDocument
} from "../database/models/refreshSessionModel";

function hashToken(token: string): string {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

export class RefreshSessionRepository {

  public async create(
    session: RefreshSession
  ): Promise<RefreshSession> {

    const document = await RefreshSessionModel.create({
      id: session.id,
      userId: session.userId,
      refreshTokenHash: hashToken(session.refreshTokenHash),
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
    });

    return this.databaseToSession(document);
  }

  public async findActiveByToken(
    refreshToken: string
  ): Promise<RefreshSession | null> {

    const tokenHash = hashToken(refreshToken);

    const document = await RefreshSessionModel.findOne({
      refreshTokenHash: tokenHash,
      revokedAt: null,
      expiresAt: {
        $gt: new Date(),
      },
    });

    if (!document) {
      return null;
    }

    return this.databaseToSession(document);
  }

  public async revoke(
    sessionId: string
  ): Promise<void> {

    await RefreshSessionModel.updateOne(
      {
        id: sessionId,
        revokedAt: null,
      },
      {
        $set: {
          revokedAt: new Date(),
        },
      }
    );
  }

  private databaseToSession(
    document: RefreshSessionDocument
  ): RefreshSession {

    return {
      id: document.id,
      userId: document.userId,
      refreshTokenHash: document.refreshTokenHash,
      createdAt: document.createdAt,
      expiresAt: document.expiresAt,
      revokedAt: document.revokedAt,
    };
  }

  public async revokeAllForUser(
    userId: string
  ): Promise<void> {

    await RefreshSessionModel.updateMany(
      {
        userId,
        revokedAt: null,
      },
      {
        $set: {
          revokedAt: new Date(),
        },
      }
    );
  }
}