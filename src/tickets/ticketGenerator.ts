import { Ticket, ticketCell } from "../models/ticket";

const ROWS = 3;
const COLUMNS = 9;
const NUMBERS_PER_ROW = 5;
const COLUMN_RANGES = [
  { min: 1, max: 9 },
  { min: 10, max: 19 },
  { min: 20, max: 29 },
  { min: 30, max: 39 },
  { min: 40, max: 49 },
  { min: 50, max: 59 },
  { min: 60, max: 69 },
  { min: 70, max: 79 },
  { min: 80, max: 90 },
];

/**
 * Generates a valid 3 × 9 Tambola ticket layout.
 *
 * Rules:
 * - 3 rows
 * - 9 columns
 * - Exactly 5 numbers in each row
 * - At least 1 number in each column
 */

function hasFiveNumbersPerRow(ticket: Ticket): boolean {
  for (const row of ticket) {
    if (countNumbers(row) !== NUMBERS_PER_ROW) {
      return false;
    }
  }

  return true;
}

export function generateTicketLayout(): Ticket {
  const ticket: Ticket = Array.from(
    { length: ROWS },
    () => Array<ticketCell>(COLUMNS).fill(null)
  );

  // Every column must contain at least one number.
  // We start with one number in every column.
  const columnCounts: number[] = Array(COLUMNS).fill(1);

  // We have 15 total numbers.
  // 9 columns already contain 9 numbers.
  // We need to distribute the remaining 6.
  let remainingNumbers = 15 - COLUMNS;

  while (remainingNumbers > 0) {
    const availableColumns = columnCounts
      .map((count, column) => ({ count, column }))
      .filter(({ count }) => count < ROWS);

    const randomIndex = Math.floor(
      Math.random() * availableColumns.length
    );

    const selectedColumn = availableColumns[randomIndex].column;

    columnCounts[selectedColumn]++;
    remainingNumbers--;
  }

  // Now place each column's numbers into different rows.
  for (let column = 0; column < COLUMNS; column++) {
    const requiredNumbers = columnCounts[column];

    const availableRows = [0, 1, 2];

    shuffle(availableRows);

    for (let i = 0; i < requiredNumbers; i++) {
      const row = availableRows[i];

      ticket[row][column] = 0;
    }
  }

  // Check that every row has exactly 5 numbers.
  if (!hasFiveNumbersPerRow(ticket)) {
    // If the random placement didn't work,
    // generate another layout.
    return generateTicketLayout();
  }

  return fillTicketNumbers(ticket);
}

function countNumbers(row: ticketCell[]): number {
  return row.filter((cell) => cell !== null).length;
}

function shuffle(array: number[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const randomIndex = Math.floor(
      Math.random() * (i + 1)
    );

    [array[i], array[randomIndex]] = [
      array[randomIndex],
      array[i],
    ];
  }
}

function getRandomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateUniqueNumbers(
  min: number,
  max: number,
  count: number
): number[] {
  const numbers: number[] = [];

  while (numbers.length < count) {
    const number = getRandomNumber(min, max);

    if (!numbers.includes(number)) {
      numbers.push(number);
    }
  }

  return numbers;
}

function fillTicketNumbers(ticket: Ticket): Ticket {
  for (let column = 0; column < COLUMNS; column++) {
    const { min, max } = COLUMN_RANGES[column];

    // Find which rows have a number position
    // in this column.
    const rowsWithNumbers: number[] = [];

    for (let row = 0; row < ROWS; row++) {
      if (ticket[row][column] !== null) {
        rowsWithNumbers.push(row);
      }
    }

    // Generate the required number of unique numbers.
    const numbers = generateUniqueNumbers(
      min,
      max,
      rowsWithNumbers.length
    );

    // Sort numbers from smallest to largest.
    numbers.sort((a, b) => a - b);

    // Put the numbers into their rows.
    for (let i = 0; i < rowsWithNumbers.length; i++) {
      const row = rowsWithNumbers[i];

      ticket[row][column] = numbers[i];
    }
  }

  return ticket;
}


export function validateTicket(ticket: Ticket): boolean {
  // Check the ticket has exactly 3 rows.
  if (ticket.length !== ROWS) {
    return false;
  }

  // Check every row has exactly 9 columns.
  for (const row of ticket) {
    if (row.length !== COLUMNS) {
      return false;
    }
  }

  // Check every row contains exactly 5 numbers.
  for (const row of ticket) {
    const numberCount = row.filter(
      (cell: ticketCell) => cell !== null
    ).length;

    if (numberCount !== NUMBERS_PER_ROW) {
      return false;
    }
  }

  // Check every column contains at least one number.
  for (let column = 0; column < COLUMNS; column++) {
    let numberCount = 0;

    for (let row = 0; row < ROWS; row++) {
      if (ticket[row][column] !== null) {
        numberCount++;
      }
    }

    if (numberCount === 0) {
      return false;
    }
  }

  // Check that every number belongs to its column's range.
  for (let column = 0; column < COLUMNS; column++) {
    const { min, max } = COLUMN_RANGES[column];

    for (let row = 0; row < ROWS; row++) {
      const value = ticket[row][column];

      if (value !== null) {
        if (value < min || value > max) {
          return false;
        }
      }
    }
  }

  // Check that numbers within each column
  // are sorted from smallest to largest.
  for (let column = 0; column < COLUMNS; column++) {
    const numbers: number[] = [];

    for (let row = 0; row < ROWS; row++) {
      const value = ticket[row][column];

      if (value !== null) {
        numbers.push(value);
      }
    }

    for (let i = 1; i < numbers.length; i++) {
      if (numbers[i] <= numbers[i - 1]) {
        return false;
      }
    }
  }

  // Check that no number appears more than once.
  const allNumbers: number[] = [];

  for (const row of ticket) {
    for (const value of row) {
      if (value !== null) {
        allNumbers.push(value);
      }
    }
  }

  const uniqueNumbers = new Set(allNumbers);

  if (uniqueNumbers.size !== allNumbers.length) {
    return false;
  }

  return true;
}