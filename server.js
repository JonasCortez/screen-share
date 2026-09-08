const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

app.get("/turn-credentials", async (req, res) => {
    try {
        const response = await fetch(
            `https://rtc.live.cloudflare.com/v1/turn/keys/${process.env.CLOUDFLARE_TURN_TOKEN_ID}/credentials/generate-ice-servers`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    ttl: 86400
                })
            }
        );

        if (!response.ok) {
            const error = await response.text();
            console.error("Erro Cloudflare TURN:", error);
            return res.status(500).json({
                error: "Não foi possível gerar credenciais TURN."
            });
        }

        const data = await response.json();

        res.json(data);

    } catch (error) {
        console.error("Erro ao obter TURN:", error);

        res.status(500).json({
            error: "Erro interno ao obter TURN."
        });
    }
});

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