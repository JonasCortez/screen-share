const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

io.on("connection", (socket) => {

    console.log("Usuário conectado:", socket.id);

    socket.on("join-room", (roomId) => {

        const room = io.sockets.adapter.rooms.get(roomId);
        const users = room ? Array.from(room) : [];

        socket.join(roomId);

        console.log(`${socket.id} entrou na sala ${roomId}`);

        // Envia para quem acabou de entrar
        socket.emit("room-users", users);

        // Avisa quem já estava na sala
        socket.to(roomId).emit("user-joined", socket.id);
    });


    socket.on("offer", ({ target, offer }) => {

        io.to(target).emit("offer", {
            sender: socket.id,
            offer
        });

    });


    socket.on("answer", ({ target, answer }) => {

        io.to(target).emit("answer", {
            sender: socket.id,
            answer
        });

    });


    socket.on("ice-candidate", ({ target, candidate }) => {

        io.to(target).emit("ice-candidate", {
            sender: socket.id,
            candidate
        });

    });


    socket.on("disconnect", () => {

        console.log("Usuário desconectado:", socket.id);

    });

});


server.listen(PORT, "0.0.0.0", () => {

    console.log(`Servidor rodando na porta ${PORT}`);

});