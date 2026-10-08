export const RealtimeEvent = {
    GAME_STATE: "GAME_STATE",
    PLAYER_JOINED: "PLAYER_JOINED",
    PLAYER_LEFT: "PLAYER_LEFT",
    NUMBER_ANNOUNCED: "NUMBER_ANNOUNCED",
    ROUND_STARTED: "ROUND_STARTED",
    ROUND_COMPLETED: "ROUND_COMPLETED",
    WINNER_CLAIMED: "WINNER_CLAIMED",
    GAME_COMPLETED: "GAME_COMPLETED",
    GAME_ERROR: "GAME_ERROR",
    NOTIFICATION: "NOTIFICATION",
} as const;

// export type RealtimeEventName =
//   typeof RealtimeEvent[keyof typeof RealtimeEvent];

export type RealtimeEvent = typeof RealtimeEvent[keyof typeof RealtimeEvent];