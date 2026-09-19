
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

            durationInMinutes: {
                type: Number,
                required: true,
            },
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

    createdAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;

    config: {
        maxPlayers: number;
        durationInMinutes: number;
    };

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