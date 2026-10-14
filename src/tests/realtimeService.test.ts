
import { Server } from "socket.io";
import { RealtimeService } from "../realtime/realtimeService";
import { RealtimeEvent } from "../realtime/realtimeEvents";

describe("RealtimeService", () => {
    let io: any;
    let service: RealtimeService;
    let roomEmit: jest.Mock;
    let socketEmit: jest.Mock;
    let socketJoin: jest.Mock;
    let socketLeave: jest.Mock;

    beforeEach(() => {
        roomEmit = jest.fn();
        socketEmit = jest.fn();
        socketJoin = jest.fn();
        socketLeave = jest.fn();

        io = {
            to: jest.fn((target: string) => ({
                emit:
                    target.startsWith("game:")
                        ? roomEmit
                        : socketEmit,
            })),
            sockets: {
                sockets: new Map([
                    [
                        "socket-1",
                        {
                            join: socketJoin,
                            leave: socketLeave,
                        },
                    ],
                ]),
            },
        };

        service = new RealtimeService(io as Server);
    });

    it("should broadcast an event to the correct game room", () => {
        const data = {
            gameId: "game-123",
            number: 42,
            round: 1,
        };

        service.emitToGame(
            "game-123",
            RealtimeEvent.NUMBER_ANNOUNCED,
            data
        );

        expect(io.to).toHaveBeenCalledWith("game:game-123");
        expect(roomEmit).toHaveBeenCalledWith(
            RealtimeEvent.NUMBER_ANNOUNCED,
            {
                event: RealtimeEvent.NUMBER_ANNOUNCED,
                data,
            }
        );
    });

    it("should emit an event to a specific socket", () => {
        const data = { message: "Test message" };

        service.emitToSocket(
            "socket-1",
            RealtimeEvent.GAME_ERROR,
            data
        );

        expect(io.to).toHaveBeenCalledWith("socket-1");
        expect(socketEmit).toHaveBeenCalledWith(
            RealtimeEvent.GAME_ERROR,
            {
                event: RealtimeEvent.GAME_ERROR,
                data,
            }
        );
    });

    it("should join a socket to the correct game room", () => {
        service.joinGameRoom("socket-1", "game-123");

        expect(socketJoin).toHaveBeenCalledWith("game:game-123");
    });

    it("should leave a socket's game room", () => {
        service.leaveGameRoom("socket-1", "game-123");

        expect(socketLeave).toHaveBeenCalledWith("game:game-123");
    });

    it("should throw when joining a room with a missing socket", () => {
        expect(() =>
            service.joinGameRoom("missing-socket", "game-123")
        ).toThrow("Socket not found.");
    });

    it("should not throw when leaving a room with a missing socket", () => {
        expect(() =>
            service.leaveGameRoom("missing-socket", "game-123")
        ).not.toThrow();
    });
});
