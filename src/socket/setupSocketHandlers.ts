
import { Server, Socket } from "socket.io";
import { verifyAccessToken } from "../auth/tokenService";
import { RealtimeEvent } from "../realtime/realtimeEvents";

// Adjust this import path to match your project.
import { GameManager } from "../game/gameManager";

interface AuthenticatedSocket extends Socket {
    data: {
        userId: string;
        [key: string]: unknown;
    };
}

export function setupSocketHandlers(
    io: Server,
    gameManager: GameManager
): void {
    // Authenticate every incoming Socket.IO connection.
    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth?.token;

            if (!token || typeof token !== "string") {
                return next(new Error("UNAUTHENTICATED"));
            }

            const payload = verifyAccessToken(token);
            socket.data.userId = payload.userId;

            next();
        } catch {
            next(new Error("INVALID_TOKEN"));
        }
    });

    io.on("connection", (rawSocket) => {
        const socket = rawSocket as AuthenticatedSocket;

        socket.on("joinGame", ({ gameId }: { gameId: string }) => {
            try {
                const userId = socket.data.userId;

                const gameEngine = gameManager.getGame(gameId);
                const game = gameEngine.getGame();

                const player = game.playerTickets.find(
                    (ticket) => ticket.playerId === userId
                );

                if (!player) {
                    throw new Error(
                        "You are not a participant in this game."
                    );
                }

                socket.join(`game:${gameId}`);

                socket.emit(RealtimeEvent.GAME_STATE, {
                    event: RealtimeEvent.GAME_STATE,
                    data: {
                        gameId,
                        status: game.status,
                        currentRound: game.currentRound,
                        announcedNumbers: game.announcedNumbers,
                        playerCount: game.playerTickets.length,
                        winners: game.winners,
                    },
                });
            } catch (error) {
                socket.emit(RealtimeEvent.GAME_ERROR, {
                    event: RealtimeEvent.GAME_ERROR,
                    data: {
                        message:
                            error instanceof Error
                                ? error.message
                                : "Unable to join game room.",
                    },
                });
            }
        });

        socket.on("disconnect", () => {
            console.log(`Socket disconnected: ${socket.id}`);
        });
    });
}
