import "dotenv/config";

import { connectDatabase, disconnectDatabase } from "../database/connection";
import { GameManager } from "../game/gameManager";
import { GameRepository } from "../repositories/gameRepository";
import {
    generateTicketLayout,
    fillTicketNumbers,
} from "../tickets/ticketGenerator";

async function main(): Promise<void> {
    await connectDatabase();

    const gameRepository = new GameRepository();
    const gameManager = new GameManager(gameRepository);

    // --------------------------------------------------
    // 1. RECOVER EXISTING GAMES
    // --------------------------------------------------

    console.log("\nRecovering games...");

    await gameManager.recoverGames();

    let gameEngine = gameManager.getActiveGame();

    // --------------------------------------------------
    // 2. IF NO ACTIVE GAME, FIND WAITING GAME
    // --------------------------------------------------

    if (!gameEngine) {
        gameEngine = gameManager.getWaitingGame();
    }

    // --------------------------------------------------
    // 3. IF NO WAITING GAME, CREATE ONE
    // --------------------------------------------------

    if (!gameEngine) {
        console.log("No ACTIVE or WAITING game found.");
        console.log("Creating a new WAITING game...");

        gameEngine = await gameManager.createGame(
            20, // maxPlayers
            2,  // minPlayers
            10, // numbersPerRound
            10  // announcement interval
        );
    }

    let game = gameEngine.getGame();

    console.log("\n--------------------------------");
    console.log("Test Game");
    console.log("--------------------------------");
    console.log("Game ID:", game.id);
    console.log("Status:", game.status);
    console.log("Players:", game.playerTickets.length);
    console.log("Minimum players:", game.config.minPlayers);

    // --------------------------------------------------
    // 4. IF WAITING, ENSURE MINIMUM PLAYERS
    // --------------------------------------------------

    if (game.status === "WAITING") {
        const playersNeeded =
            game.config.minPlayers - game.playerTickets.length;

        console.log(`Players needed: ${Math.max(playersNeeded, 0)}`);

        for (let i = 0; i < playersNeeded; i++) {
            const playerId = `api-test-player-${Date.now()}-${i}`;

            const layout = generateTicketLayout();
            const ticket = fillTicketNumbers(layout);

            gameEngine.addPlayerTicket(playerId, ticket);

            console.log(`Added test player: ${playerId}`);
        }

        game = gameEngine.getGame();

        // --------------------------------------------------
        // 5. CHECK MINIMUM PLAYER REQUIREMENT
        // --------------------------------------------------

        if (game.playerTickets.length < game.config.minPlayers) {
            throw new Error(
                `Cannot start game. Required ${game.config.minPlayers} players, but only ${game.playerTickets.length} joined.`
            );
        }

        console.log(
            `Minimum player requirement satisfied: ${game.playerTickets.length}/${game.config.minPlayers}`
        );

        // --------------------------------------------------
        // 6. ASSIGN HOST
        // --------------------------------------------------

        if (!game.hostPlayerId && game.playerTickets.length > 0) {
            gameEngine.assignHost(game.playerTickets[0].playerId);

            console.log(
                `Host assigned: ${game.playerTickets[0].playerId}`
            );
        }

        // --------------------------------------------------
        // 7. START GAME
        // --------------------------------------------------

        gameEngine.startGame();

        console.log("Game successfully started.");
    }

    // --------------------------------------------------
    // 8. VERIFY GAME IS ACTIVE
    // --------------------------------------------------

    game = gameEngine.getGame();

    if (game.status !== "ACTIVE") {
        throw new Error(
            `Expected ACTIVE game, but current status is ${game.status}.`
        );
    }

    console.log("\nGame is ACTIVE.");
    console.log("Current round:", game.currentRound);

    // --------------------------------------------------
    // 9. ANNOUNCE ONE NUMBER
    // --------------------------------------------------

    if (!gameEngine.isRoundComplete()) {
        const announcedNumber = gameEngine.announceNextNumber();

        console.log("\n--------------------------------");
        console.log("Number Announcement");
        console.log("--------------------------------");
        console.log("Announced number:", announcedNumber);
        console.log(
            "Announced numbers:",
            gameEngine.getGame().announcedNumbers
        );
    } else {
        console.log(
            "Current round already has all required announcements."
        );
    }

    // --------------------------------------------------
    // 10. SAVE EVERYTHING
    // --------------------------------------------------

    await gameManager.saveGame(game.id);

    // --------------------------------------------------
    // 11. FINAL OUTPUT FOR POSTMAN
    // --------------------------------------------------

    game = gameEngine.getGame();

    console.log("\n================================");
    console.log("API TEST SETUP READY");
    console.log("================================");

    console.log("Game ID:", game.id);
    console.log("Status:", game.status);
    console.log("Round:", game.currentRound);
    console.log("Players:", game.playerTickets.length);
    console.log("Host:", game.hostPlayerId);
    console.log("Announced numbers:", game.announcedNumbers);

    console.log("\nPlayers:");

    for (const player of game.playerTickets) {
        console.log("Player ID:", player.playerId);

        console.log(
            "Ticket:",
            player.ticket
        );
    }

    console.log("\nUse this Game ID in Postman:");
    console.log(game.id);

    console.log("\n================================\n");

    await disconnectDatabase();
}

main().catch(async (error) => {
    console.error("\nAPI test setup failed:");
    console.error(error);

    await disconnectDatabase();

    process.exit(1);
});