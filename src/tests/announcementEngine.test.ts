
import { AnnouncementEngine } from "../game/announcementEngine";
import { GameManager } from "../game/gameManager";

describe("AnnouncementEngine", () => {
    let engine: AnnouncementEngine;
    let gameManager: {
        getGame: jest.Mock;
        saveGame: jest.Mock;
    };
    let onNumberAnnounced: jest.Mock;
    let onRoundCompleted: jest.Mock;

    let game: any;
    let gameEngine: {
        getGame: jest.Mock;
        isRoundComplete: jest.Mock;
        announceNextNumber: jest.Mock;
    };

    beforeEach(() => {
        jest.useFakeTimers();

        game = {
            id: "game-1",
            status: "ACTIVE",
            currentRound: 1,
            numbersAnnouncedThisRound: 0,
            config: {
                numbersPerRound: 3,
                announcementIntervalInSeconds: 1,
            },
        };

        gameEngine = {
            getGame: jest.fn(() => game),
            isRoundComplete: jest.fn(
                () => game.numbersAnnouncedThisRound >= game.config.numbersPerRound
            ),
            announceNextNumber: jest.fn(() => {
                game.numbersAnnouncedThisRound++;
                return game.numbersAnnouncedThisRound * 10;
            }),
        };

        gameManager = {
            getGame: jest.fn(() => gameEngine),
            saveGame: jest.fn().mockResolvedValue(undefined),
        };

        onNumberAnnounced = jest.fn();
        onRoundCompleted = jest.fn();

        engine = new AnnouncementEngine(
            gameManager as unknown as GameManager,
            onNumberAnnounced,
            onRoundCompleted
        );

        jest.spyOn(console, "log").mockImplementation(() => { });
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    async function finishAnnouncements(): Promise<void> {
        // Flush async work and advance the interval between announcements.
        for (let i = 0; i < 10 && engine.isRunning("game-1"); i++) {
            await Promise.resolve();
            await jest.advanceTimersByTimeAsync(1000);
        }

        await Promise.resolve();
    }

    it("announces the configured number of numbers and completes the round", async () => {
        const result = engine.runWeeklyRound("game-1");

        await finishAnnouncements();
        await result;

        expect(gameEngine.announceNextNumber).toHaveBeenCalledTimes(3);
        expect(gameManager.saveGame).toHaveBeenCalledTimes(3);
        expect(onNumberAnnounced).toHaveBeenCalledTimes(3);
        expect(onRoundCompleted).toHaveBeenCalledWith("game-1", 1);
        expect(engine.isRunning("game-1")).toBe(false);
    });

    it("does not run announcements when the game is not active", async () => {
        game.status = "WAITING";

        await engine.runWeeklyRound("game-1");

        expect(gameEngine.announceNextNumber).not.toHaveBeenCalled();
        expect(gameManager.saveGame).not.toHaveBeenCalled();
        expect(onNumberAnnounced).not.toHaveBeenCalled();
        expect(onRoundCompleted).not.toHaveBeenCalled();
        expect(engine.isRunning("game-1")).toBe(false);
    });

    it("does not run two announcement loops for the same game", async () => {
        game.config.numbersPerRound = 2;

        const firstRun = engine.runWeeklyRound("game-1");

        // Allow the first call to reach its first wait.
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(engine.isRunning("game-1")).toBe(true);

        await engine.runWeeklyRound("game-1");

        expect(gameEngine.announceNextNumber).toHaveBeenCalledTimes(1);

        await finishAnnouncements();
        await firstRun;
    });

    it("does not emit round completion before the round is complete", async () => {
        game.config.numbersPerRound = 1;

        // Fail before the first number is announced.
        gameEngine.announceNextNumber.mockImplementationOnce(() => {
            throw new Error("Announcement failed");
        });

        await expect(
            engine.runWeeklyRound("game-1")
        ).rejects.toThrow("Announcement failed");

        expect(onRoundCompleted).not.toHaveBeenCalled();
        expect(engine.isRunning("game-1")).toBe(false);
    });

    it("releases the running lock if persistence fails", async () => {
        gameManager.saveGame.mockRejectedValueOnce(
            new Error("Database save failed")
        );

        await expect(
            engine.runWeeklyRound("game-1")
        ).rejects.toThrow("Database save failed");

        expect(engine.isRunning("game-1")).toBe(false);
        expect(onNumberAnnounced).not.toHaveBeenCalled();
        expect(onRoundCompleted).not.toHaveBeenCalled();
    });

    it("does not throw when the round completes without a completion callback", async () => {
        game.config.numbersPerRound = 1;
        game.config.announcementIntervalInSeconds = 0;

        gameEngine.announceNextNumber.mockImplementation(() => {
            game.numbersAnnouncedThisRound = 1;
            return 42;
        });

        const engineWithoutCallback = new AnnouncementEngine(
            gameManager as any,
            onNumberAnnounced
        );

        await expect(
            engineWithoutCallback.runWeeklyRound("game-1")
        ).resolves.toBeUndefined();

        expect(gameEngine.isRoundComplete()).toBe(true);
        expect(engineWithoutCallback.isRunning("game-1")).toBe(false);
    });
});
