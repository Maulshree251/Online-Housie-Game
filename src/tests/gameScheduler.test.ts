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

describe("Game Scheduler", () => {
    let gameManager: GameManager;
    let gameRepository: GameRepository;
    let announcementEngine: AnnouncementEngine;
    let scheduler: GameScheduler;

    let testGameId: string | null = null;

    beforeAll(async () => {
        await connectDatabase();

        gameRepository =
            new GameRepository();
    });

    afterEach(async () => {
        if (scheduler) {
            scheduler.stop();

            await scheduler.waitForCurrentExecution();
        }

        if (testGameId) {
            await gameRepository.delete(
                testGameId
            );

            testGameId = null;
        }
    });

    beforeEach(() => {
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
    });

    afterAll(async () => {
        await disconnectDatabase();
    });

    // ========================================
    // TEST 1
    // ========================================

    it(
        "should start a game when the scheduled time matches",
        async () => {
            const scheduledTime =
                new Date(
                    "2026-10-03T22:00:00"
                );

            const scheduleConfig: GameScheduleConfig =
            {
                ...gameSchedule,
                dayOfWeek:
                    scheduledTime.getDay(),

                hour:
                    scheduledTime.getHours(),

                minute:
                    scheduledTime.getMinutes(),
            };

            scheduler =
                new GameScheduler(
                    gameManager,
                    announcementEngine,
                    scheduleConfig,
                    () => scheduledTime
                );

            // --------------------------------
            // CREATE WAITING GAME
            // --------------------------------

            const waitingGame =
                await gameManager.createGame(
                    20,
                    1,
                    1,
                    0
                );

            testGameId =
                waitingGame.getGame().id;

            const gameEngine =
                gameManager.getGame(
                    testGameId
                );

            gameEngine.addPlayerTicket(
                "scheduler-test-player",
                generateTicketLayout()
            );

            await gameManager.saveGame(
                testGameId
            );

            // --------------------------------
            // RUN REAL SCHEDULE CHECK
            // --------------------------------

            await (
                scheduler as any
            ).checkSchedule();

            // --------------------------------
            // VERIFY
            // --------------------------------

            const game =
                gameManager
                    .getGame(testGameId)
                    .getGame();

            expect(game.status).toBe(
                "ACTIVE"
            );

            expect(game.currentRound).toBe(
                1
            );

            expect(
                game.numbersAnnouncedThisRound
            ).toBe(1);

            expect(
                game.announcedNumbers.length
            ).toBe(1);

            console.log(
                "🎉 Scheduler trigger test passed!"
            );
        },
        30000
    );

    // ========================================
    // TEST 2
    // ========================================

    it(
        "should not start a game when the scheduled time does not match",
        async () => {
            const currentTime =
                new Date(
                    "2026-10-03T21:59:00"
                );

            const scheduledTime =
                new Date(
                    "2026-10-03T22:00:00"
                );

            const scheduleConfig:
                GameScheduleConfig = {
                ...gameSchedule,
                dayOfWeek:
                    scheduledTime.getDay(),

                hour:
                    scheduledTime.getHours(),

                minute:
                    scheduledTime.getMinutes(),
            };

            scheduler =
                new GameScheduler(
                    gameManager,
                    announcementEngine,
                    scheduleConfig,
                    () => currentTime
                );

            // --------------------------------
            // CREATE WAITING GAME
            // --------------------------------

            const waitingGame =
                await gameManager.createGame(
                    20,
                    1,
                    1,
                    0
                );

            testGameId =
                waitingGame.getGame().id;

            const gameEngine =
                gameManager.getGame(
                    testGameId
                );

            gameEngine.addPlayerTicket(
                "scheduler-test-player",
                generateTicketLayout()
            );

            await gameManager.saveGame(
                testGameId
            );

            // --------------------------------
            // RUN SCHEDULE CHECK
            // --------------------------------

            await (
                scheduler as any
            ).checkSchedule();

            // --------------------------------
            // VERIFY GAME DID NOT START
            // --------------------------------

            const game =
                gameManager
                    .getGame(testGameId)
                    .getGame();

            expect(game.status).toBe(
                "WAITING"
            );

            expect(
                game.numbersAnnouncedThisRound
            ).toBe(0);

            expect(
                game.announcedNumbers.length
            ).toBe(0);

            console.log(
                "🎉 Scheduler wrong-time test passed!"
            );
        },
        30000
    );

    // ========================================
    // TEST 3
    // ========================================

    it(
        "should not trigger the same scheduled minute more than once",
        async () => {
            const scheduledTime =
                new Date(
                    "2026-10-03T22:00:00"
                );

            let currentTime =
                scheduledTime;

            const scheduleConfig:
                GameScheduleConfig = {
                ...gameSchedule,
                dayOfWeek:
                    scheduledTime.getDay(),

                hour:
                    scheduledTime.getHours(),

                minute:
                    scheduledTime.getMinutes(),
            };

            scheduler =
                new GameScheduler(
                    gameManager,
                    announcementEngine,
                    scheduleConfig,
                    () => currentTime
                );

            // --------------------------------
            // CREATE WAITING GAME
            // --------------------------------

            const waitingGame =
                await gameManager.createGame(
                    20,
                    1,
                    1,
                    0
                );

            testGameId =
                waitingGame.getGame().id;

            const gameEngine =
                gameManager.getGame(
                    testGameId
                );

            gameEngine.addPlayerTicket(
                "scheduler-test-player",
                generateTicketLayout()
            );

            await gameManager.saveGame(
                testGameId
            );

            // --------------------------------
            // FIRST CHECK
            // --------------------------------

            await (
                scheduler as any
            ).checkSchedule();

            let game =
                gameManager
                    .getGame(testGameId)
                    .getGame();

            expect(game.status).toBe(
                "ACTIVE"
            );

            expect(
                game.announcedNumbers.length
            ).toBe(1);

            // --------------------------------
            // SAME MINUTE, ONE SECOND LATER
            // --------------------------------

            currentTime =
                new Date(
                    "2026-10-03T22:00:01"
                );

            await (
                scheduler as any
            ).checkSchedule();

            game =
                gameManager
                    .getGame(testGameId)
                    .getGame();

            // --------------------------------
            // VERIFY NO SECOND TRIGGER
            // --------------------------------

            expect(game.currentRound).toBe(
                1
            );

            expect(
                game.announcedNumbers.length
            ).toBe(1);

            console.log(
                "🎉 Scheduler duplicate-trigger test passed!"
            );
        },
        30000
    );
});