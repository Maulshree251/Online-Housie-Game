"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameEngine = void 0;
const crypto_1 = require("crypto");
const ticketGenerator_1 = require("../tickets/ticketGenerator");
class GameEngine {
    game;
    constructor() {
        this.game = this.createGame();
    }
    createGame() {
        const numbers = Array.from({ length: 90 }, (_, index) => index + 1);
        return {
            id: (0, crypto_1.randomUUID)(),
            status: "WAITING",
            announcedNumbers: [],
            remainingNumbers: this.shuffle(numbers),
            playerTickets: [],
            winners: [],
        };
    }
    shuffle(numbers) {
        const shuffled = [...numbers];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const randomIndex = Math.floor(Math.random() * (i + 1));
            const current = shuffled[i];
            const random = shuffled[randomIndex];
            if (current === undefined || random === undefined) {
                continue;
            }
            shuffled[i] = random;
            shuffled[randomIndex] = current;
        }
        return shuffled;
    }
    getGame() {
        return this.game;
    }
    startGame() {
        if (this.game.status !== "WAITING") {
            throw new Error("Game cannot be started.");
        }
        this.game.status = "ACTIVE";
    }
    addPlayerTicket(playerId, ticket) {
        if (this.game.status !== "WAITING") {
            throw new Error("Players cannot join after the game has started.");
        }
        if (!playerId.trim()) {
            throw new Error("Player ID cannot be empty.");
        }
        // Validate the ticket on the server.
        if (!(0, ticketGenerator_1.validateTicket)(ticket)) {
            throw new Error("Invalid ticket. Player cannot join.");
        }
        const alreadyJoined = this.game.playerTickets.some((player) => player.playerId === playerId);
        if (alreadyJoined) {
            throw new Error("This player has already joined.");
        }
        const playerTicket = {
            playerId,
            ticket,
            markedNumbers: new Set(),
        };
        this.game.playerTickets.push(playerTicket);
    }
    announceNumber(number) {
        if (this.game.status !== "ACTIVE") {
            throw new Error("Game is not active.");
        }
        if (!Number.isInteger(number) || number < 1 || number > 90) {
            throw new Error("Number must be between 1 and 90.");
        }
        if (this.game.announcedNumbers.includes(number)) {
            throw new Error("This number has already been announced.");
        }
        const numberIndex = this.game.remainingNumbers.indexOf(number);
        if (numberIndex === -1) {
            throw new Error("Number is not available.");
        }
        this.game.remainingNumbers.splice(numberIndex, 1);
        this.game.announcedNumbers.push(number);
    }
    announceNextNumber() {
        if (this.game.status !== "ACTIVE") {
            throw new Error("Game is not active.");
        }
        if (this.game.remainingNumbers.length === 0) {
            throw new Error("All numbers have already been announced.");
        }
        const nextNumber = this.game.remainingNumbers[this.game.remainingNumbers.length - 1];
        if (nextNumber === undefined) {
            throw new Error("Unable to announce the next number.");
        }
        this.announceNumber(nextNumber);
        return nextNumber;
    }
    markNumber(playerId, number) {
        if (this.game.status !== "ACTIVE") {
            throw new Error("Game is not active.");
        }
        if (!this.game.announcedNumbers.includes(number)) {
            throw new Error("This number has not been announced.");
        }
        const playerTicket = this.game.playerTickets.find((player) => player.playerId === playerId);
        if (!playerTicket) {
            throw new Error("Player ticket not found.");
        }
        const numberExistsOnTicket = playerTicket.ticket.some((row) => row.includes(number));
        if (!numberExistsOnTicket) {
            throw new Error("This number does not exist on the ticket.");
        }
        playerTicket.markedNumbers.add(number);
    }
    // Claims a winning category for a player.
    // Each category can be claimed only once per game.
    claimWinner(playerId, winnerType) {
        if (this.game.status !== "ACTIVE") {
            throw new Error("Game is not active.");
        }
        // Step 1: Check whether this category is already claimed.
        const categoryAlreadyClaimed = this.game.winners.some((winner) => winner.type === winnerType);
        if (categoryAlreadyClaimed) {
            throw new Error(`${winnerType} has already been claimed.`);
        }
        // Step 2: Find the player's ticket.
        const playerTicket = this.game.playerTickets.find((player) => player.playerId === playerId);
        if (!playerTicket) {
            throw new Error("Player ticket not found.");
        }
        // Step 3: Verify the winning condition.
        const isWinner = this.verifyWinner(playerTicket, winnerType);
        if (!isWinner) {
            return false;
        }
        // Step 4: Record the winner.
        this.addWinner(playerId, winnerType);
        return true;
    }
    verifyWinner(playerTicket, winnerType) {
        const { ticket, markedNumbers } = playerTicket;
        const allTicketNumbers = ticket
            .flat()
            .filter((number) => number !== null);
        // Only count numbers that actually exist on the ticket.
        const markedCount = allTicketNumbers.filter((number) => markedNumbers.has(number)).length;
        if (winnerType === "FIRST_5") {
            return markedCount >= 5;
        }
        const completedRows = ticket.filter((row) => {
            const numbersInRow = row.filter((number) => number !== null);
            return numbersInRow.every((number) => markedNumbers.has(number));
        }).length;
        if (winnerType === "ONE_LINE") {
            return completedRows >= 1;
        }
        if (winnerType === "TWO_LINES") {
            return completedRows >= 2;
        }
        if (winnerType === "THREE_LINES") {
            return completedRows >= 3;
        }
        if (winnerType === "FULL_HOUSE") {
            return allTicketNumbers.every((number) => markedNumbers.has(number));
        }
        return false;
    }
    addWinner(playerId, winnerType) {
        // Additional safety check to prevent duplicate categories.
        const categoryAlreadyClaimed = this.game.winners.some((winner) => winner.type === winnerType);
        if (categoryAlreadyClaimed) {
            throw new Error(`${winnerType} has already been claimed.`);
        }
        const winner = {
            playerId,
            type: winnerType,
            wonAt: new Date(),
        };
        this.game.winners.push(winner);
        // Full House ends the game.
        if (winnerType === "FULL_HOUSE") {
            this.game.status = "COMPLETED";
        }
    }
}
exports.GameEngine = GameEngine;
