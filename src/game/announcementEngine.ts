import { GameManager } from "./gameManager";

export type NumberAnnouncementHandler = (
  gameId: string,
  number: number
) => void;

export class AnnouncementEngine {
  private runningGames: Set<string> = new Set();

  constructor(
    private gameManager: GameManager,
    private onNumberAnnounced: NumberAnnouncementHandler,
    private onRoundCompleted?: (
      gameId: string,
      round: number
    ) => void
  ) { }

  public isRunning(gameId: string): boolean {
    return this.runningGames.has(gameId);
  }

  public async runWeeklyRound(gameId: string): Promise<void> {
    if (this.runningGames.has(gameId)) {
      console.log(
        `Announcement round already running for game ${gameId}.`
      );

      return;
    }

    this.runningGames.add(gameId);

    try {
      const gameEngine = this.gameManager.getGame(gameId);
      const game = gameEngine.getGame();

      if (game.status !== "ACTIVE") {
        console.log(
          `Game ${gameId} is not active.`
        );

        return;
      }

      console.log(
        `Starting Round ${game.currentRound} for game ${gameId}.`
      );

      while (
        !gameEngine.isRoundComplete() &&
        gameEngine.getGame().status === "ACTIVE"
      ) {
        const announcementStart = Date.now();

        const number = gameEngine.announceNextNumber();

        await this.gameManager.saveGame(gameId);

        console.log(
          `Game ${gameId}: announced ${number} ` +
          `(${gameEngine.getGame().numbersAnnouncedThisRound}/` +
          `${game.config.numbersPerRound})`
        );

        // Realtime NUMBER_ANNOUNCED event
        this.onNumberAnnounced(gameId, number);

        if (gameEngine.isRoundComplete()) {
          break;
        }

        await this.wait(
          game.config.announcementIntervalInSeconds * 1000
        );

        console.log(
          `Game ${gameId}: total announcement cycle took ` +
          `${Date.now() - announcementStart} ms`
        );
      }

      // Only announce ROUND_COMPLETED if
      // the configured number of announcements was reached.
      if (gameEngine.isRoundComplete()) {
        const completedRound =
          gameEngine.getGame().currentRound;

        console.log(
          `Round ${completedRound} completed for game ${gameId}.`
        );

        this.onRoundCompleted?.(
          gameId,
          completedRound
        );
      }

    } finally {
      this.runningGames.delete(gameId);
    }
  }

  private wait(milliseconds: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, milliseconds);
    });
  }
}