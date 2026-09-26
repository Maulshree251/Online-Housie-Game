
import { Game, PlayerTicket } from "../models/game";
import { GameModel } from "../database/models/gameModel";


// --------------------------------------------------
// CONVERSION HELPERS
// --------------------------------------------------

function gameToDatabase(game: Game) {
    return {
        id: game.id,
        status: game.status,
        hostPlayerId: game.hostPlayerId,
        createdAt: game.createdAt,
        startedAt: game.startedAt,
        completedAt: game.completedAt,

        config: {
            maxPlayers: game.config.maxPlayers,
            minPlayers: game.config.minPlayers,
            numbersPerRound: game.config.numbersPerRound,
            announcementIntervalInSeconds:
                game.config.announcementIntervalInSeconds,
        },
        currentRound: game.currentRound,
        roundStartedAt: game.roundStartedAt,
        numbersAnnouncedThisRound:
            game.numbersAnnouncedThisRound,
        announcedNumbers: game.announcedNumbers,
        remainingNumbers: game.remainingNumbers,

        playerTickets: game.playerTickets.map(
            (playerTicket: PlayerTicket) => ({
                playerId: playerTicket.playerId,
                ticket: playerTicket.ticket,
                markedNumbers: Array.from(playerTicket.markedNumbers),
            })
        ),

        winners: game.winners,
    };
}


function databaseToGame(document: any): Game {
    return {
        id: document.id,
        status: document.status,
        hostPlayerId: document.hostPlayerId ?? null,
        createdAt: new Date(document.createdAt),
        startedAt: document.startedAt
            ? new Date(document.startedAt)
            : null,
        completedAt: document.completedAt
            ? new Date(document.completedAt)
            : null,

        config: {
            maxPlayers: document.config.maxPlayers,
            minPlayers: document.config.minPlayers,
            numbersPerRound: document.config.numbersPerRound,
            announcementIntervalInSeconds:
                document.config.announcementIntervalInSeconds,
        },
        currentRound: document.currentRound,
        roundStartedAt: document.roundStartedAt
            ? new Date(document.roundStartedAt)
            : null,

        numbersAnnouncedThisRound:
            document.numbersAnnouncedThisRound,
        announcedNumbers: [...document.announcedNumbers],
        remainingNumbers: [...document.remainingNumbers],

        playerTickets: document.playerTickets.map(
            (playerTicket: any) => ({
                playerId: playerTicket.playerId,
                ticket: playerTicket.ticket,
                markedNumbers: new Set<number>(
                    playerTicket.markedNumbers
                ),
            })
        ),

        winners: document.winners.map((winner: any) => ({
            playerId: winner.playerId,
            type: winner.type,
            wonAt: new Date(winner.wonAt),
        })),
    };
}


// --------------------------------------------------
// REPOSITORY
// --------------------------------------------------

export class GameRepository {

    public async create(game: Game): Promise<Game> {
        const databaseData = gameToDatabase(game);

        const document = await GameModel.create(databaseData);

        return databaseToGame(document);
    }


    public async findById(gameId: string): Promise<Game | null> {
        const document = await GameModel.findOne({
            id: gameId,
        }).lean();

        if (!document) {
            return null;
        }

        return databaseToGame(document);
    }


    public async save(game: Game): Promise<Game> {
        const databaseData = gameToDatabase(game);

        const document = await GameModel.findOneAndUpdate(
            {
                id: game.id,
            },
            databaseData,
            {
                new: true,
                upsert: true,
                runValidators: true,
            }
        ).lean();

        if (!document) {
            throw new Error("Failed to save game.");
        }

        return databaseToGame(document);
    }


    public async delete(gameId: string): Promise<boolean> {
        const result = await GameModel.deleteOne({
            id: gameId,
        });

        return result.deletedCount > 0;
    }


    public async findRecoverableGames(): Promise<Game[]> {
        const documents = await GameModel.find({
            status: {
                $in: ["WAITING", "ACTIVE"],
            },
        }).lean();

        return documents.map((document) =>
            databaseToGame(document)
        );
    }
}