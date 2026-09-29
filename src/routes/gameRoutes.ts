import { Router } from "express";
import { GameController } from "../controllers/gameController";
import { GameManager } from "../game/gameManager";
import { requireAuth } from "../middleware/authMiddleware";

export function createGameRoutes(gameManager: GameManager) {
    const router = Router();

    const gameController = new GameController(gameManager);

    router.get("/current", gameController.getCurrentGame);
    router.get("/:gameId", gameController.getGameById);
    router.post(
        "/:gameId/join",
        requireAuth,
        gameController.joinGame
    );
    router.post(
        "/:gameId/leave",
        requireAuth,
        gameController.leaveGame
    );
    router.get(
        "/:gameId/players",
        gameController.getPlayers
    );
    router.get(
        "/:gameId/my-ticket",
        requireAuth,
        gameController.getMyTicket
    );
    router.post(
        "/:gameId/mark",
        requireAuth,
        gameController.markNumber
    );
    return router;
}