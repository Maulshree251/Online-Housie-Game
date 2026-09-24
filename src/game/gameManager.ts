
import { GameEngine } from "./gameEngine";
import { GameRepository } from "../repositories/gameRepository";

export class GameManager {
  private games: Map<string, GameEngine>;
  private gameRepository: GameRepository;

  constructor(gameRepository: GameRepository = new GameRepository()) {
    this.games = new Map<string, GameEngine>();
    this.gameRepository = gameRepository;
  }


  public async createGame(): Promise<GameEngine> {
    const gameEngine = new GameEngine();

    const gameId = gameEngine.getGame().id;

    this.games.set(gameId, gameEngine);

    await this.gameRepository.create(
      gameEngine.getGame()
    );

    return gameEngine;
  }


  public getGame(gameId: string): GameEngine {
    const gameEngine = this.games.get(gameId);

    if (!gameEngine) {
      throw new Error("Game not found.");
    }

    return gameEngine;
  }


  public hasGame(gameId: string): boolean {
    return this.games.has(gameId);
  }


  public removeGame(gameId: string): boolean {
    return this.games.delete(gameId);
  }


  public getAllGames(): GameEngine[] {
    return Array.from(this.games.values());
  }


  public async saveGame(gameId: string): Promise<void> {
    const gameEngine = this.getGame(gameId);

    await this.gameRepository.save(
      gameEngine.getGame()
    );
  }


  public async loadGame(gameId: string): Promise<GameEngine> {
    const game = await this.gameRepository.findById(gameId);

    if (!game) {
      throw new Error("Game not found in database.");
    }

    const gameEngine = GameEngine.fromGame(game);

    this.games.set(gameId, gameEngine);

    return gameEngine;
  }


  public async recoverGames(): Promise<void> {
    const games =
      await this.gameRepository.findRecoverableGames();

    for (const game of games) {
      const gameEngine = GameEngine.fromGame(game);

      if (gameEngine.isGameExpired()) {
        gameEngine.expireGameIfNeeded();

        await this.gameRepository.save(
          gameEngine.getGame()
        );

        console.log(
          `Game ${game.id} expired during recovery.`
        );

        continue;
      }

      this.games.set(game.id, gameEngine);

      console.log(
        `Recovered game ${game.id} (${game.status}).`
      );
    }

    console.log(
      `Recovered ${this.games.size} active/waiting game(s).`
    );
  }
}