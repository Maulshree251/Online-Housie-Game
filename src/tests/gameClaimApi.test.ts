
jest.mock("uuid", () => ({
    v4: jest.fn(() => "test-generated-uuid"),
}));
jest.mock("../game/gameManager", () => ({
    GameManager: jest.fn().mockImplementation(() => mockGameManager),
}));
import request from "supertest";
import { Express } from "express";
import { createApp } from "../app";
import { generateAccessToken } from "../auth/tokenService";

const mockGame = {
    id: "test-game-id",
    status: "ACTIVE",
    playerTickets: [
        {
            playerId: "api-test-user",
            ticket: {},
        },
    ],
    winners: [],
};

const mockGameEngine = {
    getGame: jest.fn(() => mockGame),
    claimWinner: jest.fn(),
};

const mockGameManager = {
    getGame: jest.fn(() => mockGameEngine),
    saveGame: jest.fn().mockResolvedValue(undefined),
};

describe("POST /api/games/:gameId/claim", () => {
    let app: Express;

    beforeAll(() => {
        const testApp = createApp();
        app = testApp.app;
    });

    it("should reject a claim without an authentication token", async () => {
        const response = await request(app)
            .post("/api/games/test-game-id/claim")
            .send({ type: "FIRST_5" });

        expect(response.status).toBe(401);
    });


    it("should reject a claim with an invalid authentication token", async () => {
        const response = await request(app)
            .post("/api/games/test-game-id/claim")
            .set("Authorization", "Bearer invalid-token")
            .send({ type: "FIRST_5" });

        expect(response.status).toBe(401);
    });

    it("should reject an invalid winning category after authentication", async () => {
        const token = generateAccessToken("api-test-user");

        const response = await request(app)
            .post("/api/games/test-game-id/claim")
            .set("Authorization", `Bearer ${token}`)
            .send({ type: "INVALID_CATEGORY" });

        expect(response.status).toBe(400);
    });

    it("should return success when an authenticated player claims a valid win", async () => {
        const token = generateAccessToken("api-test-user");

        const wonAt = new Date().toISOString();

        mockGame.winners = [
            {
                id: "api-test-user",
                type: "FIRST_5",
                wonAt,
            },
        ] as any;

        mockGameEngine.claimWinner.mockReturnValue(true);

        const response = await request(app)
            .post("/api/games/test-game-id/claim")
            .set("Authorization", `Bearer ${token}`)
            .send({ type: "FIRST_5" });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.gameId).toBe("test-game-id");
        expect(response.body.data.winner.playerId).toBe("api-test-user");
        expect(response.body.data.winner.type).toBe("FIRST_5");
        expect(mockGameManager.saveGame).toHaveBeenCalledWith("test-game-id");
    });

    it("should reject a claim when the game engine says the player has not won", async () => {
        mockGameManager.saveGame.mockClear();
        const token = generateAccessToken("api-test-user");


        mockGameEngine.claimWinner.mockReturnValue(false);

        const response = await request(app)
            .post("/api/games/test-game-id/claim")
            .set("Authorization", `Bearer ${token}`)
            .send({ type: "FIRST_5" });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe("INVALID_WINNING_CLAIM");

        expect(mockGameManager.saveGame).not.toHaveBeenCalled();
    });


    it("should reject a claim from a player who is not in the game", async () => {
        mockGameManager.saveGame.mockClear();

        const token = generateAccessToken("unregistered-user");

        const response = await request(app)
            .post("/api/games/test-game-id/claim")
            .set("Authorization", `Bearer ${token}`)
            .send({ type: "FIRST_5" });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe("PLAYER_NOT_IN_GAME");
        expect(mockGameManager.saveGame).not.toHaveBeenCalled();
    });


    it("should reject a claim when the winning category is already claimed", async () => {
        mockGameManager.saveGame.mockClear();

        const token = generateAccessToken("api-test-user");

        mockGameEngine.claimWinner.mockImplementation(() => {
            throw new Error("FIRST_5 has already been claimed.");
        });

        const response = await request(app)
            .post("/api/games/test-game-id/claim")
            .set("Authorization", `Bearer ${token}`)
            .send({ type: "FIRST_5" });

        expect(response.status).toBe(409);
        expect(response.body.success).toBe(false);
        expect(mockGameManager.saveGame).not.toHaveBeenCalled();
    });


    it("should reject Full House when the other categories are not claimed", async () => {
        mockGameManager.saveGame.mockClear();

        const token = generateAccessToken("api-test-user");

        mockGameEngine.claimWinner.mockImplementation(() => {
            throw new Error(
                "Full House cannot be claimed until all other winning categories have been claimed."
            );
        });

        const response = await request(app)
            .post("/api/games/test-game-id/claim")
            .set("Authorization", `Bearer ${token}`)
            .send({ type: "FULL_HOUSE" });

        expect(response.status).toBe(409);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe("FULL_HOUSE_LOCKED");
        expect(mockGameManager.saveGame).not.toHaveBeenCalled();
    });


    it("should reject a claim when the game is not active", async () => {
        mockGameManager.saveGame.mockClear();

        const token = generateAccessToken("api-test-user");

        mockGameEngine.claimWinner.mockImplementation(() => {
            throw new Error("Game is not active.");
        });

        const response = await request(app)
            .post("/api/games/test-game-id/claim")
            .set("Authorization", `Bearer ${token}`)
            .send({ type: "FIRST_5" });

        expect(response.status).toBe(409);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe("GAME_NOT_ACTIVE");
        expect(mockGameManager.saveGame).not.toHaveBeenCalled();
    });

    it("should return 404 when the game does not exist", async () => {
        mockGameManager.saveGame.mockClear();

        const token = generateAccessToken("api-test-user");

        mockGameManager.getGame.mockImplementationOnce(() => {
            throw new Error("Game not found.");
        });

        const response = await request(app)
            .post("/api/games/nonexistent-game-id/claim")
            .set("Authorization", `Bearer ${token}`)
            .send({ type: "FIRST_5" });

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe("GAME_NOT_FOUND");
        expect(mockGameManager.saveGame).not.toHaveBeenCalled();
    });

    it("should return 500 when saving a winning claim fails", async () => {
        mockGameManager.saveGame.mockRejectedValueOnce(
            new Error("Database save failed.")
        );

        const token = generateAccessToken("api-test-user");

        mockGameEngine.claimWinner.mockReturnValue(true);

        const response = await request(app)
            .post("/api/games/test-game-id/claim")
            .set("Authorization", `Bearer ${token}`)
            .send({ type: "FIRST_5" });

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe("INTERNAL_ERROR");
        expect(mockGameManager.saveGame).toHaveBeenCalledWith(
            "test-game-id"
        );
    });


    it("should handle a missing ticket error from the game engine", async () => {
        mockGameManager.saveGame.mockClear();

        const token = generateAccessToken("api-test-user");

        mockGameEngine.claimWinner.mockImplementationOnce(() => {
            throw new Error("Player ticket not found.");
        });

        const response = await request(app)
            .post("/api/games/test-game-id/claim")
            .set("Authorization", `Bearer ${token}`)
            .send({ type: "FIRST_5" });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe("PLAYER_NOT_IN_GAME");
        expect(mockGameManager.saveGame).not.toHaveBeenCalled();
    });


});
