import { GameManager } from "./gameManager";
import { AnnouncementEngine } from "./announcementEngine";
import {
    GameScheduleConfig,
} from "../config/gameSchedule";

export class GameScheduler {
    private gameManager: GameManager;
    private announcementEngine: AnnouncementEngine;
    private config: GameScheduleConfig;

    private interval: NodeJS.Timeout | null = null;
    private lastScheduleKey: string | null = null;

    // Tracks the currently executing scheduled task.
    private currentExecution: Promise<void> | null = null;

    constructor(
        gameManager: GameManager,
        announcementEngine: AnnouncementEngine,
        config: GameScheduleConfig
    ) {
        this.gameManager = gameManager;
        this.announcementEngine = announcementEngine;
        this.config = config;
    }

    public start(): void {
        if (this.interval) {
            return;
        }

        this.currentExecution = this.checkSchedule();

        void this.currentExecution.finally(() => {
            this.currentExecution = null;
        });

        this.interval = setInterval(() => {
            void this.runScheduleCheck();
        }, 1000);
    }
    public stop(): void {
        if (!this.interval) {
            return;
        }

        clearInterval(this.interval);
        this.interval = null;

    }

    /**
     * Waits for the currently running scheduled operation.
     *
     * Useful for integration tests and graceful shutdown.
     */
    public async waitForCurrentExecution(): Promise<void> {
        const execution = this.currentExecution;

        if (!execution) {
            return;
        }

        await execution;
    }
    private async checkSchedule(): Promise<void> {
        try {
            const now = new Date();

            const day = now.getDay();
            const hour = now.getHours();
            const minute = now.getMinutes();

            if (
                day !== this.config.dayOfWeek ||
                hour !== this.config.hour ||
                minute !== this.config.minute
            ) {
                return;
            }

            const scheduleKey =
                `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${hour}:${minute}`;

            if (this.lastScheduleKey === scheduleKey) {
                return;
            }

            this.lastScheduleKey = scheduleKey;

            await this.startWeeklyRound();

        } catch (error) {
            console.error("Scheduler error:", error);
        }
    }


    private async startWeeklyRound(): Promise<void> {

        // --------------------------------------------
        // 1. Check whether a game is already ACTIVE
        // --------------------------------------------
        const activeGame = this.gameManager.getActiveGame();

        if (activeGame) {
            const game = activeGame.getGame();

            console.log(
                `Continuing game ${game.id}, ` +
                `starting Round ${game.currentRound + 1}.`
            );

            if (activeGame.isRoundComplete()) {
                activeGame.startNextRound();

                await this.gameManager.saveGame(game.id);
            }

            // IMPORTANT:
            // Wait for the complete announcement round.
            await this.announcementEngine.runWeeklyRound(
                game.id
            );
            return;
        }

        // --------------------------------------------
        // 2. No ACTIVE game
        //    Find the WAITING registration game
        // --------------------------------------------

        const waitingGame = this.gameManager.getWaitingGame();

        if (!waitingGame) {
            console.log(
                "No waiting game available for this Saturday."
            );

            return;
        }

        const game = waitingGame.getGame();

        // --------------------------------------------
        // 3. Check minimum players
        // --------------------------------------------

        if (
            game.playerTickets.length <
            game.config.minPlayers
        ) {
            console.log(
                `Waiting game ${game.id} has only ` +
                `${game.playerTickets.length} player(s). ` +
                `Minimum required: ${game.config.minPlayers}.`
            );

            return;
        }

        // --------------------------------------------
        // 4. Start the waiting game
        // --------------------------------------------

        waitingGame.startGame();

        await this.gameManager.saveGame(game.id);

        console.log(
            `Game ${game.id} started. Round 1 begins.`
        );

        // --------------------------------------------
        // 5. Start automatic announcements
        // --------------------------------------------

        // IMPORTANT:
        // Await the entire 10-number round.

        console.log(
            "SCHEDULER interval =",
            waitingGame.getGame().config.announcementIntervalInSeconds
        );


        await this.announcementEngine.runWeeklyRound(
            game.id
        );


    }
    private async runScheduleCheck(): Promise<void> {
        if (this.currentExecution) {
            return;
        }

        const execution = this.checkSchedule();

        this.currentExecution = execution;

        try {
            await execution;

        } finally {

            if (this.currentExecution === execution) {
                this.currentExecution = null;
            }
        }
    }

    public async runScheduledGameNow(): Promise<void> {
        await this.startWeeklyRound();
    }



}
