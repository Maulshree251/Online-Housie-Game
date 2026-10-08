import { Socket } from "socket.io";
import { Server } from "socket.io";

export interface AuthenticatedSocket extends Socket {
    data: Socket["data"] & {
        userId: string;
    };
}