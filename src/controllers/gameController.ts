import { Request, Response } from "express";
import { GameManager } from "../game/gameManager";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { generateTicketLayout } from "../tickets/ticketGenerator";
import { WinnerType } from "../models/game";
import { GameRepository } from "../repositories/gameRepository";

export class GameController {
    constructor(private gameManager: GameManager, private gameRepository: GameRepository) { }

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

    public getWinningCategories = async (
        req: Request,
        res: Response
    ): Promise<void> => {
        try {
            const gameId = req.params.gameId as string;

            const gameEngine = this.gameManager.getGame(gameId);
            const game = gameEngine.getGame();

            const categories = [
                "FIRST_5",
                "ONE_LINE",
                "TWO_LINES",
                "THREE_LINES",
                "FULL_HOUSE",
            ].map((type) => ({
                type,
                claimed: game.winners.some(
                    (winner) => winner.type === type
                ),
            }));

            res.status(200).json({
                success: true,
                data: {
                    gameId: game.id,
                    categories,
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


    //     req: AuthenticatedRequest,
    //     res: Response
    // ): Promise<void> => {
    //     try {
    //         // -----------------------------------------
    //         // 1. Authentication
    //         // -----------------------------------------
    //         if (!req.userId) {
    //             res.status(401).json({
    //                 success: false,
    //                 error: {
    //                     code: "UNAUTHENTICATED",
    //                     message: "Authentication required.",
    //                 },
    //             });
    //             return;
    //         }

    //         const gameId = req.params.gameId as string;
    //         const { type } = req.body;

    //         // -----------------------------------------
    //         // 2. Validate winner type
    //         // -----------------------------------------
    //         const validWinnerTypes = [
    //             "FIRST_5",
    //             "ONE_LINE",
    //             "TWO_LINES",
    //             "THREE_LINES",
    //             "FULL_HOUSE",
    //         ];

    //         if (!validWinnerTypes.includes(type)) {
    //             res.status(400).json({
    //                 success: false,
    //                 error: {
    //                     code: "INVALID_WINNER_TYPE",
    //                     message: "Invalid winning category.",
    //                 },
    //             });
    //             return;
    //         }

    //         // -----------------------------------------
    //         // 3. Get game
    //         // -----------------------------------------
    //         const gameEngine = this.gameManager.getGame(gameId);

    //         const game = gameEngine.getGame();

    //         // -----------------------------------------
    //         // 4. Make sure authenticated user
    //         //    belongs to the game
    //         // -----------------------------------------
    //         const player = game.playerTickets.find(
    //             (player) => player.playerId === req.userId
    //         );

    //         if (!player) {
    //             res.status(403).json({
    //                 success: false,
    //                 error: {
    //                     code: "PLAYER_NOT_IN_GAME",
    //                     message: "You are not a player in this game.",
    //                 },
    //             });
    //             return;
    //         }

    //         // -----------------------------------------
    //         // 5. Ask GameEngine to verify the claim
    //         // -----------------------------------------
    //         const claimed = gameEngine.claimWinner(
    //             req.userId,
    //             type
    //         );

    //         // -----------------------------------------
    //         // 6. Invalid claim
    //         // -----------------------------------------
    //         if (!claimed) {
    //             res.status(400).json({
    //                 success: false,
    //                 error: {
    //                     code: "INVALID_WINNING_CLAIM",
    //                     message: "The winning condition has not been satisfied.",
    //                 },
    //             });
    //             return;
    //         }

    //         // -----------------------------------------
    //         // 7. Persist winner
    //         // -----------------------------------------
    //         await this.gameManager.saveGame(gameId);

    //         // -----------------------------------------
    //         // 8. Return winner information
    //         // -----------------------------------------
    //         const updatedGame = gameEngine.getGame();

    //         const winner = updatedGame.winners.find(
    //             (winner) =>
    //                 winner.playerId === req.userId &&
    //                 winner.type === type
    //         );

    //         res.status(200).json({
    //             success: true,
    //             data: {
    //                 gameId,
    //                 winner: {
    //                     playerId: req.userId,
    //                     type,
    //                     wonAt: winner?.wonAt,
    //                 },
    //                 gameStatus: updatedGame.status,
    //             },
    //         });
    //     } catch (error) {
    //         const message =
    //             error instanceof Error
    //                 ? error.message
    //                 : "Unable to process winning claim.";

    //         // -----------------------------------------
    //         // Game not found
    //         // -----------------------------------------
    //         if (message === "Game not found.") {
    //             res.status(404).json({
    //                 success: false,
    //                 error: {
    //                     code: "GAME_NOT_FOUND",
    //                     message,
    //                 },
    //             });
    //             return;
    //         }

    //         // -----------------------------------------
    //         // Game is not active
    //         // -----------------------------------------
    //         if (message === "Game is not active.") {
    //             res.status(409).json({
    //                 success: false,
    //                 error: {
    //                     code: "GAME_NOT_ACTIVE",
    //                     message,
    //                 },
    //             });
    //             return;
    //         }

    //         // -----------------------------------------
    //         // Player not found
    //         // -----------------------------------------
    //         if (message === "Player ticket not found.") {
    //             res.status(403).json({
    //                 success: false,
    //                 error: {
    //                     code: "PLAYER_NOT_IN_GAME",
    //                     message: "You are not a player in this game.",
    //                 },
    //             });
    //             return;
    //         }

    //         // -----------------------------------------
    //         // Category already claimed
    //         // -----------------------------------------
    //         if (message.includes("has already been claimed.")) {
    //             res.status(409).json({
    //                 success: false,
    //                 error: {
    //                     code: "CATEGORY_ALREADY_CLAIMED",
    //                     message,
    //                 },
    //             });
    //             return;
    //         }

    //         console.error("Claim winner error:", error);

    //         res.status(500).json({
    //             success: false,
    //             error: {
    //                 code: "INTERNAL_ERROR",
    //                 message: "Unable to process winning claim.",
    //             },
    //         });
    //     }
    // };

    public claimWinner = async (
        req: AuthenticatedRequest,
        res: Response
    ): Promise<void> => {
        try {
            // -----------------------------------------
            // 1. Authentication
            // -----------------------------------------
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

            // -----------------------------------------
            // 2. Get request data
            // -----------------------------------------
            const { gameId } = req.params as { gameId: string };
            const { type } = req.body as { type: WinnerType };

            // -----------------------------------------
            // 3. Validate winner type
            // -----------------------------------------
            const validWinnerTypes: WinnerType[] = [
                "FIRST_5",
                "ONE_LINE",
                "TWO_LINES",
                "THREE_LINES",
                "FULL_HOUSE",
            ];

            if (!validWinnerTypes.includes(type)) {
                res.status(400).json({
                    success: false,
                    error: {
                        code: "INVALID_WINNER_TYPE",
                        message: "Invalid winning category.",
                    },
                });
                return;
            }

            // -----------------------------------------
            // 4. Get game
            // -----------------------------------------
            const gameEngine = this.gameManager.getGame(gameId);
            const game = gameEngine.getGame();

            // -----------------------------------------
            // 5. Make sure user belongs to game
            // -----------------------------------------
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

            // -----------------------------------------
            // 6. Ask GameEngine to verify the claim
            // -----------------------------------------
            const claimed = gameEngine.claimWinner(
                req.userId,
                type
            );

            // -----------------------------------------
            // 7. Invalid claim
            // -----------------------------------------
            if (!claimed) {
                res.status(400).json({
                    success: false,
                    error: {
                        code: "INVALID_WINNING_CLAIM",
                        message: "The winning condition has not been satisfied.",
                    },
                });
                return;
            }

            // -----------------------------------------
            // 8. Persist winner
            // -----------------------------------------
            await this.gameManager.saveGame(gameId);

            const updatedGame = gameEngine.getGame();

            const winner = updatedGame.winners.find(
                (winner) =>
                    winner.playerId === req.userId &&
                    winner.type === type
            );

            // -----------------------------------------
            // 9. Return success
            // -----------------------------------------
            res.status(200).json({
                success: true,
                data: {
                    gameId,
                    winner: {
                        playerId: req.userId,
                        type,
                        wonAt: winner?.wonAt,
                    },
                    gameStatus: updatedGame.status,
                },
            });
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Unable to process winning claim.";

            // -----------------------------------------
            // GAME NOT FOUND
            // -----------------------------------------
            if (message === "Game not found.") {
                res.status(404).json({
                    success: false,
                    error: {
                        code: "GAME_NOT_FOUND",
                        message,
                    },
                });
                return;
            }

            // -----------------------------------------
            // GAME NOT ACTIVE
            // -----------------------------------------
            if (message === "Game is not active.") {
                res.status(409).json({
                    success: false,
                    error: {
                        code: "GAME_NOT_ACTIVE",
                        message,
                    },
                });
                return;
            }

            // -----------------------------------------
            // PLAYER NOT FOUND
            // -----------------------------------------
            if (message === "Player ticket not found.") {
                res.status(403).json({
                    success: false,
                    error: {
                        code: "PLAYER_NOT_IN_GAME",
                        message: "You are not a player in this game.",
                    },
                });
                return;
            }

            // -----------------------------------------
            // CATEGORY ALREADY CLAIMED
            // -----------------------------------------
            if (message.includes("has already been claimed.")) {
                res.status(409).json({
                    success: false,
                    error: {
                        code: "CATEGORY_ALREADY_CLAIMED",
                        message,
                    },
                });
                return;
            }

            // -----------------------------------------
            // FULL HOUSE LOCKED
            // -----------------------------------------
            if (
                message ===
                "Full House cannot be claimed until all other winning categories have been claimed."
            ) {
                res.status(409).json({
                    success: false,
                    error: {
                        code: "FULL_HOUSE_LOCKED",
                        message,
                    },
                });
                return;
            }

            // -----------------------------------------
            // UNEXPECTED ERROR
            // -----------------------------------------
            console.error("Claim winner error:", error);

            res.status(500).json({
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "Unable to process winning claim.",
                },
            });
        }
    };

    public getWinners = async (
        req: Request,
        res: Response
    ): Promise<void> => {
        try {
            const { gameId } = req.params as { gameId: string };

            const gameEngine = this.gameManager.getGame(gameId);
            const game = gameEngine.getGame();

            res.status(200).json({
                success: true,
                data: {
                    gameId: game.id,
                    winners: game.winners,
                },
            });
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Game not found.";

            if (message === "Game not found.") {
                res.status(404).json({
                    success: false,
                    error: {
                        code: "GAME_NOT_FOUND",
                        message: "Game not found.",
                    },
                });
                return;
            }

            console.error("Get winners error:", error);

            res.status(500).json({
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "Unable to retrieve winners.",
                },
            });
        }
    };

    public getGameHistory = async (
        req: Request,
        res: Response
    ): Promise<void> => {
        try {
            const games =
                await this.gameRepository.findCompletedGames();

            const history = games.map((game) => ({
                id: game.id,
                status: game.status,
                createdAt: game.createdAt,
                startedAt: game.startedAt,
                completedAt: game.completedAt,
                currentRound: game.currentRound,
                playerCount: game.playerTickets.length,
                winners: game.winners,
            }));

            res.status(200).json({
                success: true,
                data: {
                    games: history,
                },
            });
        } catch (error) {
            console.error("Get game history error:", error);

            res.status(500).json({
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "Unable to retrieve game history.",
                },
            });
        }
    }

    public getGameHistoryById = async (
        req: Request,
        res: Response
    ): Promise<void> => {
        try {
            const { gameId } = req.params as { gameId: string };

            const game =
                await this.gameRepository.findCompletedGameById(gameId);

            if (!game) {
                res.status(404).json({
                    success: false,
                    error: {
                        code: "GAME_NOT_FOUND",
                        message: "Completed game not found.",
                    },
                });
                return;
            }

            res.status(200).json({
                success: true,
                data: {
                    game: {
                        id: game.id,
                        status: game.status,
                        createdAt: game.createdAt,
                        startedAt: game.startedAt,
                        completedAt: game.completedAt,
                        currentRound: game.currentRound,
                        roundStartedAt: game.roundStartedAt,
                        numbersAnnouncedThisRound:
                            game.numbersAnnouncedThisRound,
                        announcedNumbers: game.announcedNumbers,
                        playerCount: game.playerTickets.length,
                        winners: game.winners,
                    },
                },
            });
        } catch (error) {
            console.error("Get game history by ID error:", error);

            res.status(500).json({
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "Unable to retrieve game history.",
                },
            });
        }
    };
}