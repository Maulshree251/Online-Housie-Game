

import { GameScheduler } from "../game/gameScheduler";
import { GameManager } from "../game/gameManager";
import { AnnouncementEngine } from "../game/announcementEngine";
import { RealtimeService } from "../realtime/realtimeService";
import { RealtimeEvent } from "../realtime/realtimeEvents";
import { GameScheduleConfig } from "../config/gameSchedule";

describe("GameScheduler", () => {
    let scheduler: GameScheduler;

    let gameManager: {
        getActiveGame: jest.Mock;
        getWaitingGame: jest.Mock;
        saveGame: jest.Mock;
    };

    let announcementEngine: {
        runWeeklyRound: jest.Mock;
    };

    let realtimeService: {
        emitToGame: jest.Mock;
    };

    let now: Date;
    let activeGame: any;
    let waitingGame: any;

    const config: GameScheduleConfig = {
        dayOfWeek: 6,
        hour: 22,
        minute: 0,
        maxPlayers: 2,
        minPlayers: 1,
        announcementIntervalInSeconds: 10,
        numbersPerRound: 10,
        autoCreateNextGame: false
    };

    const createGameEngineMock = (
        overrides: Record<string, any> = {}
    ) => {
        const game = {
            id: "game-1",
            status: "ACTIVE",
            currentRound: 1,
            roundStartedAt: new Date("2026-10-10T22:00:00"),
            playerTickets: [{ playerId: "player-1" }, { playerId: "player-2" }],
            config: {
                minPlayers: 2,
                numbersPerRound: 10,
                announcementIntervalInSeconds: 0,
            },
            ...overrides,
        };

        return {
            getGame: jest.fn(() => game),
            isRoundComplete: jest.fn(() => false),
            startNextRound: jest.fn(() => {
                game.currentRound += 1;
                game.roundStartedAt = new Date(now);
            }),
            startGame: jest.fn(() => {
                game.status = "ACTIVE";
                game.currentRound = 1;
                game.roundStartedAt = new Date(now);
            }),
            game,
        };
    };

    const createScheduler = () => {
        scheduler = new GameScheduler(
            gameManager as unknown as GameManager,
            announcementEngine as unknown as AnnouncementEngine,
            config,
            realtimeService as unknown as RealtimeService,
            () => new Date(now)
        );
    };

    beforeEach(() => {
        jest.useFakeTimers();

        now = new Date("2026-10-10T22:00:00");

        activeGame = null;
        waitingGame = null;

        gameManager = {
            getActiveGame: jest.fn(() => activeGame),
            getWaitingGame: jest.fn(() => waitingGame),
            saveGame: jest.fn().mockResolvedValue(undefined),
        };

        announcementEngine = {
            runWeeklyRound: jest.fn().mockResolvedValue(undefined),
        };

        realtimeService = {
            emitToGame: jest.fn(),
        };

        createScheduler();

        jest.spyOn(console, "log").mockImplementation(() => { });
        jest.spyOn(console, "error").mockImplementation(() => { });
    });

    afterEach(() => {
        scheduler?.stop();
        jest.clearAllTimers();
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    it("does not start a round before the configured schedule", async () => {
        now = new Date("2026-10-10T21:59:00");

        waitingGame = createGameEngineMock({
            status: "WAITING",
        });

        scheduler.start();

        await scheduler.waitForCurrentExecution();

        expect(waitingGame.startGame).not.toHaveBeenCalled();
        expect(announcementEngine.runWeeklyRound).not.toHaveBeenCalled();
    });

    it("starts an eligible waiting game at the scheduled time", async () => {
        waitingGame = createGameEngineMock({
            status: "WAITING",
        });

        scheduler.start();

        await scheduler.waitForCurrentExecution();

        expect(waitingGame.startGame).toHaveBeenCalledTimes(1);
        expect(gameManager.saveGame).toHaveBeenCalledWith("game-1");

        expect(realtimeService.emitToGame).toHaveBeenCalledWith(
            "game-1",
            RealtimeEvent.ROUND_STARTED,
            expect.objectContaining({
                gameId: "game-1",
                round: 1,
            })
        );

        expect(announcementEngine.runWeeklyRound)
            .toHaveBeenCalledWith("game-1");
    });

    it("does not start a waiting game with too few players", async () => {
        waitingGame = createGameEngineMock({
            status: "WAITING",
            playerTickets: [{ playerId: "player-1" }],
        });

        scheduler.start();

        await scheduler.waitForCurrentExecution();

        expect(waitingGame.startGame).not.toHaveBeenCalled();
        expect(gameManager.saveGame).not.toHaveBeenCalled();
        expect(announcementEngine.runWeeklyRound).not.toHaveBeenCalled();
    });

    it("advances a completed active round at the scheduled time", async () => {
        activeGame = createGameEngineMock({
            status: "ACTIVE",
            currentRound: 1,
        });

        activeGame.isRoundComplete.mockReturnValue(true);

        scheduler.start();

        await scheduler.waitForCurrentExecution();

        expect(activeGame.startNextRound).toHaveBeenCalledTimes(1);
        expect(gameManager.saveGame).toHaveBeenCalledWith("game-1");

        expect(realtimeService.emitToGame).toHaveBeenCalledWith(
            "game-1",
            RealtimeEvent.ROUND_STARTED,
            expect.objectContaining({
                gameId: "game-1",
                round: 2,
            })
        );

        expect(announcementEngine.runWeeklyRound)
            .toHaveBeenCalledWith("game-1");
    });

    it("does not advance an incomplete active round", async () => {
        activeGame = createGameEngineMock({
            status: "ACTIVE",
            currentRound: 1,
        });

        activeGame.isRoundComplete.mockReturnValue(false);

        scheduler.start();

        await scheduler.waitForCurrentExecution();

        expect(activeGame.startNextRound).not.toHaveBeenCalled();
        expect(gameManager.saveGame).not.toHaveBeenCalled();
        expect(realtimeService.emitToGame).not.toHaveBeenCalled();

        // The scheduler still calls the announcement engine.
        // The engine itself decides whether to continue the current round.
        expect(announcementEngine.runWeeklyRound)
            .toHaveBeenCalledWith("game-1");
    });

    it("does nothing when there is no active or waiting game", async () => {
        scheduler.start();

        await scheduler.waitForCurrentExecution();

        expect(gameManager.getActiveGame).toHaveBeenCalled();
        expect(gameManager.getWaitingGame).toHaveBeenCalled();
        expect(announcementEngine.runWeeklyRound).not.toHaveBeenCalled();
    });

    it("does not start a new round twice during the same scheduled minute", async () => {
        activeGame = createGameEngineMock({
            status: "ACTIVE",
            currentRound: 1,
        });

        activeGame.isRoundComplete.mockReturnValue(true);

        scheduler.start();
        await scheduler.waitForCurrentExecution();

        expect(activeGame.startNextRound).toHaveBeenCalledTimes(1);

        // A second scheduler check in the same minute must not start
        // another round.
        await jest.advanceTimersByTimeAsync(1000);

        expect(activeGame.startNextRound).toHaveBeenCalledTimes(1);
    });

    it("stops the scheduler timer", async () => {
        scheduler.start();
        await scheduler.waitForCurrentExecution();

        scheduler.stop();

        expect(jest.getTimerCount()).toBe(0);
    });
});
