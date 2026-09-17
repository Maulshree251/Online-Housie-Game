
import express from "express";
import { Server, Socket } from "socket.io";
import { createServer } from "http";
import { GameEngine } from "./game/gameEngine";
import { Ticket } from "./models/ticket";

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

const gameEngine = new GameEngine();

const PORT = 3000;

app.get("/", (_req, res) => {
  res.send("Tambola server is running!");
});

io.on("connection", (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on(
    "game:join",
    (data: { playerId: string; ticket: Ticket }) => {
      try {
        gameEngine.addPlayerTicket(
          data.playerId,
          data.ticket
        );

        socket.join(gameEngine.getGame().id);

        socket.emit("game:state", getSafeGameState());

        io.emit("game:playerJoined", {
          playerId: data.playerId,
        });

        console.log(
          `Player ${data.playerId} joined the game.`
        );
      } catch (error) {
        sendError(socket, error);
      }
    }
  );

  socket.on("game:start", () => {
    try {
      gameEngine.startGame();

      io.emit("game:started", {
        gameId: gameEngine.getGame().id,
      });

      io.emit("game:state", getSafeGameState());

      console.log("Game started.");
    } catch (error) {
      sendError(socket, error);
    }
  });

  socket.on("game:announce", () => {
    try {
      const number = gameEngine.announceNextNumber();

      io.emit("game:numberAnnounced", {
        number,
        announcedNumbers:
          gameEngine.getGame().announcedNumbers,
      });

      io.emit("game:state", getSafeGameState());

      console.log(`Number announced: ${number}`);
    } catch (error) {
      sendError(socket, error);
    }
  });

  socket.on("game:getState", () => {
    socket.emit("game:state", getSafeGameState());
  });

  socket.on("disconnect", () => {
    console.log(`Player disconnected: ${socket.id}`);
  });
});

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

function sendError(
  socket: Socket,
  error: unknown
): void {
  const message =
    error instanceof Error
      ? error.message
      : "An unexpected error occurred.";

  socket.emit("game:error", { message });
}

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});