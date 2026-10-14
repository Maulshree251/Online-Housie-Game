
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

import { GameManager } from "./game/gameManager";
import { GameRepository } from "./repositories/gameRepository";
import { createGameRoutes } from "./routes/gameRoutes";
import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";
import { RealtimeService } from "./realtime/realtimeService";
import { setupSocketHandlers } from "./socket/setupSocketHandlers";

export function createApp() {
    const app = express();
    const httpServer = createServer(app);

    const io = new Server(httpServer, {
        cors: { origin: "*" },
    });

    const gameRepository = new GameRepository();
    const gameManager = new GameManager(gameRepository);
    const realtimeService = new RealtimeService(io);

    app.use(express.json());

    app.use("/api/auth", authRoutes);
    app.use("/api/users", userRoutes);

    app.use(
        "/api/games",
        createGameRoutes(
            gameManager,
            gameRepository,
            realtimeService
        )
    );

    app.get("/", (_req, res) => {
        res.send("Tambola server is running!");
    });

    setupSocketHandlers(io, gameManager);

    return {
        app,
        httpServer,
        io,
        gameManager,
        gameRepository,
        realtimeService,
    };
}
