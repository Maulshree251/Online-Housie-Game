import { GameManager } from "../game/gameManager";
import { GameRepository } from "../repositories/gameRepository";
import { GameScheduler } from "../game/gameScheduler";
import { AnnouncementEngine } from "../game/announcementEngine";

import {
    connectDatabase,
    disconnectDatabase,
} from "../database/connection";

import { generateTicketLayout } from "../tickets/ticketGenerator";
import { gameSchedule, GameScheduleConfig } from "../config/gameSchedule";


describe("Full Game Lifecycle", () => {
    let gameManager: GameManager;
    let gameRepository: GameRepository;
    let announcementEngine: AnnouncementEngine;
    let scheduler: GameScheduler;
    let testGameId: string | null = null;


    beforeAll(async () => {
        await connectDatabase();

        gameRepository = new GameRepository();

        // Clean up any lingering games from previous runs to ensure test isolation
        const lingeringGames = await gameRepository.findRecoverableGames();
        for (const game of lingeringGames) {
            await gameRepository.delete(game.id);
        }

        gameManager =
            new GameManager(gameRepository);


        announcementEngine =
            new AnnouncementEngine(
                gameManager,

                (gameId, number) => {
                    console.log(
                        `TEST: Game ${gameId} announced ${number}`
                    );
                }
            );


        const now = new Date();

        const scheduleConfig: GameScheduleConfig = {
            ...gameSchedule,
            dayOfWeek: now.getDay(),
            hour: now.getHours(),
            minute: now.getMinutes(),
        };



        scheduler =
            new GameScheduler(
                gameManager,
                announcementEngine,
                scheduleConfig
            );
    });


    afterAll(async () => {


        scheduler.stop();

        await scheduler.waitForCurrentExecution();


        if (testGameId) {
            console.log(`CLEANUP: deleting test game ${testGameId}`);
            await gameRepository.delete(testGameId);
        }

        console.log("CLEANUP: disconnecting database");

        await disconnectDatabase();

        console.log("CLEANUP: database disconnected");
    }, 30000);

    it(
        "should start a waiting game and complete its first round",
        async () => {

            // -----------------------------------------
            // 1. Recover existing games
            // -----------------------------------------

            await gameManager.recoverGames();


            // -----------------------------------------
            // 2. Ensure WAITING game exists
            // -----------------------------------------

            const waitingGame =
                await gameManager.createGame(
                    20,  // max players
                    2,   // minimum players
                    10,  // numbers per round
                    1    // 1 second announcement interval
                );

            expect(waitingGame).not.toBeNull();


            if (!waitingGame) {
                throw new Error(
                    "Waiting game was not created."
                );
            }


            const gameId =
                waitingGame.getGame().id;
            testGameId = gameId;


            console.log(
                `TEST: Fresh Waiting game = ${gameId}`
            );


            // -----------------------------------------
            // 3. Make announcements faster for test
            // -----------------------------------------


            // -----------------------------------------
            // 4. Add minimum players
            // -----------------------------------------

            const gameEngine =
                gameManager.getGame(gameId);


            const minPlayers =
                gameEngine.getGame().config.minPlayers;


            for (
                let i = 1;
                i <= minPlayers;
                i++
            ) {

                const playerId =
                    `lifecycle-test-player-${i}`;


                const ticket =
                    generateTicketLayout();


                gameEngine.addPlayerTicket(
                    playerId,
                    ticket
                );
            }


            await gameManager.saveGame(gameId);


            console.log(
                `TEST: Added ${minPlayers} players`
            );


            // -----------------------------------------
            // 5. Verify WAITING state
            // -----------------------------------------

            expect(
                gameEngine.getGame().status
            ).toBe("WAITING");


            expect(
                gameEngine.getGame().playerTickets.length
            ).toBe(minPlayers);


            await scheduler.runScheduledGameNow();


            // -----------------------------------------
            // 8. Reload game from manager
            // -----------------------------------------

            const updatedGameEngine =
                gameManager.getGame(gameId);


            const updatedGame =
                updatedGameEngine.getGame();


            // -----------------------------------------
            // 9. Verify game became ACTIVE
            // -----------------------------------------

            expect(
                updatedGame.status
            ).toBe("ACTIVE");


            expect(
                updatedGame.startedAt
            ).not.toBeNull();


            // -----------------------------------------
            // 10. Verify Round 1
            // -----------------------------------------

            expect(
                updatedGame.currentRound
            ).toBe(1);


            // -----------------------------------------
            // 11. Verify 10 numbers announced
            // -----------------------------------------

            expect(
                updatedGame.numbersAnnouncedThisRound
            ).toBe(
                updatedGame.config.numbersPerRound
            );


            expect(
                updatedGame.announcedNumbers.length
            ).toBe(
                updatedGame.config.numbersPerRound
            );


            // -----------------------------------------
            // 12. Verify numbers are unique
            // -----------------------------------------

            const uniqueNumbers =
                new Set(
                    updatedGame.announcedNumbers
                );


            expect(
                uniqueNumbers.size
            ).toBe(
                updatedGame.announcedNumbers.length
            );


            console.log(
                "🎉 Full lifecycle Round 1 test passed!"
            );
        },
        30000
    );

    it(
        "should resume the active game and complete Round 2",
        async () => {

            // -----------------------------------------
            // 1. Get the existing game from Round 1
            // -----------------------------------------

            if (!testGameId) {
                throw new Error(
                    "Test game ID is not available."
                );
            }

            const gameEngine =
                gameManager.getGame(testGameId);

            const gameBeforeRound2 =
                gameEngine.getGame();


            // -----------------------------------------
            // 2. Verify Round 1 completed
            // -----------------------------------------

            expect(
                gameBeforeRound2.status
            ).toBe("ACTIVE");

            expect(
                gameBeforeRound2.currentRound
            ).toBe(1);

            expect(
                gameBeforeRound2.numbersAnnouncedThisRound
            ).toBe(
                gameBeforeRound2.config.numbersPerRound
            );


            const round1Numbers =
                [...gameBeforeRound2.announcedNumbers];


            expect(
                round1Numbers.length
            ).toBe(
                gameBeforeRound2.config.numbersPerRound
            );


            // -----------------------------------------
            // 3. Start the next scheduled round
            // -----------------------------------------

            await scheduler.runScheduledGameNow();


            // -----------------------------------------
            // 4. Get updated game
            // -----------------------------------------

            const updatedGame =
                gameManager
                    .getGame(testGameId)
                    .getGame();


            // -----------------------------------------
            // 5. Verify game is still ACTIVE
            // -----------------------------------------

            expect(
                updatedGame.status
            ).toBe("ACTIVE");


            // -----------------------------------------
            // 6. Verify Round 2 started
            // -----------------------------------------

            expect(
                updatedGame.currentRound
            ).toBe(2);


            // -----------------------------------------
            // 7. Verify Round 2 announced 10 numbers
            // -----------------------------------------

            expect(
                updatedGame.numbersAnnouncedThisRound
            ).toBe(
                updatedGame.config.numbersPerRound
            );


            // -----------------------------------------
            // 8. Verify total announced numbers
            // -----------------------------------------

            expect(
                updatedGame.announcedNumbers.length
            ).toBe(
                updatedGame.config.numbersPerRound * 2
            );


            // -----------------------------------------
            // 9. Verify ALL announced numbers are unique
            // -----------------------------------------

            const uniqueNumbers =
                new Set(
                    updatedGame.announcedNumbers
                );


            expect(
                uniqueNumbers.size
            ).toBe(
                updatedGame.announcedNumbers.length
            );


            // -----------------------------------------
            // 10. Verify Round 1 numbers
            //     were preserved
            // -----------------------------------------

            for (const number of round1Numbers) {
                expect(
                    updatedGame.announcedNumbers
                ).toContain(number);
            }


            console.log(
                "🎉 Full lifecycle Round 2 test passed!"
            );
        },
        30000
    );

    it(
        "should complete the game after all winning categories are claimed",
        async () => {

            // -----------------------------------------
            // 1. Get the same game used in previous tests
            // -----------------------------------------

            if (!testGameId) {
                throw new Error(
                    "Test game ID is not available."
                );
            }

            const gameEngine =
                gameManager.getGame(testGameId);

            const game =
                gameEngine.getGame();

            expect(game.status).toBe("ACTIVE");


            // -----------------------------------------
            // 2. Get the test player's ticket
            // -----------------------------------------

            const player =
                game.playerTickets.find(
                    (player) =>
                        player.playerId ===
                        "lifecycle-test-player-1"
                );

            if (!player) {
                throw new Error(
                    "Test player was not found."
                );
            }


            // -----------------------------------------
            // 3. Get all numbers on the ticket
            // -----------------------------------------

            const ticketNumbers =
                player.ticket
                    .flat()
                    .filter(
                        (number): number is number =>
                            number !== null
                    );


            expect(ticketNumbers.length).toBeGreaterThan(0);


            // -----------------------------------------
            // 4. Announce any ticket numbers that
            //    haven't already been announced
            // -----------------------------------------

            for (const number of ticketNumbers) {

                if (
                    !game.announcedNumbers.includes(number)
                ) {
                    gameEngine.announceNumber(number);
                }
            }


            // -----------------------------------------
            // 5. Mark every number on the ticket
            // -----------------------------------------

            for (const number of ticketNumbers) {

                gameEngine.markNumber(
                    player.playerId,
                    number
                );
            }


            // -----------------------------------------
            // 6. Verify all ticket numbers are marked
            // -----------------------------------------

            expect(
                player.markedNumbers.size
            ).toBe(
                ticketNumbers.length
            );


            // -----------------------------------------
            // 7. Claim FIRST 5
            // -----------------------------------------

            const firstFiveClaimed =
                gameEngine.claimWinner(
                    player.playerId,
                    "FIRST_5"
                );

            expect(firstFiveClaimed).toBe(true);


            // -----------------------------------------
            // 8. Claim ONE LINE
            // -----------------------------------------

            const oneLineClaimed =
                gameEngine.claimWinner(
                    player.playerId,
                    "ONE_LINE"
                );

            expect(oneLineClaimed).toBe(true);


            // -----------------------------------------
            // 9. Claim TWO LINES
            // -----------------------------------------

            const twoLinesClaimed =
                gameEngine.claimWinner(
                    player.playerId,
                    "TWO_LINES"
                );

            expect(twoLinesClaimed).toBe(true);


            // -----------------------------------------
            // 10. Claim THREE LINES
            // -----------------------------------------

            const threeLinesClaimed =
                gameEngine.claimWinner(
                    player.playerId,
                    "THREE_LINES"
                );

            expect(threeLinesClaimed).toBe(true);


            // -----------------------------------------
            // 11. Verify four categories are recorded
            // -----------------------------------------

            expect(
                game.winners.length
            ).toBe(4);


            // -----------------------------------------
            // 12. Claim FULL HOUSE
            // -----------------------------------------

            const fullHouseClaimed =
                gameEngine.claimWinner(
                    player.playerId,
                    "FULL_HOUSE"
                );

            expect(fullHouseClaimed).toBe(true);


            // -----------------------------------------
            // 13. Verify game completed
            // -----------------------------------------

            expect(
                game.status
            ).toBe("COMPLETED");


            expect(
                game.completedAt
            ).not.toBeNull();


            // -----------------------------------------
            // 14. Verify all five winners exist
            // -----------------------------------------

            expect(
                game.winners.length
            ).toBe(5);


            const winnerTypes =
                game.winners.map(
                    (winner) => winner.type
                );


            expect(winnerTypes).toEqual(
                expect.arrayContaining([
                    "FIRST_5",
                    "ONE_LINE",
                    "TWO_LINES",
                    "THREE_LINES",
                    "FULL_HOUSE",
                ])
            );


            // -----------------------------------------
            // 15. Verify every category belongs to
            //     the expected player
            // -----------------------------------------

            for (const winner of game.winners) {
                expect(
                    winner.playerId
                ).toBe(player.playerId);

                expect(
                    winner.wonAt
                ).toBeInstanceOf(Date);
            }


            console.log(
                "🎉 Full game completion test passed!"
            );
        },
        30000
    );
});