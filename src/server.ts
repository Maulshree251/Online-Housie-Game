import { connectDatabase } from "./database/connection";
import { GameRepository } from "./repositories/gameRepository";
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { GameScheduler } from "./game/gameScheduler";
import { GameManager } from "./game/gameManager";
import { gameSchedule } from "./config/gameSchedule";
import { AnnouncementEngine } from "./game/announcementEngine";
import authRoutes from "./routes/authRoutes";
import { createGameRoutes } from "./routes/gameRoutes";
import userRoutes from "./routes/userRoutes";
import { verifyAccessToken } from "./auth/tokenService";
import { AuthenticatedSocket } from "./types/socket";
import { Server } from "socket.io";
import { RealtimeEvent } from "./realtime/realtimeEvents";
import { RealtimeService } from "./realtime/realtimeService";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});
const gameRepository = new GameRepository();
const gameManager = new GameManager(gameRepository);
const realtimeService = new RealtimeService(io);

app.use(express.json());
app.use(
  "/api/auth",
  authRoutes
);
app.use(
  "/api/users",
  userRoutes
);

app.use(
  "/api/games",
  createGameRoutes(
    gameManager,
    gameRepository,
    realtimeService
  )
);

const announcementEngine = new AnnouncementEngine(
  gameManager,
  (gameId, number) => {
    const game = gameManager.getGame(gameId).getGame();

    realtimeService.emitToGame(
      gameId,
      RealtimeEvent.NUMBER_ANNOUNCED,
      {
        gameId,
        number,
        round: game.currentRound,
        announcedCount: game.numbersAnnouncedThisRound,
        totalNumbers: game.config.numbersPerRound,
      }
    );
  },
  (gameId, round) => {
    realtimeService.emitToGame(
      gameId,
      RealtimeEvent.ROUND_COMPLETED,
      {
        gameId,
        round,
      }
    );
  }
);

const gameScheduler =
  new GameScheduler(
    gameManager,
    announcementEngine,
    gameSchedule,
    realtimeService
  );

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

    const payload = verifyAccessToken(token);

    socket.data.userId = payload.userId;

    next();
  } catch {
    next(new Error("INVALID_TOKEN"));
  }
});


// --------------------------------------------------
// SOCKET.IO CONNECTION
// --------------------------------------------------

io.on("connection", (rawSocket) => {

  const socket = rawSocket as AuthenticatedSocket;

  console.log(`Client connected: ${socket.id}`);

  socket.on(
    "joinGame",
    async ({ gameId }: { gameId: string }) => {

      try {

        const userId = socket.data.userId;

        const gameEngine =
          gameManager.getGame(gameId);

        const game = gameEngine.getGame();

        const player =
          game.playerTickets.find(
            (player) =>
              player.playerId === userId
          );

        if (!player) {
          throw new Error(
            "You are not a participant in this game."
          );
        }

        const room = `game:${gameId}`;

        socket.join(room);

        socket.emit(
          RealtimeEvent.GAME_STATE,
          {
            event: RealtimeEvent.GAME_STATE,

            data: {
              gameId,
              status: game.status,
              currentRound:
                game.currentRound,
              announcedNumbers:
                game.announcedNumbers,
              playerCount:
                game.playerTickets.length,
              winners: game.winners,
            },
          }
        );

        console.log(
          `User ${userId} joined socket room ${room}`
        );

      } catch (error) {

        socket.emit(
          RealtimeEvent.GAME_ERROR,
          {
            event: RealtimeEvent.GAME_ERROR,

            data: {
              message:
                error instanceof Error
                  ? error.message
                  : "Unable to join game room.",
            },
          }
        );
      }
    }
  );

  socket.on("disconnect", () => {

    console.log(
      `Client disconnected: ${socket.id}`
    );

  });
});


// --------------------------------------------------
// START SERVER
// --------------------------------------------------


async function startServer(): Promise<void> {
  await connectDatabase();

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