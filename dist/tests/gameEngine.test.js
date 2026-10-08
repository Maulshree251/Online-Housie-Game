"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTestTicket = createTestTicket;
const assert_1 = __importDefault(require("assert"));
const gameEngine_1 = require("../game/gameEngine");
function createTestTicket() {
    return [
        [1, 10, 20, 30, 40, null, null, null, null],
        [2, null, 21, null, 41, 50, null, 70, null],
        [3, null, null, 31, null, 51, 60, null, 80],
    ];
}
function createEngineWithPlayers() {
    const engine = new gameEngine_1.GameEngine();
    engine.addPlayerTicket("player-1", createTestTicket());
    engine.addPlayerTicket("player-2", createTestTicket());
    engine.startGame();
    return engine;
}
function announceNumbers(engine, numbers) {
    for (const number of numbers) {
        engine.announceNumber(number);
    }
}
function markNumbers(engine, playerId, numbers) {
    for (const number of numbers) {
        engine.markNumber(playerId, number);
    }
}
function testFirstFiveClaim() {
    const engine = createEngineWithPlayers();
    const numbers = [1, 10, 20, 30, 40];
    announceNumbers(engine, numbers);
    markNumbers(engine, "player-1", numbers);
    const result = engine.claimWinner("player-1", "FIRST_5");
    assert_1.default.strictEqual(result, true);
    assert_1.default.strictEqual(engine.getGame().winners.length, 1);
    console.log("✅ First 5 claim test passed");
}
function testIncompleteFirstFive() {
    const engine = createEngineWithPlayers();
    const numbers = [1, 10, 20, 30];
    announceNumbers(engine, numbers);
    markNumbers(engine, "player-1", numbers);
    const result = engine.claimWinner("player-1", "FIRST_5");
    assert_1.default.strictEqual(result, false);
    assert_1.default.strictEqual(engine.getGame().winners.length, 0);
    console.log("✅ Incomplete First 5 test passed");
}
function testDuplicateCategoryClaim() {
    const engine = createEngineWithPlayers();
    const numbers = [1, 10, 20, 30, 40];
    announceNumbers(engine, numbers);
    markNumbers(engine, "player-1", numbers);
    markNumbers(engine, "player-2", numbers);
    const firstResult = engine.claimWinner("player-1", "FIRST_5");
    assert_1.default.strictEqual(firstResult, true);
    assert_1.default.throws(() => {
        engine.claimWinner("player-2", "FIRST_5");
    }, /already been claimed/);
    assert_1.default.strictEqual(engine.getGame().winners.length, 1);
    console.log("✅ Duplicate category claim test passed");
}
function testUnannouncedNumber() {
    const engine = createEngineWithPlayers();
    assert_1.default.throws(() => {
        engine.markNumber("player-1", 1);
    }, /has not been announced/);
    console.log("✅ Unannounced number test passed");
}
function testDuplicateAnnouncement() {
    const engine = createEngineWithPlayers();
    engine.announceNumber(1);
    assert_1.default.throws(() => {
        engine.announceNumber(1);
    }, /already been announced/);
    console.log("✅ Duplicate announcement test passed");
}
function testPlayerCannotJoinAfterStart() {
    const engine = new gameEngine_1.GameEngine();
    // Add a player before starting the game.
    engine.addPlayerTicket("player-1", createTestTicket());
    engine.addPlayerTicket("player-2", createTestTicket());
    // Start the game successfully.
    engine.startGame();
    // Try to join after the game has started.
    assert_1.default.throws(() => {
        engine.addPlayerTicket("player-2", createTestTicket());
    }, /Players cannot join after the game has started/);
    console.log("✅ Join restriction test passed");
}
function testInvalidTicketRejected() {
    const engine = new gameEngine_1.GameEngine();
    const invalidTicket = [
        [1, 2, 3, 4, 5, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
    ];
    assert_1.default.throws(() => {
        engine.addPlayerTicket("player-1", invalidTicket);
    }, /Invalid ticket/);
    assert_1.default.strictEqual(engine.getGame().playerTickets.length, 0);
    console.log("✅ Invalid ticket rejection test passed");
}
function testWinnerCategoryCanBeClaimedOnlyOnce() {
    const engine = createEngineWithPlayers();
    const numbers = [1, 10, 20, 30, 40];
    announceNumbers(engine, numbers);
    markNumbers(engine, "player-1", numbers);
    markNumbers(engine, "player-2", numbers);
    const firstClaim = engine.claimWinner("player-1", "FIRST_5");
    assert_1.default.strictEqual(firstClaim, true);
    assert_1.default.throws(() => {
        engine.claimWinner("player-2", "FIRST_5");
    }, /already been claimed/);
    assert_1.default.strictEqual(engine.getGame().winners.length, 1);
    console.log("✅ One-winner-per-category test passed");
}
// function testFullHouseCompletesGame(): void {
//   const engine = createEngineWithPlayers();
//   const allNumbers = [
//     1, 10, 20, 30, 40,
//     2, 21, 41, 50, 70,
//     3, 31, 51, 60, 80,
//   ];
//   announceNumbers(engine, allNumbers);
//   markNumbers(engine, "player-1", allNumbers);
//   const result = engine.claimWinner(
//     "player-1",
//     "FULL_HOUSE"
//   );
//   assert.strictEqual(result, true);
//   assert.strictEqual(
//     engine.getGame().status,
//     "COMPLETED"
//   );
//   console.log("✅ Full House completion test passed");
// }
function testGameStartsWithWaitingStatus() {
    const engine = new gameEngine_1.GameEngine();
    assert_1.default.strictEqual(engine.getGame().status, "WAITING");
    console.log("✅ Game starts with WAITING status test passed");
}
function testCannotStartEmptyGame() {
    const engine = new gameEngine_1.GameEngine();
    assert_1.default.throws(() => {
        engine.startGame();
    }, /Minimum 2 players are required/);
    console.log("✅ Cannot start empty game test passed");
}
function testGameStoresStartTime() {
    const engine = new gameEngine_1.GameEngine();
    engine.addPlayerTicket("player1", createTestTicket());
    engine.addPlayerTicket("player2", createTestTicket());
    engine.startGame();
    assert_1.default.strictEqual(engine.getGame().status, "ACTIVE");
    assert_1.default.ok(engine.getGame().startedAt instanceof Date);
    console.log("✅ Game stores start time test passed");
}
function testAll90NumbersCanBeAnnounced() {
    const engine = createEngineWithPlayers();
    engine.getGame().config.numbersPerRound = 90;
    const announcedNumbers = new Set();
    for (let i = 0; i < 90; i++) {
        const number = engine.announceNextNumber();
        announcedNumbers.add(number);
    }
    assert_1.default.strictEqual(announcedNumbers.size, 90);
    assert_1.default.strictEqual(engine.getGame().remainingNumbers.length, 0);
    assert_1.default.strictEqual(engine.getGame().numbersAnnouncedThisRound, 90);
    console.log("✅ All 90 numbers announcement test passed");
}
function testAnnouncementAfter90NumbersFails() {
    const engine = createEngineWithPlayers();
    engine.getGame().config.numbersPerRound = 90;
    for (let i = 0; i < 90; i++) {
        engine.announceNextNumber();
    }
    assert_1.default.throws(() => {
        engine.announceNextNumber();
    }, /Maximum number of announcements for this round has been reached/);
    console.log("✅ Announcement after 90 numbers test passed");
}
function testFullHouseCannotBeClaimedEarly() {
    const engine = createEngineWithPlayers();
    const allNumbers = [
        1, 10, 20, 30, 40,
        2, 21, 41, 50, 70,
        3, 31, 51, 60, 80,
    ];
    announceNumbers(engine, allNumbers);
    markNumbers(engine, "player-1", allNumbers);
    assert_1.default.throws(() => {
        engine.claimWinner("player-1", "FULL_HOUSE");
    }, /Full House cannot be claimed until all other winning categories have been claimed/);
    assert_1.default.strictEqual(engine.getGame().winners.length, 0);
    assert_1.default.strictEqual(engine.getGame().status, "ACTIVE");
    console.log("✅ Early Full House rejection test passed");
}
function testCompletedGameRejectsFurtherActions() {
    const engine = createEngineWithPlayers();
    const allNumbers = [
        1, 10, 20, 30, 40,
        2, 21, 41, 50, 70,
        3, 31, 51, 60, 80,
    ];
    // Announce and mark all ticket numbers
    announceNumbers(engine, allNumbers);
    markNumbers(engine, "player-1", allNumbers);
    // Claim all required categories first
    engine.claimWinner("player-1", "FIRST_5");
    engine.claimWinner("player-1", "ONE_LINE");
    engine.claimWinner("player-1", "TWO_LINES");
    engine.claimWinner("player-1", "THREE_LINES");
    // Full House completes the game
    const result = engine.claimWinner("player-1", "FULL_HOUSE");
    assert_1.default.strictEqual(result, true);
    assert_1.default.strictEqual(engine.getGame().status, "COMPLETED");
    // Cannot announce after completion
    assert_1.default.throws(() => {
        engine.announceNextNumber();
    }, /Game is not active/);
    // Cannot mark after completion
    assert_1.default.throws(() => {
        engine.markNumber("player-1", 1);
    }, /Game is not active/);
    // Cannot claim another winner after completion
    assert_1.default.throws(() => {
        engine.claimWinner("player-2", "FIRST_5");
    }, /Game is not active/);
    console.log("✅ Completed game rejects further actions test passed");
}
function runTests() {
    console.log("\n===== GAME ENGINE TESTS =====\n");
    testFirstFiveClaim();
    testIncompleteFirstFive();
    testDuplicateCategoryClaim();
    testUnannouncedNumber();
    testDuplicateAnnouncement();
    testPlayerCannotJoinAfterStart();
    testInvalidTicketRejected();
    testWinnerCategoryCanBeClaimedOnlyOnce();
    //testFullHouseCompletesGame();
    testGameStartsWithWaitingStatus();
    testCannotStartEmptyGame();
    testGameStoresStartTime();
    testAll90NumbersCanBeAnnounced();
    testAnnouncementAfter90NumbersFails();
    testFullHouseCannotBeClaimedEarly();
    testCompletedGameRejectsFurtherActions();
    console.log("\n🎉 All tests passed!\n");
}
runTests();
