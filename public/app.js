const socket = io();

const roomInput = document.getElementById("roomInput");
const joinButton = document.getElementById("joinButton");
const shareButton = document.getElementById("shareButton");
const resolutionSelect = document.getElementById("resolutionSelect");
const fpsSelect = document.getElementById("fpsSelect");
const fullscreenButton = document.getElementById("fullscreenButton");

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const status = document.getElementById("status");

let roomId = null;
let localStream = null;
let peerConnection = null;
let remoteSocketId = null;

let configuration = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        }
    ]
};

async function loadTurnCredentials() {
    try {
        const response = await fetch("/turn-credentials");

        if (!response.ok) {
            throw new Error("Não foi possível obter as credenciais TURN.");
        }

        const data = await response.json();

        configuration.iceServers = data.iceServers;

        console.log("TURN carregado:", configuration.iceServers);

    } catch (error) {
        console.error("Erro ao carregar TURN:", error);
    }
}
// entrar na salinha de compartilhamento de telas

joinButton.addEventListener("click", async () => {
    roomId = roomInput.value.trim();

    if(!roomId) {
        alert("digite o nome da sala fazendo favor");
        return;
    }

    await loadTurnCredentials();

    socket.emit("join-room", roomId);

    status.textContent = `sala: ${roomId}`;

    joinButton.disabled = true;
    roomInput.disabled = true;

    console.log(`entrou na sala ${roomId}`);
});

// compartilhar a tela

shareButton.addEventListener("click", async () => {
    try {

        const [width, height] = resolutionSelect.value
            .split("x")
            .map(Number);
        const fps = Number(fpsSelect.value);

        localStream = await navigator.mediaDevices.getDisplayMedia({ 
            video: {
                width: {
                    ideal: width
                },
                height: {
                    ideal: height
                },
                frameRate: {
                    ideal: fps,
                    max: fps
                }
            },
            audio: false
         });

        localVideo.srcObject = localStream;

        status.textContent =
            `Transmitindo a tela em ${width}x${height} a ${fps}fps`;

        const videoTrack = localStream.getVideoTracks()[0];

        console.log("configuração real da captura:",
            videoTrack.getSettings()
        );

        videoTrack.addEventListener("ended", () => {
            status.textContent = "parou de compartilhar a tela";
        });

        if (remoteSocketId) {
            createOffer();
        }

    } catch (error) {
        console.error("erro ao compartilhar a tela:", error);
    }
});

socket.on("user-joined", (socketId) => {
    console.log(`usuario ${socketId} entrou na sala`);
    remoteSocketId = socketId;

    status.textContent = "usuario entrou na sala";

    if(localStream) {
        createOffer();
    }
});

socket.on("room-users", (users) => {
    console.log("usuarios na sala:", users);

    if (users.length > 0) {
        remoteSocketId = users[0];

        status.textContent = "usuario já estava na sala";

        if(localStream) {
            createOffer();
        }
    }
});

function createPeerConnection() {
    peerConnection = new RTCPeerConnection(configuration);

    if(localStream) {
        localStream.getTracks().forEach((track) => {

            peerConnection.addTrack(
                track,
                localStream
            );
        });

    }

    peerConnection.ontrack = (event) => {
        console.log("recebendo stream remota");
        remoteVideo.srcObject = event.streams[0];
        status.textContent = "recebendo stream remota";
    };
    

    peerConnection.onicecandidate = (event) => {
        if(event.candidate && remoteSocketId) {
            socket.emit("ice-candidate", {
                target: remoteSocketId,
                candidate: event.candidate
            });
        }
    };

    peerConnection.onconnectionstatechange = () => {

        console.log(
            "estado WebRTC:",
            peerConnection.connectionState
        );
    };
}

async function createOffer() {
    if (!peerConnection) {
        createPeerConnection();
    }

    const offer = await peerConnection.createOffer();

    await peerConnection.setLocalDescription(offer);

    socket.emit("offer", {
        target: remoteSocketId,
        offer: offer
    });

    console.log("offer enviada");
}

socket.on("offer", async ({ sender, offer }) => {
    remoteSocketId = sender;

    if (!peerConnection) {
        createPeerConnection();
    }   

    await peerConnection.setRemoteDescription(
        new RTCSessionDescription(offer)
    );

    const answer = await peerConnection.createAnswer();

    await peerConnection.setLocalDescription(answer);

    socket.emit("answer", {
        target: sender,
        answer: answer
    });

    console.log("answer enviada");
});

socket.on("answer", async ({ sender, answer }) => {

    console.log("answer recebida");

    await peerConnection.setRemoteDescription(
        new RTCSessionDescription(answer)
    );
});

socket.on("ice-candidate", async ({ sender, candidate }) => {
    if (!peerConnection) {
        return;
    }

    try {
        await peerConnection.addIceCandidate(
            new RTCIceCandidate(candidate)
        );
    } catch (error) {
        console.error("erro ao adicionar candidato ICE:", error);
    }
});

fullscreenButton.addEventListener("click", async () => {
    try {
        if(!document.fullscreenElement) {
            await remoteVideo.requestFullscreen();
        } else {
            await document.exitFullscreen();
        }
    } catch (error) {
        console.error("erro ao alternar para tela cheia:", error);
    }

});