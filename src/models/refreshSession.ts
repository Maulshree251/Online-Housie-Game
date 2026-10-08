export interface RefreshSession {
  id: string;
  userId: string;
  refreshTokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}