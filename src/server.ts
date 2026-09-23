import { connectDatabase } from "./database/connection";
import { GameRepository } from "./repositories/gameRepository";
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";

import { GameManager } from "./game/gameManager";
import { Ticket } from "./models/ticket";
import { WinnerType } from "./models/game";

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

const gameRepository = new GameRepository();

const gameManager = new GameManager(gameRepository);


async function saveGameState(gameId: string): Promise<void> {
  await gameManager.saveGame(gameId);

  console.log(`Game ${gameId} saved to MongoDB.`);
}

const PORT = 3000;

// Stores the player and game associated with each socket
interface ConnectedPlayer {
  playerId: string;
  gameId: string;
}

const socketPlayers = new Map<string, ConnectedPlayer>();




// --------------------------------------------------
// HELPER FUNCTIONS
// --------------------------------------------------

function getGameRoom(gameId: string): string {
  return `game:${gameId}`;
}


function getConnectedPlayer(socket: Socket): ConnectedPlayer {
  const connectedPlayer = socketPlayers.get(socket.id);

  if (!connectedPlayer) {
    throw new Error("You must join a game first.");
  }

  return connectedPlayer;
}


function requireHost(socket: Socket, gameId: string): string {
  const { playerId } = getConnectedPlayer(socket);

  const gameEngine = gameManager.getGame(gameId);

  if (playerId !== gameEngine.getHostPlayerId()) {
    throw new Error(
      "Only the game host can perform this action."
    );
  }

  return playerId;
}


function getSafeGameState(gameId: string) {
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


function sendError(socket: Socket, error: unknown): void {
  const message =
    error instanceof Error ? error.message : "Something went wrong.";

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

io.on("connection", (socket: Socket) => {
  console.log(`Client connected: ${socket.id}`);


  // ------------------------------------------------
  // CREATE A NEW GAME
  // ------------------------------------------------

  socket.on("game:create", async () => {
    try {
      const gameEngine = gameManager.createGame();
      const game = gameEngine.getGame();

      await gameManager.saveGame(game.id);
      socket.emit("game:created", {
        gameId: game.id,
      });

      console.log(`New game created: ${game.id}`);
    } catch (error) {
      sendError(socket, error);
    }
  });


  // ------------------------------------------------
  // JOIN A GAME
  // ------------------------------------------------

  socket.on(
    "game:join",
    async ({
      gameId,
      playerId,
      ticket,
    }: {
      gameId: string;
      playerId: string;
      ticket: Ticket;
    }) => {
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
      } catch (error) {
        sendError(socket, error);
      }
    }
  );


  // ------------------------------------------------
  // START GAME
  // ------------------------------------------------

  socket.on("game:start", async ({ gameId }: { gameId: string }) => {
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
    } catch (error) {
      sendError(socket, error);
    }
  });


  // ------------------------------------------------
  // ANNOUNCE NEXT NUMBER
  // ------------------------------------------------

  socket.on("game:announce", async ({ gameId }: { gameId: string }) => {
    try {
      requireHost(socket, gameId);

      const gameEngine = gameManager.getGame(gameId);
      if (gameEngine.expireGameIfNeeded()) {
        await saveGameState(gameId);

        throw new Error("Game duration has ended.");
      }
      const number = gameEngine.announceNextNumber();
      await saveGameState(gameId);
      const room = getGameRoom(gameId);

      io.to(room).emit("game:numberAnnounced", {
        gameId,
        number,
      });

      io.to(room).emit("game:state", getSafeGameState(gameId));

      console.log(`Number ${number} announced in game ${gameId}`);
    } catch (error) {
      sendError(socket, error);
    }
  });


  // ------------------------------------------------
  // GET GAME STATE
  // ------------------------------------------------

  socket.on("game:getState", ({ gameId }: { gameId: string }) => {
    try {
      socket.emit("game:state", getSafeGameState(gameId));
    } catch (error) {
      sendError(socket, error);
    }
  });


  // ------------------------------------------------
  // MARK A NUMBER
  // ------------------------------------------------

  socket.on(
    "game:markNumber",
    async ({
      gameId,
      number,
    }: {
      gameId: string;
      number: number;
    }) => {
      try {
        const connectedPlayer = getConnectedPlayer(socket);

        if (connectedPlayer.gameId !== gameId) {
          throw new Error("You are not connected to this game.");
        }

        const gameEngine = gameManager.getGame(gameId);
        if (gameEngine.expireGameIfNeeded()) {
          await saveGameState(gameId);

          throw new Error("Game duration has ended.");
        }
        gameEngine.markNumber(connectedPlayer.playerId, number);
        await saveGameState(gameId);
        socket.emit("game:numberMarked", {
          gameId,
          playerId: connectedPlayer.playerId,
          number,
        });
      } catch (error) {
        sendError(socket, error);
      }
    }
  );


  // ------------------------------------------------
  // CLAIM WINNER
  // ------------------------------------------------

  socket.on(
    "game:claimWinner",
    async ({
      gameId,
      winnerType,
    }: {
      gameId: string;
      winnerType: WinnerType;
    }) => {
      try {
        const connectedPlayer = getConnectedPlayer(socket);

        if (connectedPlayer.gameId !== gameId) {
          throw new Error("You are not connected to this game.");
        }

        const gameEngine = gameManager.getGame(gameId);
        if (gameEngine.expireGameIfNeeded()) {
          await saveGameState(gameId);

          throw new Error("Game duration has ended.");
        }
        const isWinner = gameEngine.claimWinner(
          connectedPlayer.playerId,
          winnerType
        );

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

        console.log(
          `${connectedPlayer.playerId} won ${winnerType} in game ${gameId}`
        );
      } catch (error) {
        sendError(socket, error);
      }
    }
  );


  // ------------------------------------------------
  // DISCONNECT
  // ------------------------------------------------

  socket.on("disconnect", () => {
    const connectedPlayer = socketPlayers.get(socket.id);

    if (connectedPlayer) {
      console.log(
        `${connectedPlayer.playerId} disconnected from game ${connectedPlayer.gameId}`
      );

      socketPlayers.delete(socket.id);
    }

    console.log(`Client disconnected: ${socket.id}`);
  });
});


// --------------------------------------------------
// START SERVER
// --------------------------------------------------


async function startServer(): Promise<void> {
  await connectDatabase();

  await gameManager.recoverGames();

  httpServer.listen(PORT, () => {
    console.log(
      `Server running at http://localhost:${PORT}`
    );
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});