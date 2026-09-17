
import assert from "assert";
import { GameEngine } from "../game/gameEngine";
import { Ticket } from "../models/ticket";


function createTestTicket(): Ticket {
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

  engine.startGame();

  assert.throws(
    () => {
      engine.addPlayerTicket(
        "player-1",
        createTestTicket()
      );
    },
    /cannot join after the game has started/
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

function testFullHouseCompletesGame(): void {
  const engine = createEngineWithPlayers();

  const allNumbers = [
    1, 10, 20, 30, 40,
    2, 21, 41, 50, 70,
    3, 31, 51, 60, 80,
  ];

  announceNumbers(engine, allNumbers);

  markNumbers(engine, "player-1", allNumbers);

  const result = engine.claimWinner(
    "player-1",
    "FULL_HOUSE"
  );

  assert.strictEqual(result, true);

  assert.strictEqual(
    engine.getGame().status,
    "COMPLETED"
  );

  console.log("✅ Full House completion test passed");
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
  testFullHouseCompletesGame();

  console.log("\n🎉 All tests passed!\n");
}

runTests();