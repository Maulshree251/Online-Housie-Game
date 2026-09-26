import { GameManager } from "./gameManager";

export type NumberAnnouncementHandler = (
  gameId: string,
  number: number
) => void;

export class AnnouncementEngine {
  private gameManager: GameManager;
  private onNumberAnnounced: NumberAnnouncementHandler;

  constructor(
    gameManager: GameManager,
    onNumberAnnounced: NumberAnnouncementHandler
  ) {
    this.gameManager = gameManager;
    this.onNumberAnnounced = onNumberAnnounced;
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
        const number = gameEngine.announceNextNumber();

        await this.gameManager.saveGame(gameId);

        console.log(
          `Game ${gameId}: announced ${number} ` +
          `(${gameEngine.getGame().numbersAnnouncedThisRound}/` +
          `${game.config.numbersPerRound})`
        );

        this.onNumberAnnounced(gameId, number);

        if (gameEngine.isRoundComplete()) {
          break;
        }

        await this.wait(
          game.config.announcementIntervalInSeconds * 1000
        );
      }

      console.log(
        `Round ${game.currentRound} completed for game ${gameId}.`
      );

    } finally {
      this.runningGames.delete(gameId);
    }
  }

  private wait(milliseconds: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, milliseconds);
    });
  }

  private runningGames: Set<string> = new Set();
}