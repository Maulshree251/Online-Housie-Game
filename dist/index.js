"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const gameEngine_1 = require("./game/gameEngine");
const engine = new gameEngine_1.GameEngine();
const player1Ticket = [
    [1, 2, 3, 4, 5, null, null, null, null],
    [null, null, null, null, null, 15, 16, 17, null],
    [null, null, null, null, null, null, null, null, 25],
];
const player2Ticket = [
    [1, 2, 3, 4, 5, null, null, null, null],
    [null, null, null, null, null, 15, 16, 17, null],
    [null, null, null, null, null, null, null, null, 25],
];
engine.addPlayerTicket("player-1", player1Ticket);
engine.addPlayerTicket("player-2", player2Ticket);
engine.startGame();
// Announce the first five numbers.
for (let i = 1; i <= 5; i++) {
    engine.getGame().announcedNumbers.push(i);
}
// Player 1 claims First 5.
for (let i = 1; i <= 5; i++) {
    engine.markNumber("player-1", i);
}
const player1Result = engine.claimWinner("player-1", "FIRST_5");
console.log("Player 1 First 5 result:", player1Result);
// Player 2 marks the same five numbers.
for (let i = 1; i <= 5; i++) {
    engine.markNumber("player-2", i);
}
// Player 2 attempts to claim First 5.
try {
    const player2Result = engine.claimWinner("player-2", "FIRST_5");
    console.log("Player 2 First 5 result:", player2Result);
}
catch (error) {
    if (error instanceof Error) {
        console.log("Player 2 claim rejected:", error.message);
    }
}
console.log("\nWinner history:");
console.log(engine.getGame().winners);
console.log("\nGame status:");
console.log(engine.getGame().status);
