
import mongoose, { Schema, Document } from "mongoose";


// --------------------------------------------------
// PLAYER TICKET SCHEMA
// --------------------------------------------------

const playerTicketSchema = new Schema(
    {
        playerId: {
            type: String,
            required: true,
        },

        ticket: {
            type: [[Schema.Types.Mixed]],
            required: true,
        },

        markedNumbers: {
            type: [Number],
            default: [],
        },
    },
    {
        _id: false,
    }
);


// --------------------------------------------------
// WINNER SCHEMA
// --------------------------------------------------

const winnerSchema = new Schema(
    {
        playerId: {
            type: String,
            required: true,
        },

        type: {
            type: String,
            enum: [
                "FIRST_5",
                "ONE_LINE",
                "TWO_LINES",
                "THREE_LINES",
                "FULL_HOUSE",
            ],
            required: true,
        },

        wonAt: {
            type: Date,
            required: true,
        },
    },
    {
        _id: false,
    }
);


// --------------------------------------------------
// GAME SCHEMA
// --------------------------------------------------

const gameSchema = new Schema(
    {
        id: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },

        status: {
            type: String,
            enum: ["WAITING", "ACTIVE", "COMPLETED"],
            required: true,
        },
        hostPlayerId: {
            type: String,
            default: null,
        },
        createdAt: {
            type: Date,
            required: true,
        },

        startedAt: {
            type: Date,
            default: null,
        },

        completedAt: {
            type: Date,
            default: null,
        },

        config: {
            maxPlayers: {
                type: Number,
                required: true,
            },

            minPlayers: {
                type: Number,
                required: true,
            },

            numbersPerRound: {
                type: Number,
                required: true,
            },

            announcementIntervalInSeconds: {
                type: Number,
                required: true,
            },
        },
        currentRound: {
            type: Number,
            required: true,
            default: 0,
        },

        roundStartedAt: {
            type: Date,
            default: null,
        },

        numbersAnnouncedThisRound: {
            type: Number,
            required: true,
            default: 0,
        },

        announcedNumbers: {
            type: [Number],
            default: [],
        },

        remainingNumbers: {
            type: [Number],
            default: [],
        },

        playerTickets: {
            type: [playerTicketSchema],
            default: [],
        },

        winners: {
            type: [winnerSchema],
            default: [],
        },
    },
    {
        timestamps: false,
    }
);


// --------------------------------------------------
// DOCUMENT TYPE
// --------------------------------------------------

export interface GameDocument extends Document {
    id: string;
    status: "WAITING" | "ACTIVE" | "COMPLETED";
    hostPlayerId: string | null;
    createdAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;

    config: {
        maxPlayers: number;
        minPlayers: number;
        numbersPerRound: number;
        announcementIntervalInSeconds: number;
    };
    currentRound: number;
    roundStartedAt: Date | null;
    numbersAnnouncedThisRound: number;
    announcedNumbers: number[];
    remainingNumbers: number[];

    playerTickets: {
        playerId: string;
        ticket: (number | null)[][];
        markedNumbers: number[];
    }[];

    winners: {
        playerId: string;
        type:
        | "FIRST_5"
        | "ONE_LINE"
        | "TWO_LINES"
        | "THREE_LINES"
        | "FULL_HOUSE";
        wonAt: Date;
    }[];
}


// --------------------------------------------------
// MODEL
// --------------------------------------------------

export const GameModel = mongoose.model<GameDocument>(
    "Game",
    gameSchema
);