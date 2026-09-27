import { connectDatabase, disconnectDatabase } from "../database/connection";
import { GameRepository } from "../repositories/gameRepository";
import { GameManager } from "../game/gameManager";
import { generateTicketLayout } from "../tickets/ticketGenerator";


describe("Game Lifecycle Integration Test", () => {
    let gameManager: GameManager;
    let gameRepository: GameRepository;

    beforeAll(async () => {
        await connectDatabase();

        gameRepository = new GameRepository();
        gameManager = new GameManager(gameRepository);
    });

    afterAll(async () => {
        await disconnectDatabase();
    });

    test("should complete full game lifecycle", async () => {

        // --------------------------------------------------
        // 1. Create WAITING game
        // --------------------------------------------------

        const waitingGame =
            await gameManager.ensureWaitingGame();

        expect(waitingGame).not.toBeNull();

        const game = waitingGame!.getGame();

        expect(game.status).toBe("WAITING");

        console.log(
            `Created waiting game: ${game.id}`
        );


        // --------------------------------------------------
        // 2. Add minimum players
        // --------------------------------------------------

        const ticket1 = generateTicketLayout();
        const ticket2 = generateTicketLayout();

        waitingGame!.addPlayerTicket(
            "player-1",
            ticket1
        );

        waitingGame!.addPlayerTicket(
            "player-2",
            ticket2
        );

        expect(
            waitingGame!.getGame().playerTickets.length
        ).toBe(2);


        // --------------------------------------------------
        // 3. Assign host
        // --------------------------------------------------

        waitingGame!.assignHost("player-1");

        expect(
            waitingGame!.getGame().hostPlayerId
        ).toBe("player-1");


        // --------------------------------------------------
        // 4. Start game
        // --------------------------------------------------

        waitingGame!.startGame();

        expect(
            waitingGame!.getGame().status
        ).toBe("ACTIVE");

        expect(
            waitingGame!.getGame().currentRound
        ).toBe(1);

        await gameManager.saveGame(game.id);


        // --------------------------------------------------
        // 5. Announce 10 numbers
        // --------------------------------------------------

        for (let i = 0; i < 10; i++) {
            waitingGame!.announceNextNumber();
        }

        expect(
            waitingGame!.getGame().numbersAnnouncedThisRound
        ).toBe(10);

        expect(
            waitingGame!.isRoundComplete()
        ).toBe(true);

        await gameManager.saveGame(game.id);


        // --------------------------------------------------
        // 6. Start next round
        // --------------------------------------------------

        waitingGame!.startNextRound();

        expect(
            waitingGame!.getGame().currentRound
        ).toBe(2);

        expect(
            waitingGame!.getGame().numbersAnnouncedThisRound
        ).toBe(0);

        await gameManager.saveGame(game.id);


        // --------------------------------------------------
        // 7. Complete another round
        // --------------------------------------------------

        for (let i = 0; i < 10; i++) {
            waitingGame!.announceNextNumber();
        }

        expect(
            waitingGame!.getGame().numbersAnnouncedThisRound
        ).toBe(10);


        // --------------------------------------------------
        // 8. Complete game
        // --------------------------------------------------

        waitingGame!.completeGame();

        expect(
            waitingGame!.getGame().status
        ).toBe("COMPLETED");

        expect(
            waitingGame!.getGame().completedAt
        ).not.toBeNull();

        await gameManager.saveGame(game.id);


        // --------------------------------------------------
        // 9. Create next WAITING game
        // --------------------------------------------------

        const nextWaitingGame =
            await gameManager.ensureWaitingGame();

        expect(nextWaitingGame).not.toBeNull();

        expect(
            nextWaitingGame!.getGame().status
        ).toBe("WAITING");


        // --------------------------------------------------
        // 10. Make sure duplicate WAITING game isn't created
        // --------------------------------------------------

        const secondCall =
            await gameManager.ensureWaitingGame();

        expect(secondCall).not.toBeNull();

        expect(
            secondCall!.getGame().id
        ).toBe(
            nextWaitingGame!.getGame().id
        );


        console.log(
            "Full game lifecycle test passed!"
        );
    });
});