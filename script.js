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
const CONNECTION_TIMEOUT = 10000; // 10 secondes de timeout

document.addEventListener("DOMContentLoaded", () => {
    const joinBtn = document.getElementById("join-btn");
    const leaveBtn = document.getElementById("leave-btn");
    const leaveConferenceBtn = document.getElementById("leave-conference");
    const toggleMicBtn = document.getElementById('toggleMic');
    const toggleCameraBtn = document.getElementById('toggleCamera');

    if (joinBtn) joinBtn.addEventListener("click", joinCall);
    if (leaveBtn) leaveBtn.addEventListener("click", leaveCall);
    if (leaveConferenceBtn) leaveConferenceBtn.addEventListener("click", leaveCall);
    if (toggleMicBtn) toggleMicBtn.addEventListener('click', toggleMic);
    if (toggleCameraBtn) toggleCameraBtn.addEventListener('click', toggleCamera);
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
    try {
        onLeavePresence();
        if (localTracks) {
            for (let track of localTracks) {
                if (track) {
                    track.stop();
                    track.close();
                }
            }
            localTracks = [];
        }
        if (client) {
            await client.leave();
            client = null;
        }
        remoteUsers = {};
        isModerator = false;
        updateUserCount();
    } catch (error) {
        console.error("Erreur lors du nettoyage des ressources:", error);
    }
}

// --- Gestion de la présence utilisateur via get_users.php ---

function signalPresence(action) {
    fetch('get_users.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            uid: config.uid,
            username: window.currentUsername || 'Utilisateur ' + config.uid,
            action: action
        })
    });
}

function onJoinPresence() {
    signalPresence('join');
}

function onLeavePresence() {
    signalPresence('leave');
}

window.addEventListener('beforeunload', onLeavePresence);

// Fonction pour afficher tous les containers utilisateurs (même sans flux)
function updateUserGrid(users) {
    const container = document.getElementById('video-container');
    if (!container) return;

    // Toujours s'assurer que le local est là
    let localDiv = document.getElementById('local-video');
    if (!localDiv) {
        localDiv = document.createElement('div');
        localDiv.id = 'local-video';
        localDiv.className = 'video-placeholder';
        let name = document.createElement('div');
        name.className = 'user-name';
        name.textContent = 'Vous';
        localDiv.appendChild(name);
        container.appendChild(localDiv);
    } else if (!localDiv.querySelector('.user-name')) {
        let name = document.createElement('div');
        name.className = 'user-name';
        name.textContent = 'Vous';
        localDiv.appendChild(name);
    }

    // Ajoute les containers manquants pour chaque utilisateur distant
    users.forEach(user => {
        if (user.uid == config.uid) return; // On a déjà ajouté le local
        let div = document.getElementById(`user-${user.uid}`);
        if (!div) {
            div = document.createElement('div');
            div.className = 'video-placeholder';
            div.id = `user-${user.uid}`;
            let name = document.createElement('div');
            name.className = 'user-name';
            name.textContent = user.username || `Utilisateur ${user.uid}`;
            div.appendChild(name);
            container.appendChild(div);
        } else {
            // Met à jour le nom si besoin
            let name = div.querySelector('.user-name');
            if (!name) {
                name = document.createElement('div');
                name.className = 'user-name';
                name.textContent = user.username || `Utilisateur ${user.uid}`;
                div.appendChild(name);
            }
        }
    });
}

function updatePresenceCount(users) {
    document.getElementById("user-count").textContent = `👥 ${users.length} utilisateur(s) connecté(s)`;
}

setInterval(async() => {
    const res = await fetch('get_users.php');
    const users = await res.json();
    updateUserGrid(users);
    updatePresenceCount(users);
}, 2000);

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

        // Ajout d'un timeout pour la connexion
        const connectionPromise = client.join(config.appId, config.channel, config.token, config.uid);
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Timeout de connexion")), CONNECTION_TIMEOUT);
        });

        await Promise.race([connectionPromise, timeoutPromise]);
        console.log("Connexion au canal réussie");

        // Initialiser les tracks immédiatement
        await initializeTracks();

        // Signale la présence après la connexion
        onJoinPresence();

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
            setTimeout(() => {
                if (Object.keys(remoteUsers).length === 0) {
                    isModerator = true;
                    document.getElementById('moderator-controls').style.display = 'flex';
                    console.log("Premier utilisateur - devenu modérateur");
                } else {
                    isModerator = false;
                    document.getElementById('moderator-controls').style.display = 'none';
                    console.log("Utilisateur est participant");
                    // Ne plus appeler muteLocalTracks ici
                }
            }, 1000);
        }
    });
}

async function initializeTracks() {
    try {
        console.log("Création des tracks audio et vidéo...");

        // Vérifier si le client existe
        if (!client) {
            throw new Error("Client Agora non initialisé");
        }

        // Vérifier si les éléments DOM existent
        const localVideoElement = document.getElementById("local-video");
        if (!localVideoElement) {
            throw new Error("Élément local-video non trouvé");
        }

        // Créer les tracks avec gestion d'erreur
        try {
            localTracks = await AgoraRTC.createMicrophoneAndCameraTracks({
                encoderConfig: {
                    width: 640,
                    height: 480,
                    frameRate: 30,
                    bitrateMin: 600,
                    bitrateMax: 2000
                }
            });
        } catch (trackError) {
            console.error("Erreur lors de la création des tracks:", trackError);
            throw new Error("Impossible d'accéder à la caméra ou au microphone");
        }

        if (!localTracks || localTracks.length < 2) {
            throw new Error("Erreur lors de la création des tracks");
        }

        // Jouer la vidéo locale
        try {
            await localTracks[1].play("local-video");
        } catch (playError) {
            console.error("Erreur lors de la lecture de la vidéo locale:", playError);
            throw new Error("Impossible de lire la vidéo locale");
        }

        // Publier les tracks
        try {
            await client.publish(localTracks);
            console.log("Tracks publiées avec succès");
            // Si participant, mute micro et caméra après publication
            if (!isModerator) {
                await muteLocalTracks();
            }
        } catch (publishError) {
            console.error("Erreur lors de la publication des tracks:", publishError);
            throw new Error("Impossible de publier les tracks");
        }

        updateUI();
        updateIndicators();
        updateUserCount();
    } catch (error) {
        console.error("Erreur lors de l'initialisation des tracks:", error);
        await cleanupResources();
        throw error;
    }
}

function updateUI() {
    try {
        const elements = {
            controlButtons: document.querySelector('.control-buttons'),
            statusIndicators: document.querySelector('#status-indicators'),
            inputGroup: document.querySelector('.input-group'),
            joinBtn: document.querySelector('#join-btn'),
            leaveBtn: document.getElementById("leave-btn"),
            leaveConferenceBtn: document.getElementById("leave-conference"),
            footer: document.querySelector('footer')
        };

        // Mise à jour sécurisée des éléments
        if (elements.controlButtons) {
            elements.controlButtons.style.display = 'flex';

            // Ajouter l'indicateur de rôle seulement si controlButtons existe
            const existingRoleIndicator = document.getElementById('role-indicator');
            if (!existingRoleIndicator) {
                const roleIndicator = document.createElement('div');
                roleIndicator.id = 'role-indicator';
                roleIndicator.className = 'role-indicator';
                roleIndicator.textContent = isModerator ? '👑 Modérateur' : '👤 Participant';
                elements.controlButtons.prepend(roleIndicator);
            }
        }

        if (elements.statusIndicators) {
            elements.statusIndicators.style.display = 'inline-block';
        }

        if (elements.inputGroup) {
            elements.inputGroup.style.display = 'none';
        }

        if (elements.joinBtn) {
            elements.joinBtn.style.display = 'none';
        }

        if (elements.footer) {
            elements.footer.style.display = 'none';
        }

        if (elements.leaveBtn) {
            elements.leaveBtn.disabled = false;
        }

        if (elements.leaveConferenceBtn) {
            elements.leaveConferenceBtn.style.display = 'flex';
            elements.leaveConferenceBtn.disabled = false;
        }

        // Log des éléments manquants
        Object.entries(elements).forEach(([key, element]) => {
            if (!element) {
                console.warn(`Élément ${key} non trouvé dans le DOM`);
            }
        });

    } catch (error) {
        console.error("Erreur lors de la mise à jour de l'interface:", error);
    }
}

async function handleUserJoined(user) {
    console.log("Nouvel utilisateur rejoint:", user.uid);
    updateUserCount();
    if (typeof updateModeratorControls === 'function') updateModeratorControls();
}

async function handleUserPublished(user, mediaType) {
    try {
        remoteUsers[user.uid] = user;
        await client.subscribe(user, mediaType);
        console.log(`Utilisateur ${user.uid} publié (${mediaType})`);

        if (mediaType === "video") {
            addVideoStream(user);
            user.videoTrack.play(`user-${user.uid}`);
            user.remoteVideoTrack = user.videoTrack;
        }

        if (mediaType === "audio") {
            user.audioTrack.play();
            user.remoteAudioTrack = user.audioTrack;
        }

        updateUserCount();
        updateModeratorControls();
    } catch (error) {
        console.error("Erreur lors de la publication de l'utilisateur:", error);
    }
}

function handleUserUnpublished(user) {
    const el = document.getElementById(`user-${user.uid}`);
    if (el) el.remove();
    delete remoteUsers[user.uid];
    updateUserCount();
    updateModeratorControls();
    console.log(`Utilisateur ${user.uid} a arrêté de publier.`);
}

async function handleUserLeft(user) {
    console.log("Utilisateur parti:", user.uid);

    const userControlDiv = document.getElementById(`user-control-${user.uid}`);
    if (userControlDiv) {
        userControlDiv.remove();
    }

    const el = document.getElementById(`user-${user.uid}`);
    if (el) el.remove();
    delete remoteUsers[user.uid];
    updateUserCount();
    updateModeratorControls();
    console.log(`Utilisateur ${user.uid} supprimé de la liste.`);
}

// Fonction pour créer la vidéo distante (évite les doublons)
function addVideoStream(user) {
    if (document.getElementById(`user-${user.uid}`)) {
        console.log(`La vidéo de l'utilisateur ${user.uid} existe déjà, on ne la rajoute pas.`);
        return;
    }
    const videoContainer = document.createElement("div");
    videoContainer.classList.add("video-placeholder");
    videoContainer.id = `user-${user.uid}`;

    const username = document.createElement("div");
    username.classList.add("user-name");
    username.textContent = `Utilisateur ${user.uid}`;

    videoContainer.appendChild(username);
    document.getElementById("video-container").appendChild(videoContainer);
    console.log(`Ajout de la vidéo pour l'utilisateur ${user.uid}`);
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
    // Toujours compter le local + tous les remoteUsers uniques
    const count = 1 + Object.keys(remoteUsers).length;
    document.getElementById("user-count").textContent = `👥 ${count} utilisateur(s) connecté(s)`;
    console.log(`Mise à jour du compteur : ${count} utilisateur(s)`);
}

// 🔄 Met à jour les contrôles du modérateur pour refléter la liste réelle des utilisateurs
function updateModeratorControls() {
    if (!isModerator) return;
    const moderatorControls = document.getElementById('moderator-controls');
    if (!moderatorControls) return;
    // Nettoyer tous les anciens contrôles
    moderatorControls.innerHTML = '';
    // Ajouter un contrôle pour chaque utilisateur distant
    Object.keys(remoteUsers).forEach(uid => {
        addModeratorControl(uid);
    });
}

// Désactive le micro et la caméra locaux
async function muteLocalTracks() {
    if (localTracks[0] && !localTracks[0].muted) {
        await localTracks[0].setMuted(true);
        document.getElementById('toggleMic').innerHTML = '<i class="fas fa-microphone-slash"></i>';
    }
    if (localTracks[1] && !localTracks[1].muted) {
        await localTracks[1].setMuted(true);
        document.getElementById('toggleCamera').innerHTML = '<i class="fas fa-video-slash"></i>';
    }
    updateIndicators();
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
    try {
        await cleanupResources();

        const elements = {
            joinBtn: document.getElementById("join-btn"),
            leaveBtn: document.getElementById("leave-btn"),
            leaveConferenceBtn: document.getElementById("leave-conference"),
            controlButtons: document.querySelector('.control-buttons'),
            statusIndicators: document.querySelector('#status-indicators'),
            inputGroup: document.querySelector('.input-group'),
            footer: document.querySelector('footer')
        };

        // Réinitialiser les boutons
        if (elements.joinBtn) elements.joinBtn.disabled = false;
        if (elements.leaveBtn) elements.leaveBtn.disabled = true;
        if (elements.leaveConferenceBtn) elements.leaveConferenceBtn.disabled = true;

        // Réinitialiser l'interface
        if (elements.controlButtons) elements.controlButtons.style.display = 'none';
        if (elements.statusIndicators) elements.statusIndicators.style.display = 'none';
        if (elements.inputGroup) elements.inputGroup.style.display = 'flex';
        if (elements.footer) elements.footer.style.display = 'block';

        // Réinitialiser les indicateurs
        const micStatus = document.getElementById("mic-status");
        const camStatus = document.getElementById("cam-status");
        if (micStatus) {
            micStatus.textContent = "🎤 Muet";
            micStatus.classList.add("muted");
        }
        if (camStatus) {
            camStatus.textContent = "📷 Caméra coupée";
            camStatus.classList.add("muted");
        }

        // Supprimer l'indicateur de rôle
        const roleIndicator = document.getElementById('role-indicator');
        if (roleIndicator) {
            roleIndicator.remove();
        }

        // Recharger la page après un court délai
        setTimeout(() => {
            location.reload();
        }, 2000);
    } catch (error) {
        console.error("Erreur lors de la déconnexion:", error);
        location.reload();
    }
}