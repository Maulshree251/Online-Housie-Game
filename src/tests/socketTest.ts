import { io } from "socket.io-client";

const SERVER_URL = "http://localhost:3000";

const PLAYER_1_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJlZGRlYzdlMi0zMzQ0LTQ4YzMtYWZkNC1iZjJkMmI2N2M0ZDEiLCJ0eXBlIjoiYWNjZXNzIiwiaWF0IjoxNzkxOTExNDE3LCJleHAiOjE3OTE5MTIzMTd9.6jtvzHX0v1MYaJsA3M9tAQ46IwlRrisa6hMkzUnDQvc";
const PLAYER_2_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMDg4ODM5MS0zNTJkLTQyZTEtYjk4MC02MTkyMzRhZDFiYTMiLCJ0eXBlIjoiYWNjZXNzIiwiaWF0IjoxNzkxOTExNDkxLCJleHAiOjE3OTE5MTIzOTF9.x4Qk7Gi65mnJykEoEHembO1WfrT8BzRQ3uIhrIkMrJY";

const GAME_ID = "d4ec5749-96a5-42fd-aa22-8c0d0068d32e";


function createClient(
    name: string,
    token: string
) {
    const socket = io(SERVER_URL, {
        auth: {
            token,
        },
    });

    socket.on("connect", () => {

        console.log(
            `[${name}] connected:`,
            socket.id
        );

        socket.emit("joinGame", {
            gameId: GAME_ID,
        });
    });

    socket.on("GAME_STATE", (payload) => {
        console.log(
            `[${name}] GAME_STATE`,
            JSON.stringify(payload, null, 2)
        );
    });

    socket.on("ROUND_STARTED", (payload) => {
        console.log(
            `[${name}] ROUND_STARTED`,
            JSON.stringify(payload, null, 2)
        );
    });

    socket.on("NUMBER_ANNOUNCED", (payload) => {
        console.log(
            `[${name}] NUMBER_ANNOUNCED`,
            JSON.stringify(payload, null, 2)
        );
    });

    socket.on("ROUND_COMPLETED", (payload) => {
        console.log(
            `[${name}] ROUND_COMPLETED`,
            JSON.stringify(payload, null, 2)
        );
    });

    socket.on("WINNER_CLAIMED", (payload) => {
        console.log(
            `[${name}] WINNER_CLAIMED`,
            JSON.stringify(payload, null, 2)
        );
    });

    socket.on("GAME_COMPLETED", (payload) => {
        console.log(
            `[${name}] GAME_COMPLETED`,
            JSON.stringify(payload, null, 2)
        );
    });

    socket.on("GAME_ERROR", (payload) => {
        console.log(
            `[${name}] GAME_ERROR`,
            JSON.stringify(payload, null, 2)
        );
    });

    socket.on("connect_error", (error) => {
        console.log(
            `[${name}] CONNECT ERROR:`,
            error.message
        );
    });

    socket.on("disconnect", (reason) => {
        console.log(
            `[${name}] disconnected:`,
            reason
        );
    });

    return socket;
}


createClient(
    "PLAYER 1",
    PLAYER_1_TOKEN
);

createClient(
    "PLAYER 2",
    PLAYER_2_TOKEN
);