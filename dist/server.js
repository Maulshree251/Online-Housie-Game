"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const socket_io_1 = require("socket.io");
const http_1 = require("http");
const gameEngine_1 = require("./game/gameEngine");
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: "*",
    },
});
const gameEngine = new gameEngine_1.GameEngine();
let hostPlayerId = null;
const socketPlayers = new Map();
const PORT = 3000;
app.get("/", (_req, res) => {
    res.send("Tambola server is running!");
});
io.on("connection", (socket) => {
    console.log(`Player connected: ${socket.id}`);
    socket.on("game:join", (data) => {
        try {
            if (socketPlayers.has(socket.id)) {
                throw new Error("This socket has already joined.");
            }
            gameEngine.addPlayerTicket(data.playerId, data.ticket);
            socketPlayers.set(socket.id, data.playerId);
            if (hostPlayerId === null) {
                hostPlayerId = data.playerId;
                socket.emit("game:hostAssigned", {
                    playerId: data.playerId,
                });
                console.log(`Host assigned: ${data.playerId}`);
            }
            socket.join(gameEngine.getGame().id);
            socket.emit("game:state", getSafeGameState());
            io.emit("game:playerJoined", {
                playerId: data.playerId,
            });
            console.log(`Player ${data.playerId} joined the game.`);
        }
        catch (error) {
            sendError(socket, error);
        }
    });
    socket.on("game:start", () => {
        try {
            requireHost(socket);
            gameEngine.startGame();
            io.emit("game:started", {
                gameId: gameEngine.getGame().id,
            });
            io.emit("game:state", getSafeGameState());
            console.log("Game started.");
        }
        catch (error) {
            sendError(socket, error);
        }
    });
    socket.on("game:announce", () => {
        try {
            requireHost(socket);
            const number = gameEngine.announceNextNumber();
            io.emit("game:numberAnnounced", {
                number,
                announcedNumbers: gameEngine.getGame().announcedNumbers,
            });
            io.emit("game:state", getSafeGameState());
            console.log(`Number announced: ${number}`);
        }
        catch (error) {
            sendError(socket, error);
        }
    });
    socket.on("game:getState", () => {
        socket.emit("game:state", getSafeGameState());
    });
    socket.on("disconnect", () => {
        const playerId = socketPlayers.get(socket.id);
        socketPlayers.delete(socket.id);
        console.log(`Player disconnected: ${playerId ?? socket.id}`);
    });
    socket.on("game:markNumber", (data) => {
        try {
            const playerId = getConnectedPlayerId(socket);
            gameEngine.markNumber(playerId, data.number);
            socket.emit("game:numberMarked", {
                playerId,
                number: data.number,
            });
            console.log(`Player ${playerId} marked number ${data.number}.`);
        }
        catch (error) {
            sendError(socket, error);
        }
    });
    socket.on("game:claimWinner", (data) => {
        try {
            const playerId = getConnectedPlayerId(socket);
            const isWinner = gameEngine.claimWinner(playerId, data.winnerType);
            if (!isWinner) {
                socket.emit("game:claimRejected", {
                    playerId,
                    winnerType: data.winnerType,
                    reason: "Winning condition has not been completed.",
                });
                return;
            }
            io.emit("game:winnerDeclared", {
                playerId,
                winnerType: data.winnerType,
            });
            io.emit("game:state", getSafeGameState());
            console.log(`Winner declared: ${playerId} - ${data.winnerType}`);
        }
        catch (error) {
            sendError(socket, error);
        }
    });
});
function getConnectedPlayerId(socket) {
    const playerId = socketPlayers.get(socket.id);
    if (!playerId) {
        throw new Error("You must join the game first.");
    }
    return playerId;
}
function requireHost(socket) {
    const playerId = getConnectedPlayerId(socket);
    if (playerId !== hostPlayerId) {
        throw new Error("Only the game host can perform this action.");
    }
    return playerId;
}
function getSafeGameState() {
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
    const message = error instanceof Error
        ? error.message
        : "An unexpected error occurred.";
    socket.emit("game:error", { message });
}
httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
