import { GameManager } from "../game/gameManager";
import { GameRepository } from "../repositories/gameRepository";

import {
    connectDatabase,
    disconnectDatabase,
} from "../database/connection";

import { GameModel } from "../database/models/gameModel";
import { generateTicketLayout } from "../tickets/ticketGenerator";

describe("Completed Game Persistence", () => {
    let gameManager: GameManager;
    let gameRepository: GameRepository;
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
        "should persist a completed game correctly in MongoDB",
        async () => {
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
                "persistence-test-player";

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

            // --------------------------------
            // ANNOUNCE ALL TICKET NUMBERS
            // --------------------------------

            const player =
                game.playerTickets.find(
                    (p) =>
                        p.playerId === playerId
                );

            if (!player) {
                throw new Error(
                    "Player ticket not found."
                );
            }

            const ticketNumbers =
                player.ticket
                    .flat()
                    .filter(
                        (
                            number
                        ): number is number =>
                            number !== null
                    );

            for (const number of ticketNumbers) {
                if (
                    !game.announcedNumbers.includes(
                        number
                    )
                ) {
                    gameEngine.announceNumber(
                        number
                    );
                }
            }

            // --------------------------------
            // MARK ALL TICKET NUMBERS
            // --------------------------------

            for (const number of ticketNumbers) {
                gameEngine.markNumber(
                    playerId,
                    number
                );
            }

            expect(
                player.markedNumbers.size
            ).toBe(
                ticketNumbers.length
            );

            // --------------------------------
            // CLAIM ALL WINNING CATEGORIES
            // --------------------------------

            expect(
                gameEngine.claimWinner(
                    playerId,
                    "FIRST_5"
                )
            ).toBe(true);

            expect(
                gameEngine.claimWinner(
                    playerId,
                    "ONE_LINE"
                )
            ).toBe(true);

            expect(
                gameEngine.claimWinner(
                    playerId,
                    "TWO_LINES"
                )
            ).toBe(true);

            expect(
                gameEngine.claimWinner(
                    playerId,
                    "THREE_LINES"
                )
            ).toBe(true);

            expect(
                gameEngine.claimWinner(
                    playerId,
                    "FULL_HOUSE"
                )
            ).toBe(true);

            // --------------------------------
            // VERIFY IN MEMORY
            // --------------------------------

            expect(game.status).toBe(
                "COMPLETED"
            );

            expect(game.completedAt).not.toBeNull();

            expect(game.winners.length).toBe(5);

            // --------------------------------
            // SAVE COMPLETED GAME
            // --------------------------------

            await gameManager.saveGame(
                game.id
            );

            // --------------------------------
            // READ DIRECTLY FROM MONGODB
            // --------------------------------

            const savedDocument =
                await GameModel.findOne({
                    id: game.id,
                }).lean();

            expect(savedDocument).not.toBeNull();

            if (!savedDocument) {
                throw new Error(
                    "Completed game was not found in MongoDB."
                );
            }

            // --------------------------------
            // VERIFY LIFECYCLE STATE
            // --------------------------------

            expect(
                savedDocument.status
            ).toBe("COMPLETED");

            expect(
                savedDocument.completedAt
            ).not.toBeNull();

            // --------------------------------
            // VERIFY GAME STATE
            // --------------------------------

            expect(
                savedDocument.currentRound
            ).toBe(game.currentRound);

            expect(
                savedDocument.numbersAnnouncedThisRound
            ).toBe(
                game.numbersAnnouncedThisRound
            );

            expect(
                savedDocument.announcedNumbers
            ).toEqual(
                game.announcedNumbers
            );

            expect(
                savedDocument.remainingNumbers
            ).toEqual(
                game.remainingNumbers
            );

            // --------------------------------
            // VERIFY PLAYER TICKET
            // --------------------------------

            expect(
                savedDocument.playerTickets.length
            ).toBe(1);

            expect(
                savedDocument.playerTickets[0]
                    .playerId
            ).toBe(playerId);

            expect(
                savedDocument.playerTickets[0]
                    .ticket
            ).toEqual(ticket);

            expect(
                savedDocument.playerTickets[0]
                    .markedNumbers
            ).toHaveLength(
                ticketNumbers.length
            );

            // --------------------------------
            // VERIFY WINNERS
            // --------------------------------

            expect(
                savedDocument.winners.length
            ).toBe(5);

            const winnerTypes =
                savedDocument.winners.map(
                    (winner) => winner.type
                );

            expect(
                winnerTypes
            ).toEqual(
                expect.arrayContaining([
                    "FIRST_5",
                    "ONE_LINE",
                    "TWO_LINES",
                    "THREE_LINES",
                    "FULL_HOUSE",
                ])
            );

            console.log(
                "🎉 Completed game persistence test passed!"
            );
        },
        30000
    );
});