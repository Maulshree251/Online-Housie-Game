import { GameManager } from "../game/gameManager";
import { GameRepository } from "../repositories/gameRepository";

import {
    connectDatabase,
    disconnectDatabase,
} from "../database/connection";

import { GameModel } from "../database/models/gameModel";
import { generateTicketLayout } from "../tickets/ticketGenerator";

describe("Active Game Recovery", () => {
    let gameRepository: GameRepository;
    let gameManager: GameManager;

    let testGameId: string | null = null;

    beforeAll(async () => {
        await connectDatabase();

        gameRepository = new GameRepository();
        gameManager = new GameManager(gameRepository);
    });

    afterAll(async () => {
        if (testGameId) {
            await GameModel.deleteOne({
                id: testGameId,
            });
        }

        await disconnectDatabase();
    });

    it(
        "should recover an active game with its complete state",
        async () => {
            // --------------------------------
            // CREATE GAME
            // --------------------------------

            const gameEngine =
                await gameManager.createGame(
                    20,
                    1,
                    10,
                    1
                );

            const game =
                gameEngine.getGame();

            testGameId = game.id;

            // --------------------------------
            // ADD PLAYER
            // --------------------------------

            const playerId =
                "recovery-test-player";

            const ticket =
                generateTicketLayout();

            gameEngine.addPlayerTicket(
                playerId,
                ticket
            );

            // --------------------------------
            // START GAME
            // --------------------------------

            gameEngine.startGame();

            expect(game.status).toBe("ACTIVE");

            // --------------------------------
            // ANNOUNCE NUMBERS
            // --------------------------------

            for (let i = 0; i < 5; i++) {
                gameEngine.announceNextNumber();
            }

            expect(
                game.numbersAnnouncedThisRound
            ).toBe(5);

            expect(
                game.announcedNumbers.length
            ).toBe(5);

            // Save a copy before recovery
            const announcedNumbersBeforeRecovery =
                [...game.announcedNumbers];

            const remainingNumbersBeforeRecovery =
                [...game.remainingNumbers];


            // --------------------------------
            // MARK A NUMBER
            // --------------------------------

            const player =
                game.playerTickets.find(
                    (p) => p.playerId === playerId
                );

            if (!player) {
                throw new Error("Player ticket not found.");
            }

            // Ensure the test has an announced number
            // that also exists on the player's ticket.
            const ticketNumbers = player.ticket
                .flat()
                .filter(
                    (number): number is number =>
                        number !== null
                );

            let markableNumber = ticketNumbers.find(
                (number) =>
                    game.announcedNumbers.includes(number)
            );

            // If there is no overlap, announce more numbers
            // until a ticket number is announced.
            while (markableNumber === undefined) {
                gameEngine.announceNextNumber();

                markableNumber = ticketNumbers.find(
                    (number) =>
                        game.announcedNumbers.includes(number)
                );
            }

            const announcedCountBeforeRecovery =
                game.numbersAnnouncedThisRound;

            gameEngine.markNumber(playerId, markableNumber);

            expect(
                player.markedNumbers.has(markableNumber)
            ).toBe(true);



            // --------------------------------
            // SAVE ACTIVE GAME
            // --------------------------------

            await gameManager.saveGame(
                game.id
            );

            // --------------------------------
            // VERIFY MONGODB
            // --------------------------------

            const savedDocument =
                await GameModel.findOne({
                    id: game.id,
                }).lean();

            expect(savedDocument).not.toBeNull();

            if (!savedDocument) {
                throw new Error(
                    "Game was not found in MongoDB."
                );
            }

            expect(
                savedDocument.status
            ).toBe("ACTIVE");

            // --------------------------------
            // SIMULATE SERVER RESTART
            // --------------------------------

            const restartedGameManager =
                new GameManager(gameRepository);

            // Nothing should exist in the
            // new manager yet.
            expect(() => {
                restartedGameManager.getGame(
                    game.id
                );
            }).toThrow("Game not found.");

            // --------------------------------
            // RECOVER GAMES
            // --------------------------------

            await restartedGameManager.recoverGames();

            // --------------------------------
            // GET RECOVERED GAME
            // --------------------------------

            const recoveredGameEngine =
                restartedGameManager.getGame(
                    game.id
                );

            const recoveredGame =
                recoveredGameEngine.getGame();

            // --------------------------------
            // VERIFY BASIC GAME STATE
            // --------------------------------

            expect(
                recoveredGame.id
            ).toBe(game.id);

            expect(
                recoveredGame.status
            ).toBe("ACTIVE");

            expect(
                recoveredGame.currentRound
            ).toBe(game.currentRound);

            expect(
                recoveredGame.numbersAnnouncedThisRound
            ).toBe(5);

            // --------------------------------
            // VERIFY ANNOUNCED NUMBERS
            // --------------------------------

            expect(
                recoveredGame.announcedNumbers
            ).toEqual(
                announcedNumbersBeforeRecovery
            );

            // --------------------------------
            // VERIFY REMAINING NUMBERS
            // --------------------------------

            expect(
                recoveredGame.remainingNumbers
            ).toEqual(
                remainingNumbersBeforeRecovery
            );

            // --------------------------------
            // VERIFY PLAYER
            // --------------------------------

            expect(
                recoveredGame.playerTickets.length
            ).toBe(1);

            const recoveredPlayer =
                recoveredGame.playerTickets.find(
                    (p) =>
                        p.playerId === playerId
                );

            expect(
                recoveredPlayer
            ).toBeDefined();

            if (!recoveredPlayer) {
                throw new Error(
                    "Recovered player was not found."
                );
            }

            // --------------------------------
            // VERIFY TICKET
            // --------------------------------

            expect(
                recoveredPlayer.ticket
            ).toEqual(ticket);

            // --------------------------------
            // VERIFY MARKED NUMBERS
            // --------------------------------

            expect(
                recoveredPlayer.markedNumbers
            ).toBeInstanceOf(Set);

            expect(
                recoveredPlayer.markedNumbers.has(
                    markableNumber
                )
            ).toBe(true);

            expect(
                recoveredPlayer.markedNumbers.size
            ).toBe(1);


            // --------------------------------
            // VERIFY GAME CAN CONTINUE AFTER RECOVERY
            // --------------------------------

            const nextNumber =
                recoveredGameEngine.announceNextNumber();
            expect(
                recoveredGame.numbersAnnouncedThisRound
            ).toBe(announcedCountBeforeRecovery + 1);
            expect(nextNumber).toBeGreaterThanOrEqual(1);
            expect(nextNumber).toBeLessThanOrEqual(90);

            expect(
                recoveredGame.numbersAnnouncedThisRound
            ).toBe(6);

            expect(
                recoveredGame.announcedNumbers
            ).toHaveLength(6);

            expect(
                new Set(recoveredGame.announcedNumbers).size
            ).toBe(6);

            // Persist the recovered game's new state.
            await restartedGameManager.saveGame(game.id);

            const updatedDocument =
                await gameRepository.findById(game.id);

            expect(updatedDocument).not.toBeNull();
            expect(updatedDocument!.numbersAnnouncedThisRound).toBe(6);

            console.log(
                "🎉 Active game recovery test passed!"
            );
        },
        30000
    );
});