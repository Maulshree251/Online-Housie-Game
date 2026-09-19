
import { GameRepository } from "../repositories/gameRepository";
import assert from "assert";
import { GameManager } from "../game/gameManager";

function testCreateGame(): void {
    const manager = new GameManager();

    const game = manager.createGame();
    const gameId = game.getGame().id;

    assert.ok(gameId);
    assert.strictEqual(manager.hasGame(gameId), true);

    console.log("✅ Create game test passed");
}

function testGetGame(): void {
    const manager = new GameManager();

    const createdGame = manager.createGame();
    const gameId = createdGame.getGame().id;

    const retrievedGame = manager.getGame(gameId);

    assert.strictEqual(
        retrievedGame.getGame().id,
        gameId
    );

    console.log("✅ Get game test passed");
}

function testMultipleGames(): void {
    const manager = new GameManager();

    const game1 = manager.createGame();
    const game2 = manager.createGame();

    const game1Id = game1.getGame().id;
    const game2Id = game2.getGame().id;

    assert.notStrictEqual(game1Id, game2Id);
    assert.strictEqual(manager.getAllGames().length, 2);

    console.log("✅ Multiple games test passed");
}

function testRemoveGame(): void {
    const manager = new GameManager();

    const game = manager.createGame();
    const gameId = game.getGame().id;

    const removed = manager.removeGame(gameId);

    assert.strictEqual(removed, true);
    assert.strictEqual(manager.hasGame(gameId), false);

    console.log("✅ Remove game test passed");
}

function testGameNotFound(): void {
    const manager = new GameManager();

    assert.throws(
        () => {
            manager.getGame("invalid-game-id");
        },
        /Game not found/
    );

    console.log("✅ Game not found test passed");
}

function runTests(): void {
    console.log("\n===== GAME MANAGER TESTS =====\n");

    testCreateGame();
    testGetGame();
    testMultipleGames();
    testRemoveGame();
    testGameNotFound();

    console.log("\n🎉 All Game Manager tests passed!\n");
}

runTests();