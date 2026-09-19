
import { GameEngine } from "./gameEngine";

export class GameManager {
  private games: Map<string, GameEngine>;

  constructor() {
    this.games = new Map<string, GameEngine>();
  }

  // Create a new game
  public createGame(): GameEngine {
    const gameEngine = new GameEngine();

    const gameId = gameEngine.getGame().id;

    this.games.set(gameId, gameEngine);

    return gameEngine;
  }

  // Find a game using its ID
  public getGame(gameId: string): GameEngine {
    const gameEngine = this.games.get(gameId);

    if (!gameEngine) {
      throw new Error("Game not found.");
    }

    return gameEngine;
  }

  // Check whether a game exists
  public hasGame(gameId: string): boolean {
    return this.games.has(gameId);
  }

  // Remove a game
  public removeGame(gameId: string): void {
    const removed = this.games.delete(gameId);

    if (!removed) {
      throw new Error("Game not found.");
    }
  }

  // Get the number of active game sessions
  public getGameCount(): number {
    return this.games.size;
  }
}