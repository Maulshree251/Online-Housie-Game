import { Router } from "express";
import { GameController } from "../controllers/gameController";
import { GameManager } from "../game/gameManager";
import { requireAuth } from "../middleware/authMiddleware";
import { GameRepository } from "../repositories/gameRepository";

export function createGameRoutes(gameManager: GameManager, gameRepository: GameRepository) {
    const router = Router();

    const gameController = new GameController(gameManager, gameRepository);

    router.get("/current", gameController.getCurrentGame);

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
    router.get(
        "/:gameId/winning-categories",
        gameController.getWinningCategories
    );
    router.post(
        "/:gameId/claim",
        requireAuth,
        gameController.claimWinner
    );
    router.get(
        "/:gameId/winners",
        gameController.getWinners
    );
    router.get(
        "/history",
        gameController.getGameHistory
    );

    router.get(
        "/history/:gameId",
        gameController.getGameHistoryById
    );
    router.get("/:gameId", gameController.getGameById);
    return router;
}