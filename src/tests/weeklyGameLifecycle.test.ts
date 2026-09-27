import { GameManager } from "../game/gameManager";
import { GameRepository } from "../repositories/gameRepository";
import { GameScheduler } from "../game/gameScheduler";
import { AnnouncementEngine } from "../game/announcementEngine";

import {
    connectDatabase,
    disconnectDatabase,
} from "../database/connection";

import { generateTicketLayout } from "../tickets/ticketGenerator";
import { gameSchedule, GameScheduleConfig } from "../config/gameSchedule";

describe("Weekly Game Lifecycle", () => {
    let gameManager: GameManager;
    let gameRepository: GameRepository;
    let announcementEngine: AnnouncementEngine;
    let scheduler: GameScheduler;

    let testGameId: string | null = null;

    beforeAll(async () => {
        await connectDatabase();

        gameRepository = new GameRepository();

        gameManager =
            new GameManager(gameRepository);

        announcementEngine =
            new AnnouncementEngine(
                gameManager,
                (gameId, number) => {
                    console.log(
                        `TEST: Game ${gameId} announced ${number}`
                    );
                }
            );

        const now = new Date();

        const scheduleConfig: GameScheduleConfig = {
            ...gameSchedule,
            dayOfWeek: now.getDay(),
            hour: now.getHours(),
            minute: now.getMinutes(),
        };

        scheduler =
            new GameScheduler(
                gameManager,
                announcementEngine,
                scheduleConfig
            );
    });

    afterAll(async () => {
        scheduler.stop();

        await scheduler.waitForCurrentExecution();

        if (testGameId) {
            await gameRepository.delete(
                testGameId
            );
        }

        await disconnectDatabase();
    });

    it(
        "should continue the same active game into the next weekly round",
        async () => {

            // --------------------------------
            // CREATE WAITING GAME
            // --------------------------------

            const waitingGame =
                await gameManager.createGame(
                    20,
                    1,
                    10,
                    1
                );

            const gameId =
                waitingGame.getGame().id;

            testGameId = gameId;

            const gameEngine =
                gameManager.getGame(gameId);

            // --------------------------------
            // ADD MINIMUM PLAYER
            // --------------------------------

            const playerId =
                "weekly-test-player";

            gameEngine.addPlayerTicket(
                playerId,
                generateTicketLayout()
            );

            await gameManager.saveGame(
                gameId
            );

            // --------------------------------
            // WEEK 1 / ROUND 1
            // --------------------------------

            await scheduler.runScheduledGameNow();

            let game =
                gameManager
                    .getGame(gameId)
                    .getGame();

            expect(game.status).toBe(
                "ACTIVE"
            );

            expect(game.currentRound).toBe(
                1
            );

            expect(
                game.numbersAnnouncedThisRound
            ).toBe(10);

            expect(
                game.announcedNumbers.length
            ).toBe(10);

            // Save Round 1 numbers
            const round1Numbers =
                [...game.announcedNumbers];

            expect(
                new Set(round1Numbers).size
            ).toBe(10);

            console.log(
                "🎉 Round 1 completed!"
            );

            // --------------------------------
            // SIMULATE NEXT SATURDAY
            // --------------------------------
            //
            // We don't actually wait a week.
            // runScheduledGameNow() directly
            // triggers the scheduler logic.
            //
            // --------------------------------

            await scheduler.runScheduledGameNow();

            game =
                gameManager
                    .getGame(gameId)
                    .getGame();

            // --------------------------------
            // VERIFY ROUND 2
            // --------------------------------

            expect(game.status).toBe(
                "ACTIVE"
            );

            expect(game.currentRound).toBe(
                2
            );

            expect(
                game.numbersAnnouncedThisRound
            ).toBe(10);

            expect(
                game.announcedNumbers.length
            ).toBe(20);

            // --------------------------------
            // VERIFY ROUND 1 NUMBERS REMAIN
            // --------------------------------

            for (
                const number of round1Numbers
            ) {
                expect(
                    game.announcedNumbers
                ).toContain(number);
            }

            // --------------------------------
            // VERIFY ALL NUMBERS ARE UNIQUE
            // --------------------------------

            const allNumbers =
                new Set(
                    game.announcedNumbers
                );

            expect(
                allNumbers.size
            ).toBe(20);

            // --------------------------------
            // VERIFY 10 NEW NUMBERS
            // --------------------------------

            const round2Numbers =
                game.announcedNumbers.slice(
                    10
                );

            expect(
                round2Numbers.length
            ).toBe(10);

            for (
                const number of round2Numbers
            ) {
                expect(
                    round1Numbers
                ).not.toContain(number);
            }

            // --------------------------------
            // VERIFY REMAINING NUMBERS
            // --------------------------------

            expect(
                game.remainingNumbers.length
            ).toBe(70);

            // --------------------------------
            // VERIFY PERSISTENCE
            // --------------------------------

            const persistedGame =
                await gameRepository
                    .findById(gameId);

            expect(
                persistedGame
            ).not.toBeNull();

            expect(
                persistedGame!.status
            ).toBe("ACTIVE");

            expect(
                persistedGame!.currentRound
            ).toBe(2);

            expect(
                persistedGame!
                    .numbersAnnouncedThisRound
            ).toBe(10);

            expect(
                persistedGame!
                    .announcedNumbers.length
            ).toBe(20);

            console.log(
                "🎉 Weekly Round 2 lifecycle test passed!"
            );
        },
        30000
    );
});