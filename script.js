// Configuration de base
const config = {
    appId: "2071d93215924d1c81e1bca9b4d594c0",
    channel: "",
    token: null,
    uid: Math.floor(Math.random() * 100000),
};

let client;
let localTracks = [];
let remoteUsers = {};
let isModerator = false;
let firstUserJoined = false;
let pendingUsers = new Set(); // Pour stocker les utilisateurs en attente

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("join-btn").addEventListener("click", joinCall);
    document.getElementById("leave-btn").addEventListener("click", leaveCall);

    // Boutons micro / caméra
    document.getElementById('toggleMic').addEventListener('click', toggleMic);
    document.getElementById('toggleCamera').addEventListener('click', toggleCamera);
});

// Fonction pour vérifier les permissions de la caméra
async function checkCameraPermissions() {
    try {
        const devices = await AgoraRTC.getMicrophones();
        const cameras = await AgoraRTC.getCameras();
        console.log("Microphones disponibles:", devices);
        console.log("Caméras disponibles:", cameras);

        if (cameras.length === 0) {
            alert("Aucune caméra détectée. Veuillez vérifier votre connexion ou vos permissions.");
            return false;
        }
        return true;
    } catch (error) {
        console.error("Erreur lors de la vérification des périphériques:", error);
        alert("Erreur lors de l'accès à la caméra. Veuillez vérifier vos permissions.");
        return false;
    }
}

async function joinCall() {
    try {
        if (typeof AgoraRTC === 'undefined') {
            throw new Error("AgoraRTC n'est pas chargé. Vérifiez votre connexion internet.");
        }

        config.channel = document.getElementById("channel-name").value.trim();
        if (!config.channel) {
            alert("Veuillez entrer un nom de canal");
            return;
        }

        const hasPermissions = await checkCameraPermissions();
        if (!hasPermissions) {
            document.getElementById("join-btn").disabled = false;
            return;
        }

        document.getElementById("join-btn").disabled = true;

        try {
            client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        } catch (error) {
            throw new Error("Erreur lors de la création du client: " + error.message);
        }

        client.on("user-published", handleUserPublished);
        client.on("user-unpublished", handleUserUnpublished);
        client.on("user-left", handleUserLeft);
        client.on("user-joined", handleUserJoined);
        client.on("message", handleMessage);
        client.on("connection-state-change", (curState, prevState) => {
            console.log("État de la connexion:", prevState, "->", curState);
        });

        console.log("Tentative de connexion au canal:", config.channel);
        try {
            await client.join(config.appId, config.channel, config.token, config.uid);
            console.log("Connexion au canal réussie");
        } catch (error) {
            throw new Error("Erreur lors de la connexion au canal: " + error.message);
        }

        try {
            const channelInfo = await client.getChannelInfo();
            isModerator = channelInfo.userCount === 0;
            console.log("Est modérateur:", isModerator);

            if (!isModerator) {
                // Envoyer une demande de permission au modérateur
                await client.sendUserMessage(0, JSON.stringify({
                    type: 'permission_request',
                    uid: config.uid
                }));

                // Afficher un message d'attente
                document.getElementById("status-indicators").innerHTML =
                    '<div class="waiting-message">En attente de l\'approbation du modérateur...</div>';
                return;
            }
        } catch (error) {
            console.warn("Impossible de récupérer les informations du canal:", error);
            isModerator = false;
        }

        // Continuer avec la création des tracks seulement si modérateur ou approuvé
        try {
            console.log("Création des tracks audio et vidéo...");
            localTracks = await AgoraRTC.createMicrophoneAndCameraTracks();
            console.log("Tracks créées avec succès:", localTracks);

            if (!localTracks || localTracks.length < 2) {
                throw new Error("Erreur lors de la création des tracks");
            }

            localTracks[1].play("local-video");
            await client.publish(localTracks);
            console.log("Tracks publiées avec succès");

            document.querySelector('.control-buttons').style.display = 'flex';
            document.querySelector('#status-indicators').style.display = 'inline-block';
            document.querySelector('.input-group').style.display = 'none';
            document.querySelector('#join-btn').style.display = 'none';
            document.querySelector('footer').style.display = 'none';
            document.getElementById("leave-btn").disabled = false;

            if (isModerator) {
                document.getElementById('moderator-controls').style.display = 'flex';
            }

            updateIndicators();
            updateUserCount();
        } catch (error) {
            throw new Error("Erreur lors de la création ou publication des tracks: " + error.message);
        }
    } catch (error) {
        console.error("Erreur détaillée:", error);
        alert("Erreur lors de la connexion: " + error.message);
        document.getElementById("join-btn").disabled = false;

        if (client) {
            try {
                await client.leave();
            } catch (e) {
                console.error("Erreur lors du nettoyage:", e);
            }
        }
        if (localTracks) {
            localTracks.forEach(track => {
                try {
                    track.stop();
                    track.close();
                } catch (e) {
                    console.error("Erreur lors de la fermeture des tracks:", e);
                }
            });
        }
    }
}

async function leaveCall() {
    for (let track of localTracks) {
        track.stop();
        track.close();
    }

    await client.leave();

    document.getElementById("join-btn").disabled = false;
    document.getElementById("leave-btn").disabled = true;

    // Nettoie les vidéos distantes
    Object.keys(remoteUsers).forEach(uid => {
        const el = document.getElementById(`user-${uid}`);
        if (el) el.remove();
    });

    remoteUsers = {};
    updateUserCount();

    // Réinitialise les indicateurs
    document.querySelector('.control-buttons').style.display = 'none';
    document.getElementById("mic-status").textContent = "🎤 Muet";
    document.getElementById("cam-status").textContent = "📷 Caméra coupée";
    document.getElementById("mic-status").classList.add("muted");
    document.getElementById("cam-status").classList.add("muted");
    setTimeout(function() {
        location.reload();
    }, 2000);

}

async function handleUserPublished(user, mediaType) {
    remoteUsers[user.uid] = user;
    await client.subscribe(user, mediaType);

    if (mediaType === "video") {
        addVideoStream(user);
        user.videoTrack.play(`user-${user.uid}`);
    }

    if (mediaType === "audio") {
        user.audioTrack.play();
    }

    client.on("message", async(message) => {
        if (message.uid === user.uid) {
            try {
                const data = JSON.parse(message.message);
                if (data.type === 'toggleMic' && data.action === 'mute') {
                    await localTracks[0].setMuted(true);
                    updateIndicators();
                }
            } catch (error) {
                console.error('Erreur lors du traitement du message:', error);
            }
        }
    });

    updateUserCount();
}

function handleUserUnpublished(user) {
    const el = document.getElementById(`user-${user.uid}`);
    if (el) el.remove();
    delete remoteUsers[user.uid];
    updateUserCount();
}

function handleUserLeft(user) {
    const el = document.getElementById(`user-${user.uid}`);
    if (el) el.remove();
    delete remoteUsers[user.uid];
    updateUserCount();
}

function handleUserJoined(user) {
    if (isModerator) {
        addModeratorControl(user.uid);
    }
}

function handleMessage(message) {
    try {
        const data = JSON.parse(message.message);
        console.log("Message reçu:", data);

        if (data.type === 'permission_request') {
            if (isModerator) {
                addPendingUserControl(data.uid);
            }
        } else if (data.type === 'permission_response') {
            if (data.approved) {
                // L'utilisateur a été approuvé, continuer avec la connexion
                initializeUserConnection();
            } else {
                // L'utilisateur a été rejeté
                alert("Votre demande d'accès a été rejetée par le modérateur.");
                leaveCall();
            }
        } else if (data.type === 'moderator') {
            if (data.action === 'muteMic') {
                if (localTracks[0]) {
                    localTracks[0].setMuted(true);
                    updateIndicators();
                }
            } else if (data.action === 'muteCamera') {
                if (localTracks[1]) {
                    localTracks[1].setMuted(true);
                    updateIndicators();
                }
            }
        }
    } catch (error) {
        console.error("Erreur lors du traitement du message:", error);
    }
}

function addModeratorControl(uid) {
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'moderator-control';
    controlsDiv.innerHTML = `
        <div class="moderator-user-controls">
            <button onclick="toggleRemoteUserMic(${uid})" class="moderator-btn">
                <i class="fas fa-microphone-slash"></i> Couper Micro
            </button>
            <button onclick="toggleRemoteUserCamera(${uid})" class="moderator-btn">
                <i class="fas fa-video-slash"></i> Couper Caméra
            </button>
        </div>
    `;
    document.getElementById('moderator-controls').appendChild(controlsDiv);
}

async function toggleRemoteUserMic(uid) {
    if (!isModerator) return;

    try {
        await client.sendUserMessage(uid, JSON.stringify({
            type: 'moderator',
            action: 'muteMic'
        }));
        console.log(`Micro coupé pour l'utilisateur ${uid}`);
    } catch (error) {
        console.error('Erreur lors de la tentative de couper le micro:', error);
    }
}

async function toggleRemoteUserCamera(uid) {
    if (!isModerator) return;

    try {
        await client.sendUserMessage(uid, JSON.stringify({
            type: 'moderator',
            action: 'muteCamera'
        }));
        console.log(`Caméra coupée pour l'utilisateur ${uid}`);
    } catch (error) {
        console.error('Erreur lors de la tentative de couper la caméra:', error);
    }
}

// Fonction pour créer la vidéo distante
function addVideoStream(user) {
    const videoContainer = document.createElement("div");
    videoContainer.classList.add("video-placeholder");
    videoContainer.id = `user-${user.uid}`;

    const username = document.createElement("div");
    username.classList.add("user-name");
    username.textContent = `Utilisateur ${user.uid}`;

    videoContainer.appendChild(username);
    document.getElementById("video-container").appendChild(videoContainer);
}

// 🔄 Met à jour les indicateurs de statut
function updateIndicators() {
    const micStatus = document.getElementById("mic-status");
    const camStatus = document.getElementById("cam-status");

    if (localTracks[0].muted) {
        micStatus.textContent = "🎤 Muet";
        micStatus.classList.add("muted");
    } else {
        micStatus.textContent = "🎤 Actif";
        micStatus.classList.remove("muted");
    }

    if (localTracks[1].muted) {
        camStatus.textContent = "📷 Caméra coupée";
        camStatus.classList.add("muted");
    } else {
        camStatus.textContent = "📷 Caméra active";
        camStatus.classList.remove("muted");
    }
}

// 🔢 Met à jour le nombre d'utilisateurs connectés
function updateUserCount() {
    const count = Object.keys(remoteUsers).length + (client ? 1 : 0);
    document.getElementById("user-count").textContent = `👥 ${count} utilisateur(s) connecté(s)`;
}

// 🎤 Toggle micro
async function toggleMic() {
    if (!localTracks[0]) return;
    if (localTracks[0].muted) {
        await localTracks[0].setMuted(false);
        document.getElementById('toggleMic').innerHTML = '<i class="fas fa-microphone"></i>';
    } else {
        await localTracks[0].setMuted(true);
        document.getElementById('toggleMic').innerHTML = '<i class="fas fa-microphone-slash"></i>';
    }
    updateIndicators();
}

// 🎥 Toggle caméra
async function toggleCamera() {
    if (!localTracks[1]) return;
    if (localTracks[1].muted) {
        await localTracks[1].setMuted(false);
        document.getElementById('toggleCamera').innerHTML = '<i class="fas fa-video"></i>';
    } else {
        await localTracks[1].setMuted(true);
        document.getElementById('toggleCamera').innerHTML = '<i class="fas fa-video-slash"></i>';
    }
    updateIndicators();
}

// Fonction pour ajouter un contrôle pour un utilisateur en attente
function addPendingUserControl(uid) {
    const moderatorControls = document.getElementById('moderator-controls');
    const pendingUserDiv = document.createElement('div');
    pendingUserDiv.id = `pending-user-${uid}`;
    pendingUserDiv.className = 'pending-user-control';
    pendingUserDiv.innerHTML = `
        <span>Utilisateur ${uid} demande l'accès</span>
        <button onclick="approveUser(${uid})" class="approve-btn">
            <i class="fas fa-check"></i> Approuver
        </button>
        <button onclick="rejectUser(${uid})" class="reject-btn">
            <i class="fas fa-times"></i> Rejeter
        </button>
    `;
    moderatorControls.appendChild(pendingUserDiv);
}

// Fonction pour approuver un utilisateur
async function approveUser(uid) {
    try {
        await client.sendUserMessage(uid, JSON.stringify({
            type: 'permission_response',
            approved: true
        }));
        removePendingUserControl(uid);
    } catch (error) {
        console.error("Erreur lors de l'approbation:", error);
    }
}

// Fonction pour rejeter un utilisateur
async function rejectUser(uid) {
    try {
        await client.sendUserMessage(uid, JSON.stringify({
            type: 'permission_response',
            approved: false
        }));
        removePendingUserControl(uid);
    } catch (error) {
        console.error("Erreur lors du rejet:", error);
    }
}

// Fonction pour supprimer le contrôle d'un utilisateur en attente
function removePendingUserControl(uid) {
    const pendingUserDiv = document.getElementById(`pending-user-${uid}`);
    if (pendingUserDiv) {
        pendingUserDiv.remove();
    }
}

// Fonction pour initialiser la connexion d'un utilisateur approuvé
async function initializeUserConnection() {
    try {
        console.log("Création des tracks audio et vidéo...");
        localTracks = await AgoraRTC.createMicrophoneAndCameraTracks();
        console.log("Tracks créées avec succès:", localTracks);

        if (!localTracks || localTracks.length < 2) {
            throw new Error("Erreur lors de la création des tracks");
        }

        localTracks[1].play("local-video");
        await client.publish(localTracks);
        console.log("Tracks publiées avec succès");

        document.querySelector('.control-buttons').style.display = 'flex';
        document.querySelector('#status-indicators').style.display = 'inline-block';
        document.querySelector('.input-group').style.display = 'none';
        document.querySelector('#join-btn').style.display = 'none';
        document.querySelector('footer').style.display = 'none';
        document.getElementById("leave-btn").disabled = false;

        updateIndicators();
        updateUserCount();
    } catch (error) {
        console.error("Erreur lors de l'initialisation:", error);
        alert("Erreur lors de la connexion: " + error.message);
        leaveCall();
    }
}