import assert from "assert";
import { connectDatabase, disconnectDatabase } from "../database/connection";
import { GameManager } from "../game/gameManager";
import { GameRepository } from "../repositories/gameRepository";
import { GameModel } from "../database/models/gameModel";
import { createTestTicket } from "./gameEngine.test";

describe("Game completion → next waiting game", () => {
    let repository: GameRepository;
    let gameManager: GameManager;

    beforeAll(async () => {
        await connectDatabase();
        repository = new GameRepository();
    });

    beforeEach(async () => {
        await GameModel.deleteMany({});

        gameManager = new GameManager(repository);
    });

    afterAll(async () => {
        await GameModel.deleteMany({});
        await disconnectDatabase();
    });

    test("should create a new waiting game after previous game completes", async () => {
        // Create first game
        const gameEngine = await gameManager.createGame();

        const game = gameEngine.getGame();

        // Add minimum players
        gameEngine.addPlayerTicket(
            "player-1",
            createTestTicket()
        );

        gameEngine.addPlayerTicket(
            "player-2",
            createTestTicket()
        );

        // Start game
        gameEngine.startGame();

        // Complete game
        gameEngine.completeGame();

        assert.strictEqual(
            gameEngine.getGame().status,
            "COMPLETED"
        );

        // Persist completed game
        await gameManager.saveGame(game.id);

        // Create next waiting game
        await gameManager.ensureWaitingGame();


        // Calling ensureWaitingGame again must reuse
        // the existing waiting game, not create another.
        const firstWaitingGame =
            gameManager.getWaitingGame();

        expect(firstWaitingGame).not.toBeNull();

        const secondEnsureResult =
            await gameManager.ensureWaitingGame();

        expect(secondEnsureResult).not.toBeNull();

        expect(
            secondEnsureResult!.getGame().id
        ).toBe(firstWaitingGame!.getGame().id);

        // Only one waiting game should exist in MongoDB.
        const waitingGamesAfterSecondEnsure =
            await GameModel.find({
                status: "WAITING",
            }).lean();

        expect(
            waitingGamesAfterSecondEnsure.length
        ).toBe(1);

        // Verify completed game is still present
        const completedGame = await GameModel.findOne({
            id: game.id,
        }).lean();

        assert.ok(completedGame);

        assert.strictEqual(
            completedGame!.status,
            "COMPLETED"
        );

        // Find waiting games
        const waitingGames = await GameModel.find({
            status: "WAITING",
        }).lean();

        assert.strictEqual(
            waitingGames.length,
            1
        );

        assert.notStrictEqual(
            waitingGames[0].id,
            game.id
        );

        console.log(
            "✅ New waiting game created after completion test passed"
        );
    });
});