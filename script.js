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
let connectionAttemptTime = null;

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("join-btn").addEventListener("click", joinCall);
    document.getElementById("leave-btn").addEventListener("click", leaveCall);
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

async function cleanupResources() {
    if (localTracks) {
        for (let track of localTracks) {
            track.stop();
            track.close();
        }
        localTracks = [];
    }
    if (client) {
        await client.leave();
    }
    remoteUsers = {};
    updateUserCount();
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

        // Enregistrer le moment de la tentative de connexion
        connectionAttemptTime = Date.now();

        // Création du client
        client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        console.log("Client Agora créé avec succès");

        // Configuration des événements
        setupEventHandlers();

        // Connexion au canal
        console.log("Tentative de connexion au canal:", config.channel);
        await client.join(config.appId, config.channel, config.token, config.uid);
        console.log("Connexion au canal réussie");

        // Initialiser les tracks immédiatement
        await initializeTracks();

    } catch (error) {
        console.error("Erreur lors de la connexion:", error);
        alert("Erreur lors de la connexion: " + error.message);
        document.getElementById("join-btn").disabled = false;
        await cleanupResources();
    }
}

function setupEventHandlers() {
    client.on("user-published", handleUserPublished);
    client.on("user-unpublished", handleUserUnpublished);
    client.on("user-left", handleUserLeft);
    client.on("user-joined", handleUserJoined);
    client.on("connection-state-change", (curState, prevState) => {
        console.log("État de la connexion:", prevState, "->", curState);
        if (curState === "CONNECTED") {
            // Attendre un court délai pour voir si d'autres utilisateurs sont déjà connectés
            setTimeout(() => {
                if (Object.keys(remoteUsers).length === 0) {
                    // Si aucun autre utilisateur n'est connecté, on est le premier
                    isModerator = true;
                    document.getElementById('moderator-controls').style.display = 'flex';
                    console.log("Premier utilisateur - devenu modérateur");
                } else {
                    // Si d'autres utilisateurs sont déjà connectés, on est un participant
                    isModerator = false;
                    document.getElementById('moderator-controls').style.display = 'none';
                    console.log("Utilisateur est participant");
                }
            }, 1000); // Attendre 1 seconde pour voir si d'autres utilisateurs se connectent
        }
    });
}

async function initializeTracks() {
    try {
        console.log("Création des tracks audio et vidéo...");
        localTracks = await AgoraRTC.createMicrophoneAndCameraTracks();
        console.log("Tracks créées avec succès");

        if (!localTracks || localTracks.length < 2) {
            throw new Error("Erreur lors de la création des tracks");
        }

        localTracks[1].play("local-video");
        await client.publish(localTracks);
        console.log("Tracks publiées avec succès");

        updateUI();
        updateIndicators();
        updateUserCount();
    } catch (error) {
        console.error("Erreur lors de l'initialisation des tracks:", error);
        throw error;
    }
}

function updateUI() {
    document.querySelector('.control-buttons').style.display = 'flex';
    document.querySelector('#status-indicators').style.display = 'inline-block';
    document.querySelector('.input-group').style.display = 'none';
    document.querySelector('#join-btn').style.display = 'none';
    document.querySelector('footer').style.display = 'none';
    document.getElementById("leave-btn").disabled = false;

    // Ajouter l'indicateur de rôle
    const roleIndicator = document.createElement('div');
    roleIndicator.id = 'role-indicator';
    roleIndicator.className = 'role-indicator';
    roleIndicator.textContent = isModerator ? '👑 Modérateur' : '👤 Participant';
    document.querySelector('.control-buttons').prepend(roleIndicator);
}

async function handleUserJoined(user) {
    console.log("Nouvel utilisateur rejoint:", user.uid);
}

async function handleUserPublished(user, mediaType) {
    try {
        remoteUsers[user.uid] = user;
        await client.subscribe(user, mediaType);

        if (mediaType === "video") {
            addVideoStream(user);
            user.videoTrack.play(`user-${user.uid}`);
            user.remoteVideoTrack = user.videoTrack;
        }

        if (mediaType === "audio") {
            user.audioTrack.play();
            user.remoteAudioTrack = user.audioTrack;
        }

        // Si on est modérateur, ajouter les contrôles pour le nouvel utilisateur
        if (isModerator) {
            addModeratorControl(user.uid);
        }

        updateUserCount();
    } catch (error) {
        console.error("Erreur lors de la publication de l'utilisateur:", error);
    }
}

function handleUserUnpublished(user) {
    const el = document.getElementById(`user-${user.uid}`);
    if (el) el.remove();
    delete remoteUsers[user.uid];
    updateUserCount();
}

async function handleUserLeft(user) {
    console.log("Utilisateur parti:", user.uid);

    // Supprimer les contrôles du modérateur
    const userControlDiv = document.getElementById(`user-control-${user.uid}`);
    if (userControlDiv) {
        userControlDiv.remove();
    }

    const el = document.getElementById(`user-${user.uid}`);
    if (el) el.remove();
    delete remoteUsers[user.uid];
    updateUserCount();
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

function addModeratorControl(uid) {
    if (!isModerator) return;

    const moderatorControls = document.getElementById('moderator-controls');
    const userControlDiv = document.createElement('div');
    userControlDiv.id = `user-control-${uid}`;
    userControlDiv.className = 'user-control';

    userControlDiv.innerHTML = `
        <div class="user-info">
            <span>Utilisateur ${uid}</span>
            <div class="user-controls">
                <button onclick="toggleRemoteUserMic(${uid})" class="control-btn" id="mic-control-${uid}">
                    <i class="fas fa-microphone"></i> Micro
                </button>
                <button onclick="toggleRemoteUserCamera(${uid})" class="control-btn" id="cam-control-${uid}">
                    <i class="fas fa-video"></i> Caméra
                </button>
                <button onclick="kickUser(${uid})" class="kick-btn">
                    <i class="fas fa-user-slash"></i> Expulser
                </button>
            </div>
        </div>
    `;
    moderatorControls.appendChild(userControlDiv);
}

async function toggleRemoteUserMic(uid) {
    if (!isModerator) return;
    const user = remoteUsers[uid];
    if (user && user.remoteAudioTrack) {
        try {
            if (user.remoteAudioTrack.isPlaying) {
                await user.remoteAudioTrack.stop();
                document.getElementById(`mic-control-${uid}`).innerHTML = '<i class="fas fa-microphone-slash"></i> Micro';
            } else {
                await user.remoteAudioTrack.play();
                document.getElementById(`mic-control-${uid}`).innerHTML = '<i class="fas fa-microphone"></i> Micro';
            }
            console.log(`Micro ${user.remoteAudioTrack.isPlaying ? 'activé' : 'désactivé'} pour l'utilisateur ${uid}`);
        } catch (error) {
            console.error('Erreur lors de la tentative de basculer le micro:', error);
        }
    }
}

async function toggleRemoteUserCamera(uid) {
    if (!isModerator) return;
    const user = remoteUsers[uid];
    if (user && user.remoteVideoTrack) {
        try {
            if (user.remoteVideoTrack.isPlaying) {
                await user.remoteVideoTrack.stop();
                document.getElementById(`cam-control-${uid}`).innerHTML = '<i class="fas fa-video-slash"></i> Caméra';
            } else {
                await user.remoteVideoTrack.play(`user-${uid}`);
                document.getElementById(`cam-control-${uid}`).innerHTML = '<i class="fas fa-video"></i> Caméra';
            }
            console.log(`Caméra ${user.remoteVideoTrack.isPlaying ? 'activée' : 'désactivée'} pour l'utilisateur ${uid}`);
        } catch (error) {
            console.error('Erreur lors de la tentative de basculer la caméra:', error);
        }
    }
}

async function kickUser(uid) {
    if (!isModerator) return;
    const user = remoteUsers[uid];
    if (user) {
        try {
            // Désabonner de tous les tracks
            if (user.audioTrack) {
                await client.unsubscribe(user, 'audio');
            }
            if (user.videoTrack) {
                await client.unsubscribe(user, 'video');
            }

            // Supprimer les contrôles
            const userControlDiv = document.getElementById(`user-control-${uid}`);
            if (userControlDiv) {
                userControlDiv.remove();
            }

            // Supprimer la vidéo
            const videoDiv = document.getElementById(`user-${uid}`);
            if (videoDiv) {
                videoDiv.remove();
            }

            // Supprimer de la liste des utilisateurs
            delete remoteUsers[uid];
            updateUserCount();

            console.log(`Utilisateur ${uid} expulsé`);
        } catch (error) {
            console.error('Erreur lors de la tentative d\'expulsion:', error);
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