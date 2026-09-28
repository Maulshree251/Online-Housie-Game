
import assert from "assert";
import { GameEngine } from "../game/gameEngine";
import { Ticket } from "../models/ticket";


export function createTestTicket(): Ticket {
  return [
    [1, 10, 20, 30, 40, null, null, null, null],
    [2, null, 21, null, 41, 50, null, 70, null],
    [3, null, null, 31, null, 51, 60, null, 80],
  ];
}

function createEngineWithPlayers(): GameEngine {
  const engine = new GameEngine();

  engine.addPlayerTicket("player-1", createTestTicket());
  engine.addPlayerTicket("player-2", createTestTicket());

  engine.startGame();

  return engine;
}

function announceNumbers(
  engine: GameEngine,
  numbers: number[]
): void {
  for (const number of numbers) {
    engine.announceNumber(number);
  }
}

function markNumbers(
  engine: GameEngine,
  playerId: string,
  numbers: number[]
): void {
  for (const number of numbers) {
    engine.markNumber(playerId, number);
  }
}

function testFirstFiveClaim(): void {
  const engine = createEngineWithPlayers();

  const numbers = [1, 10, 20, 30, 40];

  announceNumbers(engine, numbers);
  markNumbers(engine, "player-1", numbers);

  const result = engine.claimWinner(
    "player-1",
    "FIRST_5"
  );

  assert.strictEqual(result, true);

  assert.strictEqual(
    engine.getGame().winners.length,
    1
  );

  console.log("✅ First 5 claim test passed");
}

function testIncompleteFirstFive(): void {
  const engine = createEngineWithPlayers();

  const numbers = [1, 10, 20, 30];

  announceNumbers(engine, numbers);
  markNumbers(engine, "player-1", numbers);

  const result = engine.claimWinner(
    "player-1",
    "FIRST_5"
  );

  assert.strictEqual(result, false);

  assert.strictEqual(
    engine.getGame().winners.length,
    0
  );

  console.log("✅ Incomplete First 5 test passed");
}

function testDuplicateCategoryClaim(): void {
  const engine = createEngineWithPlayers();

  const numbers = [1, 10, 20, 30, 40];

  announceNumbers(engine, numbers);

  markNumbers(engine, "player-1", numbers);
  markNumbers(engine, "player-2", numbers);

  const firstResult = engine.claimWinner(
    "player-1",
    "FIRST_5"
  );

  assert.strictEqual(firstResult, true);

  assert.throws(
    () => {
      engine.claimWinner("player-2", "FIRST_5");
    },
    /already been claimed/
  );

  assert.strictEqual(
    engine.getGame().winners.length,
    1
  );

  console.log("✅ Duplicate category claim test passed");
}

function testUnannouncedNumber(): void {
  const engine = createEngineWithPlayers();

  assert.throws(
    () => {
      engine.markNumber("player-1", 1);
    },
    /has not been announced/
  );

  console.log("✅ Unannounced number test passed");
}

function testDuplicateAnnouncement(): void {
  const engine = createEngineWithPlayers();

  engine.announceNumber(1);

  assert.throws(
    () => {
      engine.announceNumber(1);
    },
    /already been announced/
  );

  console.log("✅ Duplicate announcement test passed");
}


function testPlayerCannotJoinAfterStart(): void {
  const engine = new GameEngine();

  // Add a player before starting the game.
  engine.addPlayerTicket(
    "player-1",
    createTestTicket()
  );
  engine.addPlayerTicket(
    "player-2",
    createTestTicket()
  );

  // Start the game successfully.
  engine.startGame();

  // Try to join after the game has started.
  assert.throws(
    () => {
      engine.addPlayerTicket(
        "player-2",
        createTestTicket()
      );
    },
    /Players cannot join after the game has started/
  );

  console.log("✅ Join restriction test passed");
}

function testInvalidTicketRejected(): void {
  const engine = new GameEngine();

  const invalidTicket: Ticket = [
    [1, 2, 3, 4, 5, null, null, null, null],
    [null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null],
  ];

  assert.throws(
    () => {
      engine.addPlayerTicket(
        "player-1",
        invalidTicket
      );
    },
    /Invalid ticket/
  );

  assert.strictEqual(
    engine.getGame().playerTickets.length,
    0
  );

  console.log("✅ Invalid ticket rejection test passed");
}


function testWinnerCategoryCanBeClaimedOnlyOnce(): void {
  const engine = createEngineWithPlayers();

  const numbers = [1, 10, 20, 30, 40];

  announceNumbers(engine, numbers);

  markNumbers(engine, "player-1", numbers);
  markNumbers(engine, "player-2", numbers);

  const firstClaim = engine.claimWinner(
    "player-1",
    "FIRST_5"
  );

  assert.strictEqual(firstClaim, true);

  assert.throws(
    () => {
      engine.claimWinner("player-2", "FIRST_5");
    },
    /already been claimed/
  );

  assert.strictEqual(
    engine.getGame().winners.length,
    1
  );

  console.log(
    "✅ One-winner-per-category test passed"
  );
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


function testGameStartsWithWaitingStatus(): void {
  const engine = new GameEngine();

  assert.strictEqual(
    engine.getGame().status,
    "WAITING"
  );

  console.log("✅ Game starts with WAITING status test passed");
}


function testCannotStartEmptyGame(): void {
  const engine = new GameEngine();

  assert.throws(() => {
    engine.startGame();
  }, /Minimum 2 players are required/);

  console.log("✅ Cannot start empty game test passed");
}


function testGameStoresStartTime(): void {
  const engine = new GameEngine();

  engine.addPlayerTicket(
    "player1",
    createTestTicket()
  );
  engine.addPlayerTicket(
    "player2",
    createTestTicket()
  );
  engine.startGame();

  assert.strictEqual(
    engine.getGame().status,
    "ACTIVE"
  );

  assert.ok(
    engine.getGame().startedAt instanceof Date
  );

  console.log("✅ Game stores start time test passed");
}

function testAll90NumbersCanBeAnnounced(): void {
  const engine = createEngineWithPlayers();

  engine.getGame().config.numbersPerRound = 90;

  const announcedNumbers = new Set<number>();

  for (let i = 0; i < 90; i++) {
    const number = engine.announceNextNumber();
    announcedNumbers.add(number);
  }

  assert.strictEqual(announcedNumbers.size, 90);

  assert.strictEqual(
    engine.getGame().remainingNumbers.length,
    0
  );

  assert.strictEqual(
    engine.getGame().numbersAnnouncedThisRound,
    90
  );

  console.log(
    "✅ All 90 numbers announcement test passed"
  );
}

function testAnnouncementAfter90NumbersFails(): void {
  const engine = createEngineWithPlayers();

  engine.getGame().config.numbersPerRound = 90;

  for (let i = 0; i < 90; i++) {
    engine.announceNextNumber();
  }

  assert.throws(
    () => {
      engine.announceNextNumber();
    },
    /Maximum number of announcements for this round has been reached/
  );

  console.log(
    "✅ Announcement after 90 numbers test passed"
  );
}

function testFullHouseCannotBeClaimedEarly(): void {
  const engine = createEngineWithPlayers();

  const allNumbers = [
    1, 10, 20, 30, 40,
    2, 21, 41, 50, 70,
    3, 31, 51, 60, 80,
  ];

  announceNumbers(engine, allNumbers);

  markNumbers(engine, "player-1", allNumbers);

  assert.throws(
    () => {
      engine.claimWinner(
        "player-1",
        "FULL_HOUSE"
      );
    },
    /Full House cannot be claimed until all other winning categories have been claimed/
  );

  assert.strictEqual(
    engine.getGame().winners.length,
    0
  );

  assert.strictEqual(
    engine.getGame().status,
    "ACTIVE"
  );

  console.log(
    "✅ Early Full House rejection test passed"
  );
}

function testCompletedGameRejectsFurtherActions(): void {
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
  const result = engine.claimWinner(
    "player-1",
    "FULL_HOUSE"
  );

  assert.strictEqual(result, true);

  assert.strictEqual(
    engine.getGame().status,
    "COMPLETED"
  );

  // Cannot announce after completion
  assert.throws(
    () => {
      engine.announceNextNumber();
    },
    /Game is not active/
  );

  // Cannot mark after completion
  assert.throws(
    () => {
      engine.markNumber("player-1", 1);
    },
    /Game is not active/
  );

  // Cannot claim another winner after completion
  assert.throws(
    () => {
      engine.claimWinner("player-2", "FIRST_5");
    },
    /Game is not active/
  );

  console.log(
    "✅ Completed game rejects further actions test passed"
  );
}

function runTests(): void {
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