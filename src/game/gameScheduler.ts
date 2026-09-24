import { GameManager } from "./gameManager";

export class GameScheduler {
    private gameManager: GameManager;

    private interval: NodeJS.Timeout | null = null;

    constructor(gameManager: GameManager) {
        this.gameManager = gameManager;
    }

    public start(): void {
        if (this.interval) {
            return;
        }

        console.log("Game scheduler started.");

        this.interval = setInterval(() => {
            this.checkGames();
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

    private async checkGames(): Promise<void> {
        const games = this.gameManager.getAllGames();

        for (const gameEngine of games) {
            try {
                if (gameEngine.expireGameIfNeeded()) {
                    console.log(
                        `Game ${gameEngine.getGame().id} expired.`
                    );

                    // We will persist this through GameManager.
                    await this.gameManager.saveGame(
                        gameEngine.getGame().id
                    );
                }
            } catch (error) {
                console.error(
                    `Error processing game ${gameEngine.getGame().id}:`,
                    error
                );
            }
        }
    }
}