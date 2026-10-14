
jest.mock("uuid", () => ({
    v4: jest.fn(() => "test-generated-uuid"),
}));

const mockGame = {
    id: "test-game-id",
    status: "WAITING",
    hostPlayerId: undefined as string | undefined,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    startedAt: undefined as Date | undefined,
    completedAt: undefined as Date | undefined,
    currentRound: 0,
    roundStartedAt: undefined as Date | undefined,
    numbersAnnouncedThisRound: 0,
    announcedNumbers: [] as number[],
    remainingNumbers: Array.from({ length: 90 }, (_, i) => i + 1),
    config: { minPlayers: 2, maxPlayers: 20 },
    playerTickets: [] as any[],
    winners: [] as any[],
};

const mockGameEngine = {
    getGame: jest.fn(() => mockGame),
    getHostPlayerId: jest.fn(() => mockGame.hostPlayerId),
    assignHost: jest.fn((id: string) => {
        mockGame.hostPlayerId = id;
    }),
    addPlayerTicket: jest.fn((playerId: string, ticket: any) => {
        mockGame.playerTickets.push({
            playerId,
            ticket,
            markedNumbers: new Set<number>(),
        });
    }),
    removePlayer: jest.fn((playerId: string) => {
        mockGame.playerTickets = mockGame.playerTickets.filter(
            (p) => p.playerId !== playerId
        );
    }),
    markNumber: jest.fn(),
    claimWinner: jest.fn(),
};


const mockGameManager = {
    getGame: jest.fn(() => mockGameEngine),
    getActiveGame: jest.fn(() => null),
    getWaitingGame: jest.fn(() => ({
        getGame: () => mockGame,
    })),
    saveGame: jest.fn().mockResolvedValue(undefined),
};


const mockGameRepository = {
    findCompletedGames: jest.fn().mockResolvedValue([]),
    findCompletedGameById: jest.fn().mockResolvedValue(null),
};

jest.mock("../game/gameManager", () => ({
    GameManager: jest.fn().mockImplementation(() => mockGameManager),
}));

jest.mock("../repositories/gameRepository", () => ({
    GameRepository: jest.fn().mockImplementation(() => mockGameRepository),
}));

import request from "supertest";
import { Express } from "express";
import { createApp } from "../app";
import { generateAccessToken } from "../auth/tokenService";

describe("Other Game API endpoints", () => {
    let app: Express;
    let token: string;

    const auth = () => ({
        Authorization: `Bearer ${token}`,
    });

    beforeAll(() => {
        const testApp = createApp();
        app = testApp.app;
        token = generateAccessToken("api-test-user");
    });

    beforeEach(() => {
        mockGame.status = "WAITING";
        mockGame.hostPlayerId = undefined;
        mockGame.startedAt = undefined;
        mockGame.completedAt = undefined;
        mockGame.currentRound = 0;
        mockGame.roundStartedAt = undefined;
        mockGame.numbersAnnouncedThisRound = 0;
        mockGame.announcedNumbers = [];
        mockGame.remainingNumbers = Array.from(
            { length: 90 },
            (_, i) => i + 1
        );
        mockGame.playerTickets = [];
        mockGame.winners = [];

        mockGameEngine.getGame.mockImplementation(() => mockGame);
        mockGameEngine.getHostPlayerId.mockImplementation(
            () => mockGame.hostPlayerId
        );
        mockGameEngine.assignHost.mockImplementation((id: string) => {
            mockGame.hostPlayerId = id;
        });
        mockGameEngine.addPlayerTicket.mockImplementation(
            (playerId: string, ticket: any) => {
                mockGame.playerTickets.push({
                    playerId,
                    ticket,
                    markedNumbers: new Set<number>(),
                });
            }
        );
        mockGameEngine.removePlayer.mockImplementation(
            (playerId: string) => {
                mockGame.playerTickets = mockGame.playerTickets.filter(
                    (p) => p.playerId !== playerId
                );
            }
        );

        mockGameManager.getGame.mockReturnValue(mockGameEngine);
        mockGameManager.getWaitingGame.mockReturnValue({
            getGame: () => mockGame,
        } as any);
        mockGameManager.saveGame.mockResolvedValue(undefined);

        mockGameRepository.findCompletedGames.mockResolvedValue([]);
        mockGameRepository.findCompletedGameById.mockResolvedValue(null);

        jest.clearAllMocks();

        mockGameManager.getActiveGame.mockReturnValue(null);

        // Restore implementations after clearing recorded calls.
        mockGameEngine.getGame.mockImplementation(() => mockGame);
        mockGameEngine.getHostPlayerId.mockImplementation(
            () => mockGame.hostPlayerId
        );
        mockGameEngine.assignHost.mockImplementation((id: string) => {
            mockGame.hostPlayerId = id;
        });
        mockGameEngine.addPlayerTicket.mockImplementation(
            (playerId: string, ticket: any) => {
                mockGame.playerTickets.push({
                    playerId,
                    ticket,
                    markedNumbers: new Set<number>(),
                });
            }
        );
        mockGameEngine.removePlayer.mockImplementation(
            (playerId: string) => {
                mockGame.playerTickets = mockGame.playerTickets.filter(
                    (p) => p.playerId !== playerId
                );
            }
        );
        mockGameManager.getGame.mockReturnValue(mockGameEngine);
        mockGameManager.getWaitingGame.mockReturnValue({
            getGame: () => mockGame,
        } as any);
        mockGameManager.saveGame.mockResolvedValue(undefined);
        mockGameRepository.findCompletedGames.mockResolvedValue([]);
        mockGameRepository.findCompletedGameById.mockResolvedValue(null);
    });

    // CURRENT GAME

    it("returns the current waiting game", async () => {
        const res = await request(app).get("/api/games/current");
        console.log("CURRENT GAME RESPONSE:", res.status, res.body);
        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe("test-game-id");
        expect(res.body.data.status).toBe("WAITING");
    });


    it("returns 404 when there is no current game", async () => {
        mockGameManager.getActiveGame.mockReturnValue(null);
        mockGameManager.getWaitingGame.mockReturnValue(null as any);

        const res = await request(app).get("/api/games/current");

        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe("GAME_NOT_FOUND");
    });


    // JOIN GAME

    it("allows an authenticated player to join a waiting game", async () => {
        const res = await request(app)
            .post("/api/games/test-game-id/join")
            .set(auth());

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.playerId).toBe("api-test-user");
        expect(mockGameEngine.addPlayerTicket).toHaveBeenCalled();
        expect(mockGameManager.saveGame).toHaveBeenCalledWith("test-game-id");
    });

    it("makes the first joining player the host", async () => {
        const res = await request(app)
            .post("/api/games/test-game-id/join")
            .set(auth());

        expect(res.status).toBe(200);
        expect(mockGame.hostPlayerId).toBe("api-test-user");
        expect(res.body.data.isHost).toBe(true);
    });

    it("rejects joining without authentication", async () => {
        const res = await request(app).post(
            "/api/games/test-game-id/join"
        );

        expect(res.status).toBe(401);
    });

    it("rejects joining a game that is already active", async () => {
        mockGame.status = "ACTIVE";

        const res = await request(app)
            .post("/api/games/test-game-id/join")
            .set(auth());

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe("GAME_NOT_WAITING");
    });

    it("rejects a player who has already joined", async () => {
        mockGame.playerTickets.push({
            playerId: "api-test-user",
            ticket: {},
            markedNumbers: new Set<number>(),
        });

        const res = await request(app)
            .post("/api/games/test-game-id/join")
            .set(auth());

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe("PLAYER_ALREADY_JOINED");
    });

    it("returns an error if saving a joined game fails", async () => {
        mockGameManager.saveGame.mockRejectedValueOnce(
            new Error("Database unavailable")
        );

        const res = await request(app)
            .post("/api/games/test-game-id/join")
            .set(auth());

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("JOIN_GAME_FAILED");
    });

    // LEAVE GAME

    it("allows an authenticated player to leave a game", async () => {
        mockGame.playerTickets.push({
            playerId: "api-test-user",
            ticket: {},
            markedNumbers: new Set<number>(),
        });

        const res = await request(app)
            .post("/api/games/test-game-id/leave")
            .set(auth());

        expect(res.status).toBe(200);
        expect(mockGameEngine.removePlayer).toHaveBeenCalledWith(
            "api-test-user"
        );
        expect(mockGameManager.saveGame).toHaveBeenCalled();
    });

    it("rejects leaving without authentication", async () => {
        const res = await request(app).post(
            "/api/games/test-game-id/leave"
        );

        expect(res.status).toBe(401);
    });

    it("returns an error if leaving the game fails", async () => {
        mockGameEngine.removePlayer.mockImplementationOnce(() => {
            throw new Error("Player cannot leave");
        });

        const res = await request(app)
            .post("/api/games/test-game-id/leave")
            .set(auth());

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("LEAVE_GAME_FAILED");
    });

    // GAME DETAILS AND PLAYERS

    it("returns public game details by ID", async () => {
        const res = await request(app).get(
            "/api/games/test-game-id"
        );

        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe("test-game-id");
        expect(res.body.data.playerCount).toBe(0);
    });

    it("returns 404 for a game that cannot be found", async () => {
        mockGameManager.getGame.mockImplementationOnce(() => {
            throw new Error("Game not found.");
        });

        const res = await request(app).get(
            "/api/games/missing-game"
        );

        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe("GAME_NOT_FOUND");
    });

    it("returns players without exposing their tickets", async () => {
        mockGame.hostPlayerId = "api-test-user";
        mockGame.playerTickets.push(
            {
                playerId: "api-test-user",
                ticket: { numbers: [1, 2, 3] },
                markedNumbers: new Set<number>(),
            },
            {
                playerId: "another-user",
                ticket: { numbers: [4, 5, 6] },
                markedNumbers: new Set<number>(),
            }
        );

        const res = await request(app).get(
            "/api/games/test-game-id/players"
        );

        expect(res.status).toBe(200);
        expect(res.body.data.playerCount).toBe(2);
        expect(res.body.data.players[0].isHost).toBe(true);
        expect(res.body.data.players[0]).not.toHaveProperty("ticket");
    });

    it("returns the authenticated player's ticket", async () => {
        const ticket = { numbers: [1, 2, 3] };
        mockGame.playerTickets.push({
            playerId: "api-test-user",
            ticket,
            markedNumbers: new Set([1, 2]),
        });

        const res = await request(app)
            .get("/api/games/test-game-id/my-ticket")
            .set(auth());

        expect(res.status).toBe(200);
        expect(res.body.data.ticket).toEqual(ticket);
        expect(res.body.data.markedNumbers).toEqual(
            expect.arrayContaining([1, 2])
        );
    });

    it("does not return another player's ticket", async () => {
        mockGame.playerTickets.push({
            playerId: "another-user",
            ticket: { numbers: [1, 2, 3] },
            markedNumbers: new Set<number>(),
        });

        const res = await request(app)
            .get("/api/games/test-game-id/my-ticket")
            .set(auth());

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe("PLAYER_NOT_IN_GAME");
    });

    // MARK NUMBER

    it("marks a valid number through the game engine", async () => {
        mockGame.status = "ACTIVE";
        mockGame.playerTickets.push({
            playerId: "api-test-user",
            ticket: {},
            markedNumbers: new Set<number>(),
        });

        const res = await request(app)
            .post("/api/games/test-game-id/mark")
            .set(auth())
            .send({ number: 25 });

        expect(res.status).toBe(200);
        expect(res.body.data.marked).toBe(true);
        expect(mockGameEngine.markNumber).toHaveBeenCalledWith(
            "api-test-user",
            25
        );
        expect(mockGameManager.saveGame).toHaveBeenCalledWith(
            "test-game-id"
        );
    });

    it.each([0, 91, -1, 1.5, "25", null])(
        "rejects invalid number input: %p",
        async (number) => {
            const res = await request(app)
                .post("/api/games/test-game-id/mark")
                .set(auth())
                .send({ number });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe("INVALID_NUMBER");
        }
    );

    it("rejects marking when the player is not in the game", async () => {
        const res = await request(app)
            .post("/api/games/test-game-id/mark")
            .set(auth())
            .send({ number: 25 });

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe("PLAYER_NOT_IN_GAME");
    });

    it("maps an inactive game error correctly", async () => {
        mockGame.playerTickets.push({
            playerId: "api-test-user",
            ticket: {},
            markedNumbers: new Set<number>(),
        });
        mockGameEngine.markNumber.mockImplementationOnce(() => {
            throw new Error("Game is not active.");
        });

        const res = await request(app)
            .post("/api/games/test-game-id/mark")
            .set(auth())
            .send({ number: 25 });

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe("GAME_NOT_ACTIVE");
    });

    it("maps an unannounced number error correctly", async () => {
        mockGame.playerTickets.push({
            playerId: "api-test-user",
            ticket: {},
            markedNumbers: new Set<number>(),
        });
        mockGameEngine.markNumber.mockImplementationOnce(() => {
            throw new Error("Number has not been announced.");
        });

        const res = await request(app)
            .post("/api/games/test-game-id/mark")
            .set(auth())
            .send({ number: 25 });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("NUMBER_NOT_ANNOUNCED");
    });

    // WINNERS AND CATEGORIES

    it("returns all five winning categories", async () => {
        const res = await request(app).get(
            "/api/games/test-game-id/winning-categories"
        );

        expect(res.status).toBe(200);
        expect(res.body.data.categories).toHaveLength(5);
        expect(
            res.body.data.categories.map((c: any) => c.type)
        ).toEqual([
            "FIRST_5",
            "ONE_LINE",
            "TWO_LINES",
            "THREE_LINES",
            "FULL_HOUSE",
        ]);
    });

    it("marks a winning category as claimed when a winner exists", async () => {
        mockGame.winners.push({
            playerId: "api-test-user",
            type: "FIRST_5",
            wonAt: new Date().toISOString(),
        });

        const res = await request(app).get(
            "/api/games/test-game-id/winning-categories"
        );

        expect(res.status).toBe(200);
        expect(
            res.body.data.categories.find(
                (c: any) => c.type === "FIRST_5"
            ).claimed
        ).toBe(true);
    });

    it("returns the game's winners", async () => {
        const winner = {
            playerId: "api-test-user",
            type: "FIRST_5",
            wonAt: new Date().toISOString(),
        };
        mockGame.winners.push(winner);

        const res = await request(app).get(
            "/api/games/test-game-id/winners"
        );

        expect(res.status).toBe(200);
        expect(res.body.data.winners).toHaveLength(1);
        expect(res.body.data.winners[0].playerId).toBe(
            "api-test-user"
        );
    });

    // COMPLETED GAME HISTORY

    it("returns an empty history when no games are completed", async () => {
        const res = await request(app).get("/api/games/history");

        expect(res.status).toBe(200);
        expect(res.body.data.games).toEqual([]);
    });

    it("returns completed games from the repository", async () => {
        mockGame.status = "COMPLETED";
        mockGame.completedAt = new Date("2026-01-02T00:00:00Z");
        mockGame.playerTickets.push({
            playerId: "api-test-user",
            ticket: {},
            markedNumbers: new Set<number>(),
        });
        mockGameRepository.findCompletedGames.mockResolvedValueOnce([
            mockGame,
        ]);

        const res = await request(app).get("/api/games/history");

        expect(res.status).toBe(200);
        expect(res.body.data.games).toHaveLength(1);
        expect(res.body.data.games[0].id).toBe("test-game-id");
        expect(res.body.data.games[0].playerCount).toBe(1);
    });

    it("returns a completed game by its ID", async () => {
        mockGame.status = "COMPLETED";
        mockGameRepository.findCompletedGameById.mockResolvedValueOnce(
            mockGame
        );

        const res = await request(app).get(
            "/api/games/history/test-game-id"
        );

        expect(res.status).toBe(200);
        expect(res.body.data.game.id).toBe("test-game-id");
        expect(mockGameRepository.findCompletedGameById)
            .toHaveBeenCalledWith("test-game-id");
    });

    it("returns 404 when a completed game is absent from history", async () => {
        const res = await request(app).get(
            "/api/games/history/missing-game"
        );

        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe("GAME_NOT_FOUND");
    });

    it("returns 500 if loading game history fails", async () => {
        mockGameRepository.findCompletedGames.mockRejectedValueOnce(
            new Error("Database unavailable")
        );

        const res = await request(app).get("/api/games/history");

        expect(res.status).toBe(500);
        expect(res.body.error.code).toBe("INTERNAL_ERROR");
    });
});
