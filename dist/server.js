"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const connection_1 = require("./database/connection");
const gameRepository_1 = require("./repositories/gameRepository");
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const gameScheduler_1 = require("./game/gameScheduler");
const gameManager_1 = require("./game/gameManager");
const gameSchedule_1 = require("./config/gameSchedule");
const announcementEngine_1 = require("./game/announcementEngine");
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const gameRoutes_1 = require("./routes/gameRoutes");
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const tokenService_1 = require("./auth/tokenService");
const socket_io_1 = require("socket.io");
const realtimeEvents_1 = require("./realtime/realtimeEvents");
const realtimeService_1 = require("./realtime/realtimeService");
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: "*",
    },
});
const gameRepository = new gameRepository_1.GameRepository();
const gameManager = new gameManager_1.GameManager(gameRepository);
const realtimeService = new realtimeService_1.RealtimeService(io);
app.use(express_1.default.json());
app.use("/api/auth", authRoutes_1.default);
app.use("/api/users", userRoutes_1.default);
app.use("/api/games", (0, gameRoutes_1.createGameRoutes)(gameManager, gameRepository, realtimeService));
const announcementEngine = new announcementEngine_1.AnnouncementEngine(gameManager, (gameId, number) => {
    const game = gameManager.getGame(gameId).getGame();
    realtimeService.emitToGame(gameId, realtimeEvents_1.RealtimeEvent.NUMBER_ANNOUNCED, {
        gameId,
        number,
        round: game.currentRound,
        announcedCount: game.numbersAnnouncedThisRound,
        totalNumbers: game.config.numbersPerRound,
    });
}, (gameId, round) => {
    realtimeService.emitToGame(gameId, realtimeEvents_1.RealtimeEvent.ROUND_COMPLETED, {
        gameId,
        round,
    });
});
const gameScheduler = new gameScheduler_1.GameScheduler(gameManager, announcementEngine, gameSchedule_1.gameSchedule, realtimeService);
// async function saveGameState(gameId: string): Promise<void> {
//   await gameManager.saveGame(gameId);
//   console.log(`Game ${gameId} saved to MongoDB.`);
// }
const PORT = 3000;
// Stores the player and game associated with each socket
// interface ConnectedPlayer {
//   playerId: string;
//   gameId: string;
// }
// const socketPlayers = new Map<string, ConnectedPlayer>();
// // --------------------------------------------------
// // HELPER FUNCTIONS
// // --------------------------------------------------
// function getGameRoom(gameId: string): string {
//   return `game:${gameId}`;
// }
// function getConnectedPlayer(socket: AuthenticatedSocket): ConnectedPlayer {
//   const connectedPlayer = socketPlayers.get(socket.id);
//   if (!connectedPlayer) {
//     throw new Error("You must join a game first.");
//   }
//   return connectedPlayer;
// }
// function requireHost(socket: AuthenticatedSocket, gameId: string): string {
//   const { playerId } = getConnectedPlayer(socket);
//   const gameEngine = gameManager.getGame(gameId);
//   if (playerId !== gameEngine.getHostPlayerId()) {
//     throw new Error(
//       "Only the game host can perform this action."
//     );
//   }
//   return playerId;
// }
// function getSafeGameState(gameId: string) {
//   const gameEngine = gameManager.getGame(gameId);
//   const game = gameEngine.getGame();
//   return {
//     id: game.id,
//     status: game.status,
//     announcedNumbers: game.announcedNumbers,
//     remainingNumbersCount: game.remainingNumbers.length,
//     playerCount: game.playerTickets.length,
//     winners: game.winners,
//   };
// }
// function sendError(socket: AuthenticatedSocket, error: unknown): void {
//   const message =
//     error instanceof Error ? error.message : "Something went wrong.";
//   socket.emit("GAME_ERROR", {
//     message,
//   });
// }
// --------------------------------------------------
// HTTP ROUTE
// --------------------------------------------------
app.get("/", (_req, res) => {
    res.send("Tambola server is running!");
});
// --------------------------------------------------
// SOCKET.IO CONNECTION
// --------------------------------------------------
// --------------------------------------------------
// SOCKET.IO AUTHENTICATION
// --------------------------------------------------
io.use((socket, next) => {
    try {
        const token = socket.handshake.auth?.token;
        if (!token || typeof token !== "string") {
            return next(new Error("UNAUTHENTICATED"));
        }
        const payload = (0, tokenService_1.verifyAccessToken)(token);
        socket.data.userId = payload.userId;
        next();
    }
    catch {
        next(new Error("INVALID_TOKEN"));
    }
});
// --------------------------------------------------
// SOCKET.IO CONNECTION
// --------------------------------------------------
io.on("connection", (rawSocket) => {
    const socket = rawSocket;
    console.log(`Client connected: ${socket.id}`);
    socket.on("joinGame", async ({ gameId }) => {
        try {
            const userId = socket.data.userId;
            const gameEngine = gameManager.getGame(gameId);
            const game = gameEngine.getGame();
            const player = game.playerTickets.find((player) => player.playerId === userId);
            if (!player) {
                throw new Error("You are not a participant in this game.");
            }
            const room = `game:${gameId}`;
            socket.join(room);
            socket.emit(realtimeEvents_1.RealtimeEvent.GAME_STATE, {
                event: realtimeEvents_1.RealtimeEvent.GAME_STATE,
                data: {
                    gameId,
                    status: game.status,
                    currentRound: game.currentRound,
                    announcedNumbers: game.announcedNumbers,
                    playerCount: game.playerTickets.length,
                    winners: game.winners,
                },
            });
            console.log(`User ${userId} joined socket room ${room}`);
        }
        catch (error) {
            socket.emit(realtimeEvents_1.RealtimeEvent.GAME_ERROR, {
                event: realtimeEvents_1.RealtimeEvent.GAME_ERROR,
                data: {
                    message: error instanceof Error
                        ? error.message
                        : "Unable to join game room.",
                },
            });
        }
    });
    socket.on("disconnect", () => {
        console.log(`Client disconnected: ${socket.id}`);
    });
});
// --------------------------------------------------
// START SERVER
// --------------------------------------------------
async function startServer() {
    await (0, connection_1.connectDatabase)();
    await gameManager.recoverGames();
    await gameManager.ensureWaitingGame();
    gameScheduler.start();
    httpServer.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
}
startServer().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
});
process.on("SIGINT", () => {
    console.log("Shutting down server...");
    gameScheduler.stop();
    httpServer.close(() => {
        console.log("Server stopped.");
        process.exit(0);
    });
});
