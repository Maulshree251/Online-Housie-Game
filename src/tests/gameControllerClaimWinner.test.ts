
import { GameController } from "../controllers/gameController";
import { GameManager } from "../game/gameManager";
import { GameRepository } from "../repositories/gameRepository";
import { RealtimeService } from "../realtime/realtimeService";
import { RealtimeEvent } from "../realtime/realtimeEvents";

describe("GameController.claimWinner", () => {
    let controller: GameController;
    let gameManager: {
        getGame: jest.Mock;
        saveGame: jest.Mock;
        ensureWaitingGame: jest.Mock;
    };
    let realtimeService: {
        emitToGame: jest.Mock;
    };
    let gameEngine: {
        getGame: jest.Mock;
        claimWinner: jest.Mock;
    };
    let game: any;
    let req: any;
    let res: any;

    const gameId = "test-game-123";
    const playerId = "player-1";

    beforeEach(() => {
        jest.clearAllMocks();

        game = {
            id: gameId,
            status: "ACTIVE",
            completedAt: null,
            playerTickets: [
                {
                    playerId,
                    ticket: [],
                },
            ],
            winners: [],
        };

        gameEngine = {
            getGame: jest.fn(() => game),
            claimWinner: jest.fn(),
        };

        gameManager = {
            getGame: jest.fn(() => gameEngine),
            saveGame: jest.fn().mockResolvedValue(undefined),
            ensureWaitingGame: jest.fn().mockResolvedValue(undefined),
        };

        realtimeService = {
            emitToGame: jest.fn(),
        };

        controller = new GameController(
            gameManager as unknown as GameManager,
            {} as GameRepository,
            realtimeService as unknown as RealtimeService
        );

        req = {
            userId: playerId,
            params: { gameId },
            body: { type: "FIRST_5" },
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
    });

    it("should return 401 when the user is unauthenticated", async () => {
        req.userId = undefined;

        await controller.claimWinner(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                error: expect.objectContaining({
                    code: "UNAUTHENTICATED",
                }),
            })
        );
        expect(gameManager.getGame).not.toHaveBeenCalled();
    });

    it("should reject an invalid winning category", async () => {
        req.body.type = "INVALID_CATEGORY";

        await controller.claimWinner(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                error: expect.objectContaining({
                    code: "INVALID_WINNER_TYPE",
                }),
            })
        );
        expect(gameManager.getGame).not.toHaveBeenCalled();
    });

    it("should reject a player who is not in the game", async () => {
        req.userId = "unknown-player";

        await controller.claimWinner(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                error: expect.objectContaining({
                    code: "PLAYER_NOT_IN_GAME",
                }),
            })
        );
        expect(gameEngine.claimWinner).not.toHaveBeenCalled();
    });

    it("should reject a claim when the winning condition is not satisfied", async () => {
        gameEngine.claimWinner.mockReturnValue(false);

        await controller.claimWinner(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                error: expect.objectContaining({
                    code: "INVALID_WINNING_CLAIM",
                }),
            })
        );
        expect(gameManager.saveGame).not.toHaveBeenCalled();
        expect(realtimeService.emitToGame).not.toHaveBeenCalled();
    });

    it("should save a valid winner and emit WINNER_CLAIMED", async () => {
        const wonAt = new Date();

        gameEngine.claimWinner.mockImplementation(() => {
            game.winners.push({
                playerId,
                type: "FIRST_5",
                wonAt,
            });
            return true;
        });

        await controller.claimWinner(req, res);

        expect(gameManager.saveGame).toHaveBeenCalledWith(gameId);

        expect(realtimeService.emitToGame).toHaveBeenCalledWith(
            gameId,
            RealtimeEvent.WINNER_CLAIMED,
            expect.objectContaining({
                gameId,
                playerId,
                type: "FIRST_5",
                wonAt,
            })
        );

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    gameId,
                    gameStatus: "ACTIVE",
                }),
            })
        );

        expect(gameManager.ensureWaitingGame).not.toHaveBeenCalled();
    });

    it("should complete the game and create a waiting game after Full House", async () => {
        req.body.type = "FULL_HOUSE";

        const completedAt = new Date();

        gameEngine.claimWinner.mockImplementation(() => {
            game.winners.push({
                playerId,
                type: "FULL_HOUSE",
                wonAt: completedAt,
            });

            game.status = "COMPLETED";
            game.completedAt = completedAt;

            return true;
        });

        await controller.claimWinner(req, res);

        expect(gameManager.saveGame).toHaveBeenCalledWith(gameId);

        expect(realtimeService.emitToGame).toHaveBeenCalledWith(
            gameId,
            RealtimeEvent.WINNER_CLAIMED,
            expect.objectContaining({
                gameId,
                playerId,
                type: "FULL_HOUSE",
            })
        );

        expect(realtimeService.emitToGame).toHaveBeenCalledWith(
            gameId,
            RealtimeEvent.GAME_COMPLETED,
            expect.objectContaining({
                gameId,
                completedAt,
                winner: {
                    playerId,
                    type: "FULL_HOUSE",
                },
            })
        );

        expect(gameManager.ensureWaitingGame).toHaveBeenCalledTimes(1);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    gameStatus: "COMPLETED",
                }),
            })
        );
    });

    it("should return 404 when the game does not exist", async () => {
        gameManager.getGame.mockImplementation(() => {
            throw new Error("Game not found.");
        });

        await controller.claimWinner(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                error: expect.objectContaining({
                    code: "GAME_NOT_FOUND",
                }),
            })
        );
    });
});
