
import { io } from "socket.io-client";

const socket = io("http://localhost:3000");

const playerId = `player-${Date.now()}`;

let gameId = "";

const testTicket = [
    [1, 10, 20, 30, 40, null, null, null, null],
    [2, null, 21, null, 41, 50, null, 70, null],
    [3, null, null, 31, null, 51, 60, null, 80],
];

socket.once("connect", () => {
    console.log("Connected to server.");

    // Create a new game
    socket.emit("game:create");
});

socket.on("game:created", (data) => {
    gameId = data.gameId;

    console.log("Game created:", gameId);

    // Join the newly created game
    socket.emit("game:join", {
        gameId,
        playerId,
        ticket: testTicket,
    });
});

socket.on("game:hostAssigned", (data) => {
    console.log("Host assigned:", data);

    // Start the game
    socket.emit("game:start", {
        gameId,
    });
});

socket.on("game:started", (data) => {
    console.log("Game started:", data);

    // Announce the next number
    socket.emit("game:announce", {
        gameId,
    });
});

socket.on("game:numberAnnounced", (data) => {
    console.log("Number announced:", data);

    // Request current game state
    socket.emit("game:getState", {
        gameId,
    });
});

socket.on("game:state", (data) => {
    console.log("Current game state:");
    console.log(JSON.stringify(data, null, 2));
});

socket.on("game:error", (error) => {
    console.error("Game error:", error);
});