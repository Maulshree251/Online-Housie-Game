
import { createServer, Server as HttpServer } from "http";
import { AddressInfo } from "net";
import { Server } from "socket.io";
import { io as createClient, Socket } from "socket.io-client";
import { setupSocketHandlers } from "../socket/setupSocketHandlers";
import {
    generateAccessToken,
} from "../auth/tokenService";
import { RealtimeEvent } from "../realtime/realtimeEvents";
import { GameManager } from "../game/gameManager";
import { GameEngine } from "../game/gameEngine";
import { generateTicketLayout } from "../tickets/ticketGenerator";
import { RealtimeService } from "../realtime/realtimeService";

describe("Socket.IO integration", () => {

    let httpServer: HttpServer;
    let ioServer: Server;
    let port: number;

    const gameId = "socket-test-game";
    const participantId = "socket-test-user";

    const secondGameId = "socket-test-game-2";
    const secondParticipantId = "socket-test-user-2";

    const gameEngines = new Map<string, GameEngine>();

    let gameManager: GameManager;
    let realtimeService: RealtimeService;

    function createTestGame(
        id: string,
        playerIds: string[],
        announcedNumbers: number[]
    ): GameEngine {
        const engine = new GameEngine();
        const game = engine.getGame();

        // Add participants while the game is still WAITING.
        for (const playerId of playerIds) {
            engine.addPlayerTicket(playerId, generateTicketLayout());
        }

        // Configure the test state.
        game.id = id;
        game.status = "ACTIVE";
        game.currentRound = 1;
        game.announcedNumbers = [...announcedNumbers];

        return engine;
    }




    beforeAll(async () => {

        process.env.JWT_ACCESS_SECRET ??= "socket-test-access-secret";
        process.env.JWT_REFRESH_SECRET ??= "socket-test-refresh-secret";

        httpServer = createServer();
        ioServer = new Server(httpServer);
        realtimeService = new RealtimeService(ioServer);

        gameEngines.set(
            gameId,
            createTestGame(
                gameId,
                [participantId, "another-user"],
                [12, 35]
            )
        );

        gameEngines.set(
            secondGameId,
            createTestGame(
                secondGameId,
                [secondParticipantId, "another-user-2"],
                [7, 21]
            )
        );

        gameManager = {
            getGame: (id: string) => {
                const engine = gameEngines.get(id);

                if (!engine) {
                    throw new Error(`Game not found: ${id}`);
                }

                return engine;
            },
        } as unknown as GameManager;

        setupSocketHandlers(ioServer, gameManager);
        await new Promise<void>((resolve) => {
            httpServer.listen(0, "127.0.0.1", resolve);
        });

        port = (httpServer.address() as AddressInfo).port;
    });

    afterAll(async () => {
        await new Promise<void>((resolve, reject) => {
            ioServer.close((error) => {
                if (error) reject(error);
                else resolve();
            });
        });
    });

    function connectClient(token?: string): Socket {
        return createClient(`http://127.0.0.1:${port}`, {
            auth: token ? { token } : {},
            forceNew: true,
            reconnection: false,
        });
    }

    function waitForConnect(socket: Socket): Promise<void> {
        return new Promise((resolve, reject) => {
            socket.once("connect", resolve);
            socket.once("connect_error", reject);
        });
    }

    it("connects with a valid access token", async () => {
        const client = connectClient(
            generateAccessToken(participantId)
        );

        try {
            await waitForConnect(client);
            expect(client.connected).toBe(true);
        } finally {
            client.disconnect();
        }
    });

    it("rejects a connection without a token", async () => {
        const client = connectClient();

        try {
            await expect(waitForConnect(client)).rejects.toThrow(
                "UNAUTHENTICATED"
            );
        } finally {
            client.disconnect();
        }
    });

    it("rejects an invalid token", async () => {
        const client = connectClient("not-a-valid-jwt");

        try {
            await expect(waitForConnect(client)).rejects.toThrow(
                "INVALID_TOKEN"
            );
        } finally {
            client.disconnect();
        }
    });

    it("sends GAME_STATE when a participant joins", async () => {
        const client = connectClient(
            generateAccessToken(participantId)
        );

        try {
            await waitForConnect(client);

            const statePromise = new Promise<any>((resolve) => {
                client.once(RealtimeEvent.GAME_STATE, resolve);
            });

            client.emit("joinGame", { gameId });

            const response = await statePromise;

            expect(response.event).toBe(RealtimeEvent.GAME_STATE);
            expect(response.data.gameId).toBe(gameId);
            expect(response.data.status).toBe("ACTIVE");
            expect(response.data.announcedNumbers).toEqual([12, 35]);
        } finally {
            client.disconnect();
        }
    });

    it("rejects a non-participant trying to join a game", async () => {
        const client = connectClient(
            generateAccessToken("unauthorized-user")
        );

        try {
            await waitForConnect(client);

            const errorPromise = new Promise<any>((resolve) => {
                client.once(RealtimeEvent.GAME_ERROR, resolve);
            });

            client.emit("joinGame", { gameId });

            const response = await errorPromise;

            expect(response.event).toBe(RealtimeEvent.GAME_ERROR);
            expect(response.data.message).toBe(
                "You are not a participant in this game."
            );
        } finally {
            client.disconnect();
        }
    });


    it("should deliver an announcement to both clients in the same game room", async () => {
        const client1 = connectClient(generateAccessToken(participantId));
        const client2 = connectClient(generateAccessToken(participantId));

        try {
            await Promise.all([
                new Promise<void>((resolve, reject) => {
                    client1.once("connect", resolve);
                    client1.once("connect_error", reject);
                }),
                new Promise<void>((resolve, reject) => {
                    client2.once("connect", resolve);
                    client2.once("connect_error", reject);
                }),
            ]);

            const state1 = new Promise((resolve) =>
                client1.once(RealtimeEvent.GAME_STATE, resolve)
            );
            const state2 = new Promise((resolve) =>
                client2.once(RealtimeEvent.GAME_STATE, resolve)
            );

            client1.emit("joinGame", { gameId });
            client2.emit("joinGame", { gameId });

            await Promise.all([state1, state2]);

            const announcement = {
                event: RealtimeEvent.NUMBER_ANNOUNCED,
                data: {
                    gameId,
                    number: 42,
                    round: 1,
                    announcedCount: 3,
                    totalNumbers: 10,
                },
            };

            const received1 = new Promise((resolve) =>
                client1.once(RealtimeEvent.NUMBER_ANNOUNCED, resolve)
            );
            const received2 = new Promise((resolve) =>
                client2.once(RealtimeEvent.NUMBER_ANNOUNCED, resolve)
            );

            ioServer.to(`game:${gameId}`).emit(
                RealtimeEvent.NUMBER_ANNOUNCED,
                announcement
            );

            const [message1, message2] = await Promise.all([
                received1,
                received2,
            ]);

            expect(message1).toEqual(announcement);
            expect(message2).toEqual(announcement);
        } finally {
            client1.disconnect();
            client2.disconnect();
        }
    });

    it("should not deliver an announcement to a client in another game room", async () => {
        const client1 = connectClient(generateAccessToken(participantId));
        const client2 = connectClient(
            generateAccessToken(secondParticipantId)
        );

        try {
            await Promise.all([
                new Promise<void>((resolve, reject) => {
                    client1.once("connect", resolve);
                    client1.once("connect_error", reject);
                }),
                new Promise<void>((resolve, reject) => {
                    client2.once("connect", resolve);
                    client2.once("connect_error", reject);
                }),
            ]);

            const state1 = new Promise((resolve) =>
                client1.once(RealtimeEvent.GAME_STATE, resolve)
            );
            const state2 = new Promise((resolve) =>
                client2.once(RealtimeEvent.GAME_STATE, resolve)
            );

            client1.emit("joinGame", { gameId });
            client2.emit("joinGame", { gameId: secondGameId });

            await Promise.all([state1, state2]);

            const receivedByClient1 = jest.fn();
            const receivedByClient2 = jest.fn();

            client1.on(
                RealtimeEvent.NUMBER_ANNOUNCED,
                receivedByClient1
            );
            client2.on(
                RealtimeEvent.NUMBER_ANNOUNCED,
                receivedByClient2
            );

            ioServer.to(`game:${gameId}`).emit(
                RealtimeEvent.NUMBER_ANNOUNCED,
                {
                    event: RealtimeEvent.NUMBER_ANNOUNCED,
                    data: {
                        gameId,
                        number: 42,
                        round: 1,
                        announcedCount: 3,
                        totalNumbers: 10,
                    },
                }
            );

            await new Promise((resolve) => setTimeout(resolve, 150));

            expect(receivedByClient1).toHaveBeenCalledTimes(1);
            expect(receivedByClient2).not.toHaveBeenCalled();
        } finally {
            client1.disconnect();
            client2.disconnect();
        }
    });

    it("should not deliver a room announcement to a client that has not joined the room", async () => {
        const participant = connectClient(
            generateAccessToken(participantId)
        );
        const nonParticipant = connectClient(
            generateAccessToken("unrelated-connected-user")
        );

        try {
            await Promise.all([
                new Promise<void>((resolve, reject) => {
                    participant.once("connect", resolve);
                    participant.once("connect_error", reject);
                }),
                new Promise<void>((resolve, reject) => {
                    nonParticipant.once("connect", resolve);
                    nonParticipant.once("connect_error", reject);
                }),
            ]);

            const stateReceived = new Promise((resolve) =>
                participant.once(RealtimeEvent.GAME_STATE, resolve)
            );

            participant.emit("joinGame", { gameId });
            await stateReceived;

            const participantReceived = new Promise((resolve) =>
                participant.once(RealtimeEvent.NUMBER_ANNOUNCED, resolve)
            );

            const nonParticipantReceived = jest.fn();
            nonParticipant.on(
                RealtimeEvent.NUMBER_ANNOUNCED,
                nonParticipantReceived
            );

            const announcement = {
                event: RealtimeEvent.NUMBER_ANNOUNCED,
                data: {
                    gameId,
                    number: 55,
                    round: 1,
                    announcedCount: 4,
                    totalNumbers: 10,
                },
            };

            ioServer.to(`game:${gameId}`).emit(
                RealtimeEvent.NUMBER_ANNOUNCED,
                announcement
            );

            await expect(participantReceived).resolves.toEqual(announcement);

            await new Promise((resolve) => setTimeout(resolve, 150));

            expect(nonParticipantReceived).not.toHaveBeenCalled();
        } finally {
            participant.disconnect();
            nonParticipant.disconnect();
        }
    });


    it("broadcasts a number announcement through RealtimeService only to the correct game room", async () => {
        const client1 = connectClient(
            generateAccessToken(participantId)
        );

        const client2 = connectClient(
            generateAccessToken(secondParticipantId)
        );

        try {
            await Promise.all([
                waitForConnect(client1),
                waitForConnect(client2),
            ]);

            const state1 = new Promise((resolve) =>
                client1.once(RealtimeEvent.GAME_STATE, resolve)
            );

            const state2 = new Promise((resolve) =>
                client2.once(RealtimeEvent.GAME_STATE, resolve)
            );

            client1.emit("joinGame", { gameId });
            client2.emit("joinGame", { gameId: secondGameId });

            await Promise.all([state1, state2]);

            const expectedPayload = {
                event: RealtimeEvent.NUMBER_ANNOUNCED,
                data: {
                    gameId,
                    number: 42,
                    round: 1,
                    announcedCount: 3,
                    totalNumbers: 10,
                },
            };

            const receivedByClient1 = new Promise((resolve) =>
                client1.once(RealtimeEvent.NUMBER_ANNOUNCED, resolve)
            );

            const receivedByClient2 = jest.fn();

            client2.on(
                RealtimeEvent.NUMBER_ANNOUNCED,
                receivedByClient2
            );

            // Use the actual RealtimeService instead of emitting
            // directly through ioServer.
            realtimeService.emitToGame(
                gameId,
                RealtimeEvent.NUMBER_ANNOUNCED,
                {
                    gameId,
                    number: 42,
                    round: 1,
                    announcedCount: 3,
                    totalNumbers: 10,
                }
            );

            const receivedPayload = await receivedByClient1;

            expect(receivedPayload).toEqual(expectedPayload);

            // Allow time for an incorrectly routed event to arrive.
            await new Promise((resolve) => setTimeout(resolve, 150));

            expect(receivedByClient2).not.toHaveBeenCalled();
        } finally {
            client1.disconnect();
            client2.disconnect();
        }
    });


});
