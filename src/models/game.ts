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

export interface Game {
  id: string;
  status: GameStatus;
  announcedNumbers: number[];
  remainingNumbers: number[];
  playerTickets: PlayerTicket[];
  winners: Winner[];
}