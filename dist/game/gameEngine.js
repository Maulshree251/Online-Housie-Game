"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameEngine = void 0;
const crypto_1 = require("crypto");
const ticketGenerator_1 = require("../tickets/ticketGenerator");
class GameEngine {
    game;
    constructor(existingGame) {
        this.game = existingGame ?? this.createGame();
    }
    createGame() {
        const numbers = Array.from({ length: 90 }, (_, index) => index + 1);
        return {
            id: (0, crypto_1.randomUUID)(),
            status: "WAITING",
            hostPlayerId: null,
            createdAt: new Date(),
            startedAt: null,
            completedAt: null,
            config: {
                maxPlayers: 20,
                minPlayers: 2,
                numbersPerRound: 10,
                announcementIntervalInSeconds: 60,
            },
            currentRound: 0,
            roundStartedAt: null,
            numbersAnnouncedThisRound: 0,
            announcedNumbers: [],
            remainingNumbers: this.shuffle(numbers),
            playerTickets: [],
            winners: [],
        };
    }
    assignHost(playerId) {
        if (this.game.status !== "WAITING") {
            throw new Error("Host can only be assigned before the game starts.");
        }
        if (this.game.hostPlayerId !== null) {
            throw new Error("Game already has a host.");
        }
        const playerExists = this.game.playerTickets.some(player => player.playerId === playerId);
        if (!playerExists) {
            throw new Error("Player must join the game before becoming host.");
        }
        this.game.hostPlayerId = playerId;
    }
    getHostPlayerId() {
        return this.game.hostPlayerId;
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
            throw new Error("Game has already started.");
        }
        if (this.game.playerTickets.length <
            this.game.config.minPlayers) {
            throw new Error(`Minimum ${this.game.config.minPlayers} players are required to start the game.`);
        }
        this.game.status = "ACTIVE";
        this.game.startedAt = new Date();
        this.game.currentRound = 1;
        this.game.roundStartedAt = new Date();
        this.game.numbersAnnouncedThisRound = 0;
    }
    addPlayerTicket(playerId, ticket) {
        if (this.game.status !== "WAITING") {
            throw new Error("Players cannot join after the game has started.");
        }
        if (this.game.playerTickets.length >=
            this.game.config.maxPlayers) {
            throw new Error("Game has reached the maximum player limit.");
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
        if (!this.game.announcedNumbers.includes(number)) {
            throw new Error("Number has not been announced.");
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
            this.completeGame();
        }
    }
    completeGame() {
        if (this.game.status !== "ACTIVE") {
            throw new Error("Game is not active.");
        }
        this.game.status = "COMPLETED";
        this.game.completedAt = new Date();
    }
    // public isGameExpired(): boolean {
    //   if (
    //     this.game.status !== "ACTIVE" ||
    //     !this.game.startedAt
    //   ) {
    //     return false;
    //   }
    //   const currentTime = Date.now();
    //   const startTime = this.game.startedAt.getTime();
    //   const durationInMilliseconds =
    //     this.game.config.durationInMinutes * 60 * 1000;
    //   return currentTime - startTime >= durationInMilliseconds;
    // }
    // public expireGameIfNeeded(): boolean {
    //   if (!this.isGameExpired()) {
    //     return false;
    //   }
    //   this.completeGame();
    //   return true;
    // }
    static fromGame(game) {
        return new GameEngine(game);
    }
    announceNextNumber() {
        if (this.game.status !== "ACTIVE") {
            throw new Error("Game is not active.");
        }
        if (this.game.numbersAnnouncedThisRound >=
            this.game.config.numbersPerRound) {
            throw new Error("Maximum number of announcements for this round has been reached.");
        }
        if (this.game.remainingNumbers.length === 0) {
            throw new Error("No numbers remaining.");
        }
        const number = this.game.remainingNumbers[this.game.remainingNumbers.length - 1];
        this.announceNumber(number);
        this.game.numbersAnnouncedThisRound++;
        return number;
    }
    isRoundComplete() {
        return (this.game.numbersAnnouncedThisRound >=
            this.game.config.numbersPerRound);
    }
    startNextRound() {
        if (this.game.status !== "ACTIVE") {
            throw new Error("Game is not active.");
        }
        if (!this.isRoundComplete()) {
            throw new Error("Current round has not completed yet.");
        }
        this.game.currentRound++;
        this.game.roundStartedAt = new Date();
        this.game.numbersAnnouncedThisRound = 0;
    }
}
exports.GameEngine = GameEngine;
