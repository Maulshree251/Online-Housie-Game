import { Request, Response } from "express";
import { GameManager } from "../game/gameManager";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { generateTicketLayout } from "../tickets/ticketGenerator";

export class GameController {
    constructor(private gameManager: GameManager) { }

    public getCurrentGame = async (
        req: Request,
        res: Response
    ): Promise<void> => {
        try {
            const waitingGame = this.gameManager.getWaitingGame();

            if (!waitingGame) {
                res.status(404).json({
                    success: false,
                    error: {
                        code: "NO_CURRENT_GAME",
                        message: "No current game is available.",
                    },
                });
                return;
            }

            const game = waitingGame.getGame();

            res.status(200).json({
                success: true,
                data: {
                    id: game.id,
                    status: game.status,
                    hostPlayerId: game.hostPlayerId,
                    createdAt: game.createdAt,
                    playerCount: game.playerTickets.length,
                    maxPlayers: game.config.maxPlayers,
                    minPlayers: game.config.minPlayers,
                },
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: {
                    code: "GAME_FETCH_FAILED",
                    message: "Unable to fetch current game.",
                },
            });
        }
    };

    public getGameById = async (
        req: Request,
        res: Response
    ): Promise<void> => {
        try {
            const gameId = req.params.gameId as string;

            const gameEngine = this.gameManager.getGame(gameId);
            const game = gameEngine.getGame();

            res.status(200).json({
                success: true,
                data: {
                    id: game.id,
                    status: game.status,
                    hostPlayerId: game.hostPlayerId,
                    createdAt: game.createdAt,
                    startedAt: game.startedAt,
                    completedAt: game.completedAt,
                    currentRound: game.currentRound,
                    roundStartedAt: game.roundStartedAt,
                    numbersAnnouncedThisRound: game.numbersAnnouncedThisRound,
                    playerCount: game.playerTickets.length,
                    maxPlayers: game.config.maxPlayers,
                    minPlayers: game.config.minPlayers,
                },
            });
        } catch (error) {
            res.status(404).json({
                success: false,
                error: {
                    code: "GAME_NOT_FOUND",
                    message: "Game not found.",
                },
            });
        }
    };

    public joinGame = async (
        req: AuthenticatedRequest,
        res: Response
    ): Promise<void> => {
        try {
            if (!req.userId) {
                res.status(401).json({
                    success: false,
                    error: {
                        code: "UNAUTHENTICATED",
                        message: "Authentication required.",
                    },
                });
                return;
            }

            const gameId = req.params.gameId as string;

            const gameEngine = this.gameManager.getGame(gameId);
            const game = gameEngine.getGame();

            // Game must still be accepting players
            if (game.status !== "WAITING") {
                res.status(409).json({
                    success: false,
                    error: {
                        code: "GAME_NOT_WAITING",
                        message: "Game is no longer accepting players.",
                    },
                });
                return;
            }

            // Check if player has already joined
            const alreadyJoined = game.playerTickets.some(
                (player) => player.playerId === req.userId
            );

            if (alreadyJoined) {
                res.status(409).json({
                    success: false,
                    error: {
                        code: "PLAYER_ALREADY_JOINED",
                        message: "Player has already joined this game.",
                    },
                });
                return;
            }

            // Generate the player's ticket
            const ticket = generateTicketLayout();

            gameEngine.addPlayerTicket(req.userId, ticket);

            // First player becomes host
            if (!gameEngine.getHostPlayerId()) {
                gameEngine.assignHost(req.userId);
            }

            await this.gameManager.saveGame(gameId);

            const updatedGame = gameEngine.getGame();

            res.status(200).json({
                success: true,
                data: {
                    gameId: updatedGame.id,
                    playerId: req.userId,
                    isHost: updatedGame.hostPlayerId === req.userId,
                    ticket,
                },
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: {
                    code: "JOIN_GAME_FAILED",
                    message:
                        error instanceof Error
                            ? error.message
                            : "Unable to join game.",
                },
            });
        }
    };

    public leaveGame = async (
        req: AuthenticatedRequest,
        res: Response
    ): Promise<void> => {
        try {
            if (!req.userId) {
                res.status(401).json({
                    success: false,
                    error: {
                        code: "UNAUTHENTICATED",
                        message: "Authentication required.",
                    },
                });
                return;
            }

            const gameId = req.params.gameId as string;

            const gameEngine = this.gameManager.getGame(gameId);

            gameEngine.removePlayer(req.userId);

            await this.gameManager.saveGame(gameId);

            res.status(200).json({
                success: true,
                data: {
                    gameId,
                    playerId: req.userId,
                    message: "Player left the game successfully.",
                },
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: {
                    code: "LEAVE_GAME_FAILED",
                    message:
                        error instanceof Error
                            ? error.message
                            : "Unable to leave game.",
                },
            });
        }
    };

    public getPlayers = async (
        req: Request,
        res: Response
    ): Promise<void> => {
        try {
            const gameId = req.params.gameId as string;

            const gameEngine = this.gameManager.getGame(gameId);
            const game = gameEngine.getGame();

            const players = game.playerTickets.map((player) => ({
                playerId: player.playerId,
                isHost: player.playerId === game.hostPlayerId,
            }));

            res.status(200).json({
                success: true,
                data: {
                    gameId: game.id,
                    players,
                    playerCount: players.length,
                },
            });
        } catch (error) {
            res.status(404).json({
                success: false,
                error: {
                    code: "GAME_NOT_FOUND",
                    message: "Game not found.",
                },
            });
        }
    };

    public getMyTicket = async (
        req: AuthenticatedRequest,
        res: Response
    ): Promise<void> => {
        try {
            if (!req.userId) {
                res.status(401).json({
                    success: false,
                    error: {
                        code: "UNAUTHENTICATED",
                        message: "Authentication required.",
                    },
                });
                return;
            }

            const gameId = req.params.gameId as string;

            const gameEngine = this.gameManager.getGame(gameId);
            const game = gameEngine.getGame();

            const player = game.playerTickets.find(
                (player) => player.playerId === req.userId
            );

            if (!player) {
                res.status(403).json({
                    success: false,
                    error: {
                        code: "PLAYER_NOT_IN_GAME",
                        message: "You are not a player in this game.",
                    },
                });
                return;
            }

            res.status(200).json({
                success: true,
                data: {
                    gameId: game.id,
                    playerId: req.userId,
                    ticket: player.ticket,
                    markedNumbers: Array.from(player.markedNumbers),
                },
            });
        } catch (error) {
            res.status(404).json({
                success: false,
                error: {
                    code: "GAME_NOT_FOUND",
                    message: "Game not found.",
                },
            });
        }
    };

    public markNumber = async (
        req: AuthenticatedRequest,
        res: Response
    ): Promise<void> => {
        try {
            if (!req.userId) {
                res.status(401).json({
                    success: false,
                    error: {
                        code: "UNAUTHENTICATED",
                        message: "Authentication required."
                    }
                });
                return;
            }

            const gameId = req.params.gameId as string;
            const number = req.body.number as number;

            // Basic request validation
            if (!Number.isInteger(number) || number < 1 || number > 90) {
                res.status(400).json({
                    success: false,
                    error: {
                        code: "INVALID_NUMBER",
                        message: "Number must be an integer between 1 and 90."
                    }
                });
                return;
            }

            const gameEngine = this.gameManager.getGame(gameId);

            // Check that the authenticated player belongs to this game
            const game = gameEngine.getGame();

            const player = game.playerTickets.find(
                (player) => player.playerId === req.userId
            );

            if (!player) {
                res.status(403).json({
                    success: false,
                    error: {
                        code: "PLAYER_NOT_IN_GAME",
                        message: "You are not a player in this game."
                    }
                });
                return;
            }

            // GameEngine remains the authority for gameplay rules
            gameEngine.markNumber(req.userId, number);

            await this.gameManager.saveGame(gameId);

            res.status(200).json({
                success: true,
                data: {
                    gameId,
                    number,
                    marked: true
                }
            });
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Unable to mark number.";

            if (message === "Game is not active.") {
                res.status(409).json({
                    success: false,
                    error: {
                        code: "GAME_NOT_ACTIVE",
                        message
                    }
                });
                return;
            }

            if (message === "Number has not been announced.") {
                res.status(400).json({
                    success: false,
                    error: {
                        code: "NUMBER_NOT_ANNOUNCED",
                        message
                    }
                });
                return;
            }

            if (message === "Number is not on the player's ticket.") {
                res.status(400).json({
                    success: false,
                    error: {
                        code: "NUMBER_NOT_ON_TICKET",
                        message
                    }
                });
                return;
            }

            if (message === "Player is not part of this game.") {
                res.status(403).json({
                    success: false,
                    error: {
                        code: "PLAYER_NOT_IN_GAME",
                        message
                    }
                });
                return;
            }

            if (message === "Game not found.") {
                res.status(404).json({
                    success: false,
                    error: {
                        code: "GAME_NOT_FOUND",
                        message
                    }
                });
                return;
            }

            console.error("Mark number error:", error);

            res.status(500).json({
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: error instanceof Error ? error.message : String(error)
                }
            });
        }
    };
}