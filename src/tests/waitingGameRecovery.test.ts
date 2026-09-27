import { GameManager } from "../game/gameManager";
import { GameRepository } from "../repositories/gameRepository";

import {
    connectDatabase,
    disconnectDatabase,
} from "../database/connection";

import { GameModel } from "../database/models/gameModel";

describe("Waiting Game Recovery", () => {
    let gameRepository: GameRepository;

    let firstGameManager: GameManager;
    let restartedGameManager: GameManager;

    let testGameId: string | null = null;

    beforeAll(async () => {
        await connectDatabase();

        gameRepository = new GameRepository();

        firstGameManager =
            new GameManager(gameRepository);
    });

    afterAll(async () => {
        if (testGameId) {
            await GameModel.deleteOne({
                id: testGameId,
            });
        }

        await disconnectDatabase();
    });

    it(
        "should recover an existing waiting game and prevent duplicate creation",
        async () => {
            // --------------------------------
            // CREATE WAITING GAME
            // --------------------------------

            const waitingGame =
                await firstGameManager.createGame(
                    20,
                    2,
                    10,
                    1
                );

            const originalGame =
                waitingGame.getGame();

            testGameId = originalGame.id;

            expect(
                originalGame.status
            ).toBe("WAITING");

            // --------------------------------
            // SIMULATE SERVER SHUTDOWN
            // --------------------------------

            // The game is already persisted by
            // createGame(), so we don't need
            // to save it again.

            const savedBeforeRestart =
                await GameModel.findOne({
                    id: testGameId,
                }).lean();

            expect(
                savedBeforeRestart
            ).not.toBeNull();

            expect(
                savedBeforeRestart?.status
            ).toBe("WAITING");

            // --------------------------------
            // SIMULATE SERVER RESTART
            // --------------------------------

            restartedGameManager =
                new GameManager(gameRepository);

            // Before recovery the new manager
            // should not know about the game.

            expect(() => {
                restartedGameManager.getGame(
                    testGameId!
                );
            }).toThrow("Game not found.");

            // --------------------------------
            // RECOVER WAITING GAME
            // --------------------------------

            await restartedGameManager.recoverGames();

            // --------------------------------
            // VERIFY RECOVERY
            // --------------------------------

            const recoveredGameEngine =
                restartedGameManager.getGame(
                    testGameId
                );

            const recoveredGame =
                recoveredGameEngine.getGame();

            expect(
                recoveredGame.id
            ).toBe(originalGame.id);

            expect(
                recoveredGame.status
            ).toBe("WAITING");

            expect(
                recoveredGame.config.maxPlayers
            ).toBe(20);

            expect(
                recoveredGame.config.minPlayers
            ).toBe(2);

            expect(
                recoveredGame.config.numbersPerRound
            ).toBe(10);

            expect(
                recoveredGame.config
                    .announcementIntervalInSeconds
            ).toBe(1);

            // --------------------------------
            // CHECK WAITING GAME
            // --------------------------------

            const waitingGameAfterRecovery =
                restartedGameManager.getWaitingGame();

            expect(
                waitingGameAfterRecovery
            ).not.toBeNull();

            expect(
                waitingGameAfterRecovery!
                    .getGame().id
            ).toBe(testGameId);

            // --------------------------------
            // ENSURE WAITING GAME
            // --------------------------------

            await restartedGameManager
                .ensureWaitingGame();

            // --------------------------------
            // VERIFY NO DUPLICATE
            // --------------------------------

            const waitingGames =
                await GameModel.find({
                    status: "WAITING",
                }).lean();

            const matchingGames =
                waitingGames.filter(
                    (game) =>
                        game.id === testGameId
                );

            expect(
                matchingGames.length
            ).toBe(1);

            // There should still be exactly
            // one waiting game in this test DB.

            expect(
                waitingGames.length
            ).toBe(1);

            console.log(
                "🎉 Waiting game recovery and duplicate prevention test passed!"
            );
        },
        30000
    );
});