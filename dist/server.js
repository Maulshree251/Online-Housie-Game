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
const socket_io_1 = require("socket.io");
const gameScheduler_1 = require("./game/gameScheduler");
const gameManager_1 = require("./game/gameManager");
const gameSchedule_1 = require("./config/gameSchedule");
const announcementEngine_1 = require("./game/announcementEngine");
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: "*",
    },
});
const gameRepository = new gameRepository_1.GameRepository();
const gameManager = new gameManager_1.GameManager(gameRepository);
const announcementEngine = new announcementEngine_1.AnnouncementEngine(gameManager, (gameId, number) => {
    const gameEngine = gameManager.getGame(gameId);
    io.to(getGameRoom(gameId)).emit("game:numberAnnounced", {
        number,
        state: getSafeGameState(gameId),
    });
});
const gameScheduler = new gameScheduler_1.GameScheduler(gameManager, announcementEngine, gameSchedule_1.gameSchedule);
async function saveGameState(gameId) {
    await gameManager.saveGame(gameId);
    console.log(`Game ${gameId} saved to MongoDB.`);
}
const PORT = 3000;
const socketPlayers = new Map();
// --------------------------------------------------
// HELPER FUNCTIONS
// --------------------------------------------------
function getGameRoom(gameId) {
    return `game:${gameId}`;
}
function getConnectedPlayer(socket) {
    const connectedPlayer = socketPlayers.get(socket.id);
    if (!connectedPlayer) {
        throw new Error("You must join a game first.");
    }
    return connectedPlayer;
}
function requireHost(socket, gameId) {
    const { playerId } = getConnectedPlayer(socket);
    const gameEngine = gameManager.getGame(gameId);
    if (playerId !== gameEngine.getHostPlayerId()) {
        throw new Error("Only the game host can perform this action.");
    }
    return playerId;
}
function getSafeGameState(gameId) {
    const gameEngine = gameManager.getGame(gameId);
    const game = gameEngine.getGame();
    return {
        id: game.id,
        status: game.status,
        announcedNumbers: game.announcedNumbers,
        remainingNumbersCount: game.remainingNumbers.length,
        playerCount: game.playerTickets.length,
        winners: game.winners,
    };
}
function sendError(socket, error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    socket.emit("game:error", {
        message,
    });
}
// --------------------------------------------------
// HTTP ROUTE
// --------------------------------------------------
app.get("/", (_req, res) => {
    res.send("Tambola server is running!");
});
// --------------------------------------------------
// SOCKET.IO CONNECTION
// --------------------------------------------------
io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);
    // ------------------------------------------------
    // CREATE A NEW GAME
    // ------------------------------------------------
    socket.on("game:create", async () => {
        try {
            const gameEngine = await gameManager.createGame();
            const gameId = gameEngine.getGame().id;
            socket.emit("game:created", {
                gameId,
            });
            console.log(`New game created: ${gameId}`);
        }
        catch (error) {
            sendError(socket, error);
        }
    });
    // ------------------------------------------------
    // JOIN A GAME
    // ------------------------------------------------
    socket.on("game:join", async ({ gameId, playerId, ticket, }) => {
        try {
            if (socketPlayers.has(socket.id)) {
                throw new Error("You have already joined a game.");
            }
            const gameEngine = gameManager.getGame(gameId);
            gameEngine.addPlayerTicket(playerId, ticket);
            if (gameEngine.getHostPlayerId() === null) {
                gameEngine.assignHost(playerId);
                socket.emit("game:hostAssigned", {
                    gameId,
                    playerId,
                });
            }
            await saveGameState(gameId);
            socketPlayers.set(socket.id, {
                playerId,
                gameId,
            });
            // // Assign the first successful player as host
            // if (!gameHosts.has(gameId)) {
            //   gameHosts.set(gameId, playerId);
            //   socket.emit("game:hostAssigned", {
            //     gameId,
            //     playerId,
            //   });
            // }
            const room = getGameRoom(gameId);
            socket.join(room);
            socket.emit("game:state", getSafeGameState(gameId));
            socket.to(room).emit("game:playerJoined", {
                playerId,
            });
            io.to(room).emit("game:state", getSafeGameState(gameId));
            console.log(`${playerId} joined game ${gameId}`);
        }
        catch (error) {
            sendError(socket, error);
        }
    });
    // ------------------------------------------------
    // START GAME
    // ------------------------------------------------
    socket.on("game:start", async ({ gameId }) => {
        try {
            requireHost(socket, gameId);
            const gameEngine = gameManager.getGame(gameId);
            gameEngine.startGame();
            await saveGameState(gameId);
            const room = getGameRoom(gameId);
            io.to(room).emit("game:started", {
                gameId,
            });
            io.to(room).emit("game:state", getSafeGameState(gameId));
            console.log(`Game started: ${gameId}`);
        }
        catch (error) {
            sendError(socket, error);
        }
    });
    // ------------------------------------------------
    // ANNOUNCE NEXT NUMBER
    // ------------------------------------------------
    // socket.on("game:announce", async ({ gameId }: { gameId: string }) => {
    //   try {
    //     requireHost(socket, gameId);
    //     const gameEngine = gameManager.getGame(gameId);
    //     const number = gameEngine.announceNextNumber();
    //     await saveGameState(gameId);
    //     const room = getGameRoom(gameId);
    //     io.to(room).emit("game:numberAnnounced", {
    //       gameId,
    //       number,
    //     });
    //     io.to(room).emit("game:state", getSafeGameState(gameId));
    //     console.log(`Number ${number} announced in game ${gameId}`);
    //   } catch (error) {
    //     sendError(socket, error);
    //   }
    // });
    // ------------------------------------------------
    // GET GAME STATE
    // ------------------------------------------------
    socket.on("game:getState", ({ gameId }) => {
        try {
            socket.emit("game:state", getSafeGameState(gameId));
        }
        catch (error) {
            sendError(socket, error);
        }
    });
    // ------------------------------------------------
    // MARK A NUMBER
    // ------------------------------------------------
    socket.on("game:markNumber", async ({ gameId, number, }) => {
        try {
            const connectedPlayer = getConnectedPlayer(socket);
            if (connectedPlayer.gameId !== gameId) {
                throw new Error("You are not connected to this game.");
            }
            const gameEngine = gameManager.getGame(gameId);
            gameEngine.markNumber(connectedPlayer.playerId, number);
            await saveGameState(gameId);
            socket.emit("game:numberMarked", {
                gameId,
                playerId: connectedPlayer.playerId,
                number,
            });
        }
        catch (error) {
            sendError(socket, error);
        }
    });
    // ------------------------------------------------
    // CLAIM WINNER
    // ------------------------------------------------
    socket.on("game:claimWinner", async ({ gameId, winnerType, }) => {
        try {
            const connectedPlayer = getConnectedPlayer(socket);
            if (connectedPlayer.gameId !== gameId) {
                throw new Error("You are not connected to this game.");
            }
            const gameEngine = gameManager.getGame(gameId);
            const isWinner = gameEngine.claimWinner(connectedPlayer.playerId, winnerType);
            const room = getGameRoom(gameId);
            if (!isWinner) {
                socket.emit("game:claimRejected", {
                    gameId,
                    winnerType,
                    message: "You have not completed this winning condition.",
                });
                return;
            }
            await saveGameState(gameId);
            io.to(room).emit("game:winnerDeclared", {
                gameId,
                playerId: connectedPlayer.playerId,
                winnerType,
            });
            io.to(room).emit("game:state", getSafeGameState(gameId));
            console.log(`${connectedPlayer.playerId} won ${winnerType} in game ${gameId}`);
        }
        catch (error) {
            sendError(socket, error);
        }
    });
    // ------------------------------------------------
    // DISCONNECT
    // ------------------------------------------------
    socket.on("disconnect", () => {
        const connectedPlayer = socketPlayers.get(socket.id);
        if (connectedPlayer) {
            console.log(`${connectedPlayer.playerId} disconnected from game ${connectedPlayer.gameId}`);
            socketPlayers.delete(socket.id);
        }
        console.log(`Client disconnected: ${socket.id}`);
    });
});
// --------------------------------------------------
// START SERVER
// --------------------------------------------------
async function startServer() {
    await (0, connection_1.connectDatabase)();
    await gameManager.recoverGames();
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
