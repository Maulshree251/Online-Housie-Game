export interface GameScheduleConfig {
    dayOfWeek: number;
    hour: number;
    minute: number;

    maxPlayers: number;
    minPlayers: number;

    numbersPerRound: number;
    announcementIntervalInSeconds: number;

    autoCreateNextGame: boolean;
}

export const gameSchedule: GameScheduleConfig = {
    dayOfWeek: 6, // Saturday
    hour: 22,     // 10 PM
    minute: 0,

    maxPlayers: 20,
    minPlayers: 2,

    numbersPerRound: 10,

    // Keep this small while testing.
    announcementIntervalInSeconds: 10,

    autoCreateNextGame: true,
};