import { Server } from "socket.io";
import { RealtimeEvent } from "./realtimeEvents";

export class RealtimeService {
  constructor(private io: Server) { }

  private getGameRoom(gameId: string): string {
    return `game:${gameId}`;
  }

  public emitToGame(
    gameId: string,
    event: RealtimeEvent,
    data: unknown
  ): void {
    this.io.to(this.getGameRoom(gameId)).emit(event, {
      event,
      data,
    });
  }

  public emitToSocket(
    socketId: string,
    event: RealtimeEvent,
    data: unknown
  ): void {
    this.io.to(socketId).emit(event, {
      event,
      data,
    });
  }

  public joinGameRoom(socketId: string, gameId: string): void {
    const socket = this.io.sockets.sockets.get(socketId);

    if (!socket) {
      throw new Error("Socket not found.");
    }

    socket.join(this.getGameRoom(gameId));
  }

  public leaveGameRoom(socketId: string, gameId: string): void {
    const socket = this.io.sockets.sockets.get(socketId);

    if (!socket) {
      return;
    }

    socket.leave(this.getGameRoom(gameId));
  }
}