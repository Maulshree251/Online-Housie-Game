export type ticketCell = number | null;
export type Ticket = ticketCell[][];

export interface GeneratedTicket {
    id: string;
    grid: Ticket;
}


