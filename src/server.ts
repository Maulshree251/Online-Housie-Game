
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

let hostPlayerId: string | null = null;

const socketPlayers = new Map<string, string>();

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
      if (socketPlayers.has(socket.id)) {
        throw new Error("This socket has already joined.");
      }

      gameEngine.addPlayerTicket(
        data.playerId,
        data.ticket
      );

      socketPlayers.set(socket.id, data.playerId);

      if (hostPlayerId === null) {
        hostPlayerId = data.playerId;

        socket.emit("game:hostAssigned", {
          playerId: data.playerId,
        });

        console.log(
          `Host assigned: ${data.playerId}`
        );
      }

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
    requireHost(socket);

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
    requireHost(socket);

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
  const playerId = socketPlayers.get(socket.id);

  socketPlayers.delete(socket.id);

  console.log(
    `Player disconnected: ${playerId ?? socket.id}`
  );
});

  

socket.on(
  "game:markNumber",
  (data: { number: number }) => {
    try {
      const playerId = getConnectedPlayerId(socket);

      gameEngine.markNumber(
        playerId,
        data.number
      );

      socket.emit("game:numberMarked", {
        playerId,
        number: data.number,
      });

      console.log(
        `Player ${playerId} marked number ${data.number}.`
      );
    } catch (error) {
      sendError(socket, error);
    }
  }
);



socket.on(
  "game:claimWinner",
  (data: {
    winnerType:
      | "FIRST_5"
      | "ONE_LINE"
      | "TWO_LINES"
      | "THREE_LINES"
      | "FULL_HOUSE";
  }) => {
    try {
      const playerId = getConnectedPlayerId(socket);

      const isWinner = gameEngine.claimWinner(
        playerId,
        data.winnerType
      );

      if (!isWinner) {
        socket.emit("game:claimRejected", {
          playerId,
          winnerType: data.winnerType,
          reason:
            "Winning condition has not been completed.",
        });

        return;
      }

      io.emit("game:winnerDeclared", {
        playerId,
        winnerType: data.winnerType,
      });

      io.emit("game:state", getSafeGameState());

      console.log(
        `Winner declared: ${playerId} - ${data.winnerType}`
      );
    } catch (error) {
      sendError(socket, error);
    }
  }
);
});


function getConnectedPlayerId(
  socket: Socket
): string {
  const playerId = socketPlayers.get(socket.id);

  if (!playerId) {
    throw new Error("You must join the game first.");
  }

  return playerId;
}

function requireHost(socket: Socket): string {
  const playerId = getConnectedPlayerId(socket);

  if (playerId !== hostPlayerId) {
    throw new Error(
      "Only the game host can perform this action."
    );
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