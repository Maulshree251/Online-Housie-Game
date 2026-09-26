
import { Ticket } from "./ticket";

export type GameStatus = "WAITING" | "ACTIVE" | "COMPLETED";

export type WinnerType =
  | "FIRST_5"
  | "ONE_LINE"
  | "TWO_LINES"
  | "THREE_LINES"
  | "FULL_HOUSE";

export interface PlayerTicket {
  playerId: string;
  ticket: Ticket;
  markedNumbers: Set<number>;
}

export interface Winner {
  playerId: string;
  type: WinnerType;
  wonAt: Date;
}

export interface GameConfig {
  maxPlayers: number;
  minPlayers: number;
  // durationInMinutes: number;
  numbersPerRound: number;
  announcementIntervalInSeconds: number;
}

export interface Game {
  id: string;
  status: GameStatus;

  hostPlayerId: string | null;

  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;

  config: GameConfig;

  // Weekly round state
  currentRound: number;
  roundStartedAt: Date | null;
  numbersAnnouncedThisRound: number;

  // Number pool
  announcedNumbers: number[];
  remainingNumbers: number[];

  // Players
  playerTickets: PlayerTicket[];

  // Winners
  winners: Winner[];
}

export interface SchedulerConfig {
  dayOfWeek: number;
  hour: number;
  minute: number;

  registrationDurationMinutes: number;

  autoCreateNextGame: boolean;
}

const schedulerConfig: SchedulerConfig = {
  dayOfWeek: 6, // Saturday
  hour: 22,
  minute: 0,

  registrationDurationMinutes: 60,

  autoCreateNextGame: true,
};