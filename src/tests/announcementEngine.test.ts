import { AnnouncementEngine } from "../game/announcementEngine";
import "dotenv/config";
import { connectDatabase, disconnectDatabase } from "../database/connection";
import { GameManager } from "../game/gameManager";
import { GameRepository } from "../repositories/gameRepository";
import { Ticket } from "../models/ticket";

function createTestTicket(): Ticket {
    return [
        [1, 10, 20, 30, 40, null, null, null, null],
        [2, null, 21, null, 41, 50, null, 70, null],
        [3, null, null, 31, null, 51, 60, null, 80],
    ];
}

async function runTest(): Promise<void> {
    console.log("\n=================================");
    console.log(" Announcement Engine Tests");
    console.log("=================================\n");

    /*
     * ----------------------------------------
     * TEST 1
     * ----------------------------------------
     * Create a game with a very small
     * announcement interval.
     */
    await connectDatabase();
    const repository = new GameRepository();
    const gameManager = new GameManager(repository);

    const gameEngine = await gameManager.createGame(
        20, // max players
        1,  // minimum players
        10, // numbers per round
        0  // 0 seconds for testing
    );

    const gameId = gameEngine.getGame().id;

    console.log(`Created test game: ${gameId}`);

    /*
     * ----------------------------------------
     * TEST 2
     * ----------------------------------------
     * Add a player.
     */

    gameEngine.addPlayerTicket(
        "player-1",
        createTestTicket()
    );

    console.log("Player added.");

    /*
     * ----------------------------------------
     * TEST 3
     * ----------------------------------------
     * Start the game.
     */

    gameEngine.assignHost("player-1");
    gameEngine.startGame();

    console.assert(
        gameEngine.getGame().status === "ACTIVE",
        "Game should be ACTIVE."
    );

    console.assert(
        gameEngine.getGame().currentRound === 1,
        "Game should start at Round 1."
    );

    console.log("Game started successfully.");

    /*
     * ----------------------------------------
     * TEST 4
     * ----------------------------------------
     * Capture announced numbers.
     */

    const announcedNumbers: number[] = [];

    const announcementEngine = new AnnouncementEngine(
        gameManager,
        (gameId, number) => {
            console.log(
                `Broadcast → Game ${gameId}: ${number}`
            );

            announcedNumbers.push(number);
        }
    );

    /*
     * ----------------------------------------
     * TEST 5
     * ----------------------------------------
     * Run weekly announcement round.
     */

    await announcementEngine.runWeeklyRound(gameId);

    /*
     * ----------------------------------------
     * TEST 6
     * ----------------------------------------
     * Exactly 10 numbers announced.
     */

    console.assert(
        announcedNumbers.length === 10,
        `Expected 10 numbers, got ${announcedNumbers.length}.`
    );

    console.log(
        `✓ Exactly 10 numbers announced.`
    );

    /*
     * ----------------------------------------
     * TEST 7
     * ----------------------------------------
     * No duplicate numbers.
     */

    const uniqueNumbers = new Set(
        announcedNumbers
    );

    console.assert(
        uniqueNumbers.size === 10,
        "Duplicate number was announced."
    );

    console.log(
        "✓ No duplicate numbers."
    );

    /*
     * ----------------------------------------
     * TEST 8
     * ----------------------------------------
     * Game state should contain 10 announced
     * numbers.
     */

    const game = gameEngine.getGame();

    console.assert(
        game.announcedNumbers.length === 10,
        "Game should contain 10 announced numbers."
    );

    console.assert(
        game.numbersAnnouncedThisRound === 10,
        "Round counter should be 10."
    );

    console.assert(
        game.currentRound === 1,
        "Current round should still be 1."
    );

    console.log(
        "✓ Game state correctly tracks Round 1."
    );

    /*
     * ----------------------------------------
     * TEST 9
     * ----------------------------------------
     * Round should be complete.
     */

    console.assert(
        gameEngine.isRoundComplete() === true,
        "Round should be complete."
    );

    console.log(
        "✓ Round correctly completed."
    );

    /*
     * ----------------------------------------
     * TEST 10
     * ----------------------------------------
     * Attempting another announcement should
     * fail.
     */

    let extraAnnouncementRejected = false;

    try {
        gameEngine.announceNextNumber();
    } catch (error) {
        extraAnnouncementRejected = true;

        console.log(
            "✓ 11th announcement correctly rejected."
        );
    }

    console.assert(
        extraAnnouncementRejected === true,
        "11th announcement should be rejected."
    );

    /*
     * ----------------------------------------
     * TEST 11
     * ----------------------------------------
     * Start next round.
     */

    gameEngine.startNextRound();

    const nextRoundGame = gameEngine.getGame();

    console.assert(
        nextRoundGame.currentRound === 2,
        "Game should move to Round 2."
    );

    console.assert(
        nextRoundGame.numbersAnnouncedThisRound === 0,
        "Round 2 should start with 0 announcements."
    );

    console.log(
        "✓ Successfully moved to Round 2."
    );

    /*
     * ----------------------------------------
     * TEST 12
     * ----------------------------------------
     * Announce one number in Round 2.
     */

    const roundTwoAnnouncements: number[] = [];

    const roundTwoEngine = new AnnouncementEngine(
        gameManager,
        (_, number) => {
            roundTwoAnnouncements.push(number);
        }
    );

    await roundTwoEngine.runWeeklyRound(gameId);

    console.assert(
        roundTwoAnnouncements.length === 10,
        "Round 2 should announce exactly 10 numbers."
    );

    console.log(
        "✓ Round 2 announced exactly 10 numbers."
    );

    /*
     * ----------------------------------------
     * TEST 13
     * ----------------------------------------
     * Total announced numbers should now
     * equal 20.
     * ----------------------------------------
     */

    const finalGame = gameEngine.getGame();

    console.assert(
        finalGame.announcedNumbers.length === 20,
        `Expected 20 total announcements, got ${finalGame.announcedNumbers.length}.`
    );

    console.assert(
        new Set(finalGame.announcedNumbers).size === 20,
        "Duplicate number found across rounds."
    );

    console.log(
        "✓ No duplicate numbers across rounds."
    );

    console.log("\n=================================");
    console.log(" 🎉 All Announcement Tests Passed!");
    console.log("=================================\n");
}

runTest().catch((error) => {
    console.error(
        "\n❌ Announcement Engine Test Failed:"
    );

    console.error(error);

    process.exit(1);
});