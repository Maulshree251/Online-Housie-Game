import { GameRepository } from "../repositories/gameRepository";
import { Game } from "../models/game";

async function createTestGame() {
    const repository = new GameRepository();

    const game: Game = {
        id: `test-game-${Date.now()}`,

        status: "WAITING",

        hostPlayerId: "test-host",

        createdAt: new Date(),
        startedAt: null,
        completedAt: null,

        config: {
            maxPlayers: 10,
            durationInMinutes: 60,
        },

        announcedNumbers: [],

        remainingNumbers: Array.from(
            { length: 90 },
            (_, index) => index + 1
        ),

        playerTickets: [],

        winners: [],
    };

    const savedGame = await repository.create(game);

    console.log("\n================================");
    console.log("TEST GAME CREATED");
    console.log("================================");
    console.log("Game ID:", savedGame.id);
    console.log("Status:", savedGame.status);
    console.log("Host:", savedGame.hostPlayerId);
    console.log("================================\n");

    process.exit(0);
}

createTestGame().catch((error) => {
    console.error("Failed to create test game:", error);
    process.exit(1);
});