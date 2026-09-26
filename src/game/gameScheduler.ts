import { GameManager } from "./gameManager";
import { GameEngine } from "./gameEngine";
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

        console.log("Game scheduler started.");

        void this.checkSchedule();

        this.interval = setInterval(() => {
            void this.checkSchedule();
        }, 1000);
    }

    public stop(): void {
        if (!this.interval) {
            return;
        }

        clearInterval(this.interval);
        this.interval = null;

        console.log("Game scheduler stopped.");
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
        const games = this.gameManager.getAllGames();

        /*
         * First look for an ACTIVE game.
         *
         * If one exists, this means the previous game
         * was not completed with Full House.
         */
        const activeGame = games.find(
            game => game.getGame().status === "ACTIVE"
        );

        if (activeGame) {
            const game = activeGame.getGame();

            console.log(
                `Continuing game ${game.id}, Round ${game.currentRound + 1}.`
            );

            if (activeGame.isRoundComplete()) {
                activeGame.startNextRound();

                await this.gameManager.saveGame(game.id);
            }

            void this.announcementEngine.runWeeklyRound(game.id);

            return;
        }

        /*
         * No active game means we need a new game.
         */
        const waitingGame = games.find(
            game => game.getGame().status === "WAITING"
        );

        if (!waitingGame) {
            console.log(
                "No waiting game available for this Saturday."
            );

            return;
        }

        const game = waitingGame.getGame();

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

        waitingGame.startGame();

        await this.gameManager.saveGame(game.id);

        console.log(
            `Game ${game.id} started. Round 1 begins.`
        );

        void this.announcementEngine.runWeeklyRound(game.id);
    }
}