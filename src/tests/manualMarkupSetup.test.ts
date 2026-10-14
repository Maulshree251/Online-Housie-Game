import "dotenv/config";
import { connectDatabase, disconnectDatabase } from "../database/connection";
import { GameManager } from "../game/gameManager";
import { GameRepository } from "../repositories/gameRepository";
import {
    generateTicketLayout,
    fillTicketNumbers,
} from "../tickets/ticketGenerator";

describe("Manual Markup Setup", () => {
    let gameRepository: GameRepository;
    let gameManager: GameManager;

    beforeAll(async () => {
        await connectDatabase();
        gameRepository = new GameRepository();
        gameManager = new GameManager(gameRepository);
    });

    afterAll(async () => {
        await disconnectDatabase();
    });

    it("should set up a game and manually mark an announced number", async () => {
        // Recover existing WAITING / ACTIVE games
        await gameManager.recoverGames();

        const testPlayers = [
            "577bf740-54ac-4d33-a675-694882c16f8b",
            "test-player-2",
        ];

        // Find an existing game that already has testPlayers[0] or create/find a waiting game
        let gameEngine = gameManager.getActiveGame();
        if (
            gameEngine &&
            !gameEngine
                .getGame()
                .playerTickets.some((p) => p.playerId === testPlayers[0])
        ) {
            gameEngine = null;
        }

        if (!gameEngine) {
            gameEngine = gameManager.getWaitingGame();
        }

        if (!gameEngine) {
            gameEngine = await gameManager.createGame(20, 2, 10, 10);
        }

        let game = gameEngine.getGame();

        console.log("\nTest game:", game.id);
        console.log("Current status:", game.status);

        // Add test players if they don't already exist and game is WAITING
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

        expect(player).toBeDefined();
        if (!player) {
            throw new Error("Test player was not found.");
        }

        const ticketNumbers = player.ticket
            .flat()
            .filter((number): number is number => number !== null);

        let numberToAnnounce = ticketNumbers.find(
            (num) => !gameEngine!.getGame().announcedNumbers.includes(num)
        );

        if (numberToAnnounce === undefined) {
            // All numbers on player's ticket were already announced, pick any
            numberToAnnounce = ticketNumbers[0];
        } else {
            // Announce the number
            gameEngine.announceNumber(numberToAnnounce);
            console.log(`Number announced: ${numberToAnnounce}`);
        }

        // Mark it
        if (!player.markedNumbers.has(numberToAnnounce)) {
            gameEngine.markNumber(testPlayers[0], numberToAnnounce);
            console.log(`Number marked: ${numberToAnnounce}`);
        }

        await gameManager.saveGame(gameEngine.getGame().id);

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

        expect(gameEngine.getGame().status).toBe("ACTIVE");
        expect(gameEngine.getGame().announcedNumbers).toContain(
            numberToAnnounce
        );
        expect(
            gameEngine
                .getGame()
                .playerTickets.find((p) => p.playerId === testPlayers[0])!
                .markedNumbers.has(numberToAnnounce)
        ).toBe(true);
    });
});