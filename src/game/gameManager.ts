
import { GameEngine } from "./gameEngine";
import { GameRepository } from "../repositories/gameRepository";

export class GameManager {
  private games: Map<string, GameEngine>;
  private gameRepository: GameRepository;

  constructor(gameRepository: GameRepository = new GameRepository()) {
    this.games = new Map<string, GameEngine>();
    this.gameRepository = gameRepository;
  }


  public async createGame(
    maxPlayers: number = 20,
    minPlayers: number = 2,
    numbersPerRound: number = 10,
    announcementIntervalInSeconds: number = 60
  ): Promise<GameEngine> {
    const gameEngine = new GameEngine();
    const game = gameEngine.getGame();

    game.config.maxPlayers = maxPlayers;
    game.config.minPlayers = minPlayers;
    game.config.numbersPerRound = numbersPerRound;
    game.config.announcementIntervalInSeconds =
      announcementIntervalInSeconds;

    this.games.set(game.id, gameEngine);

    await this.gameRepository.create(game);

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
    const games = await this.gameRepository.findRecoverableGames();

    for (const game of games) {
      const gameEngine = GameEngine.fromGame(game);

      this.games.set(game.id, gameEngine);

      console.log(
        `Recovered game ${game.id} (${game.status}).`
      );
    }

    console.log(
      `Recovered ${this.games.size} active/waiting game(s).`
    );
  }

  public getWaitingGame(): GameEngine | null {
    for (const gameEngine of this.games.values()) {
      if (gameEngine.getGame().status === "WAITING") {
        return gameEngine;
      }
    }

    return null;
  }

  public getActiveGame(): GameEngine | null {
    for (const gameEngine of this.games.values()) {
      if (gameEngine.getGame().status === "ACTIVE") {
        return gameEngine;
      }
    }

    return null;
  }
  public async ensureWaitingGame(): Promise<GameEngine | null> {
    // --------------------------------------------
    // 1. Check if a WAITING game already exists
    // --------------------------------------------

    const existingWaitingGame = this.getWaitingGame();

    if (existingWaitingGame) {
      console.log(
        `Waiting game already exists: ` +
        `${existingWaitingGame.getGame().id}`
      );

      return existingWaitingGame;
    }

    // --------------------------------------------
    // 2. Check if an ACTIVE game already exists
    // --------------------------------------------

    const activeGame = this.getActiveGame();

    if (activeGame) {
      console.log(
        `Active game ${activeGame.getGame().id} exists. ` +
        `No new waiting game created.`
      );

      return null;
    }

    // --------------------------------------------
    // 3. Neither WAITING nor ACTIVE exists
    //    Create exactly ONE waiting game
    // --------------------------------------------

    const newGame = await this.createGame(
      20,
      2,
      10,
      10
    );

    console.log(
      `Created new waiting game: ${newGame.getGame().id}`
    );

    return newGame;
  }
}