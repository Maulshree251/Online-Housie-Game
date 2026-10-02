import "dotenv/config";

import { connectDatabase, disconnectDatabase } from "../database/connection";
import { GameManager } from "../game/gameManager";
import { GameRepository } from "../repositories/gameRepository";
import { generateTicketLayout, fillTicketNumbers } from "../tickets/ticketGenerator";

async function main(): Promise<void> {
    await connectDatabase();

    const gameRepository = new GameRepository();
    const gameManager = new GameManager(gameRepository);

    // Recover existing WAITING / ACTIVE games
    await gameManager.recoverGames();

    // Find an existing active or waiting game, or create one
    let gameEngine = gameManager.getActiveGame() ?? gameManager.getWaitingGame();

    if (!gameEngine) {
        gameEngine = await gameManager.createGame(20, 2, 10, 10);
    }

    const game = gameEngine.getGame();

    console.log("\nTest game:", game.id);
    console.log("Current status:", game.status);

    // Add test players if they don't already exist
    const testPlayers = ["577bf740-54ac-4d33-a675-694882c16f8b", "test-player-2"];

    for (const playerId of testPlayers) {
        const alreadyJoined = game.playerTickets.some(
            (player) => player.playerId === playerId
        );

        if (!alreadyJoined && game.status === "WAITING") {
            const layout = generateTicketLayout();
            const ticket = fillTicketNumbers(layout);

            gameEngine.addPlayerTicket(playerId, ticket);

            console.log(`Added ${playerId}`);
        }
    }

    // Assign first player as host
    if (!game.hostPlayerId && game.status === "WAITING") {
        gameEngine.assignHost(testPlayers[0]);
    }

    // Start the game
    if (game.status === "WAITING") {
        gameEngine.startGame();
        console.log("\nGame started.");
    }

    // Pick a number from player 1's ticket
    const player = gameEngine
        .getGame()
        .playerTickets.find((p) => p.playerId === testPlayers[0]);

    if (!player) {
        throw new Error("Test player was not found.");
    }

    const ticketNumbers = player.ticket
        .flat()
        .filter((number): number is number => number !== null);

    const numberToAnnounce = ticketNumbers.find(
        (num) => !gameEngine.getGame().announcedNumbers.includes(num)
    );

    if (numberToAnnounce === undefined) {
        throw new Error("No unannounced numbers left on player's ticket.");
    }

    // Announce the number
    gameEngine.announceNumber(numberToAnnounce);

    console.log(`Number announced: ${numberToAnnounce}`);

    // Mark it
    gameEngine.markNumber(testPlayers[0], numberToAnnounce);

    console.log(`Number marked: ${numberToAnnounce}`);

    await gameManager.saveGame(game.id);

    console.log("\nFinal state:");
    console.log("Status:", gameEngine.getGame().status);
    console.log(
        "Announced numbers:",
        gameEngine.getGame().announcedNumbers
    );
    console.log(
        "Player 1 marked numbers:",
        Array.from(
            gameEngine
                .getGame()
                .playerTickets.find((p) => p.playerId === testPlayers[0])!
                .markedNumbers
        )
    );

    await disconnectDatabase();
}

main().catch(async (error) => {
    console.error("Test setup failed:", error);
    await disconnectDatabase();
    process.exit(1);
});