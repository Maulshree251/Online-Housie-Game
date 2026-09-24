
import { GameRepository } from "../repositories/gameRepository";
import assert from "assert";
import { GameManager } from "../game/gameManager";

async function testCreateGame(): Promise<void> {
    const manager = new GameManager();

    const game = await manager.createGame();
    const gameId = game.getGame().id;

    assert.ok(gameId);
    assert.strictEqual(manager.hasGame(gameId), true);

    console.log("✅ Create game test passed");
}

async function testGetGame(): Promise<void> {
    const manager = new GameManager();

    const createdGame = await manager.createGame();
    const gameId = createdGame.getGame().id;

    const retrievedGame = manager.getGame(gameId);

    assert.strictEqual(
        retrievedGame.getGame().id,
        gameId
    );

    console.log("✅ Get game test passed");
}

async function testMultipleGames(): Promise<void> {
    const manager = new GameManager();

    const game1 = await manager.createGame();
    const game2 = await manager.createGame();

    const game1Id = game1.getGame().id;
    const game2Id = game2.getGame().id;

    assert.notStrictEqual(game1Id, game2Id);
    assert.strictEqual(manager.getAllGames().length, 2);

    console.log("✅ Multiple games test passed");
}

async function testRemoveGame(): Promise<void> {
    const manager = new GameManager();

    const game = await manager.createGame();
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

async function runTests(): Promise<void> {
    console.log("\n===== GAME MANAGER TESTS =====\n");

    await testCreateGame();
    await testGetGame();
    await testMultipleGames();
    await testRemoveGame();
    testGameNotFound();

    console.log("\n🎉 All Game Manager tests passed!\n");
}

runTests();