
import { createServer, Server as HttpServer } from "http";
import { AddressInfo } from "net";
import { Server } from "socket.io";
import { io as createClient, Socket } from "socket.io-client";

import { AnnouncementEngine } from "../game/announcementEngine";
import { GameManager } from "../game/gameManager";
import { RealtimeService } from "../realtime/realtimeService";
import { RealtimeEvent } from "../realtime/realtimeEvents";

describe("AnnouncementEngine + RealtimeService integration", () => {
    let httpServer: HttpServer;
    let ioServer: Server;
    let realtimeService: RealtimeService;
    let client: Socket;
    let port: number;

    const gameId = "announcement-integration-game";

    afterEach(async () => {
        if (client?.connected) {
            client.disconnect();
        }

        if (ioServer) {
            await new Promise<void>((resolve) => {
                ioServer.close(() => resolve());
            });
        }
    });

    it("broadcasts each announced number and round completion to the game room", async () => {
        const game = {
            id: gameId,
            status: "ACTIVE",
            currentRound: 1,
            numbersAnnouncedThisRound: 0,
            config: {
                numbersPerRound: 2,
                announcementIntervalInSeconds: 0,
            },
        };

        const gameEngine = {
            getGame: jest.fn(() => game),
            isRoundComplete: jest.fn(
                () =>
                    game.numbersAnnouncedThisRound >=
                    game.config.numbersPerRound
            ),
            announceNextNumber: jest.fn(() => {
                game.numbersAnnouncedThisRound++;
                return game.numbersAnnouncedThisRound * 10;
            }),
        };

        const gameManager = {
            getGame: jest.fn(() => gameEngine),
            saveGame: jest.fn().mockResolvedValue(undefined),
        } as unknown as GameManager;

        httpServer = createServer();
        ioServer = new Server(httpServer);
        realtimeService = new RealtimeService(ioServer);

        await new Promise<void>((resolve) => {
            httpServer.listen(0, "127.0.0.1", resolve);
        });

        port = (httpServer.address() as AddressInfo).port;

        client = createClient(`http://127.0.0.1:${port}`, {
            forceNew: true,
        });

        await new Promise<void>((resolve, reject) => {
            client.once("connect", resolve);
            client.once("connect_error", reject);
        });



        // Socket.IO client sockets do not expose server-side join().
        // Join the room directly on the server for this focused test.
        const serverSocket = ioServer.sockets.sockets.get(client.id!);
        expect(serverSocket).toBeDefined();
        serverSocket!.join(`game:${gameId}`);

        const receivedNumbers: unknown[] = [];
        let receivedRoundCompletion: unknown;

        client.on(RealtimeEvent.NUMBER_ANNOUNCED, (payload) => {
            receivedNumbers.push(payload);
        });

        const roundCompletedPromise = new Promise<void>((resolve) => {
            client.once(RealtimeEvent.ROUND_COMPLETED, (payload) => {
                receivedRoundCompletion = payload;
                resolve();
            });
        });

        const announcementEngine = new AnnouncementEngine(
            gameManager,
            (id, number) => {
                realtimeService.emitToGame(
                    id,
                    RealtimeEvent.NUMBER_ANNOUNCED,
                    {
                        gameId: id,
                        number,
                        round: game.currentRound,
                        announcedCount: game.numbersAnnouncedThisRound,
                        totalNumbers: game.config.numbersPerRound,
                    }
                );
            },
            (id, round) => {
                realtimeService.emitToGame(
                    id,
                    RealtimeEvent.ROUND_COMPLETED,
                    { gameId: id, round }
                );
            }
        );

        await announcementEngine.runWeeklyRound(gameId);
        await roundCompletedPromise;

        expect(receivedNumbers).toEqual([
            {
                event: RealtimeEvent.NUMBER_ANNOUNCED,
                data: {
                    gameId,
                    number: 10,
                    round: 1,
                    announcedCount: 1,
                    totalNumbers: 2,
                },
            },
            {
                event: RealtimeEvent.NUMBER_ANNOUNCED,
                data: {
                    gameId,
                    number: 20,
                    round: 1,
                    announcedCount: 2,
                    totalNumbers: 2,
                },
            },
        ]);

        expect(receivedRoundCompletion).toEqual({
            event: RealtimeEvent.ROUND_COMPLETED,
            data: { gameId, round: 1 },
        });

        expect(gameManager.saveGame).toHaveBeenCalledTimes(2);
        expect(announcementEngine.isRunning(gameId)).toBe(false);
    });
});
