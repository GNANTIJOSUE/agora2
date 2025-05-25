<?php
require_once 'auth.php';

if (!isLoggedIn()) {
    header('Location: login.php');
    exit();
}

$user = getCurrentUser();
$isAdmin = isAdmin();
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VideoConnect - Appel Vidéo Premium</title>
    
    
    
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
</head>
<body>
    <div class="container">
        <header>
            <h1>FIER - VideoConnect</h1>
            <p class="subtitle">Solution d'appel vidéo haute qualité</p>
            <div class="user-info">
                <span>Bienvenue, <?php echo htmlspecialchars($user['username']); ?> 
                    <?php if ($isAdmin): ?>
                        <span class="admin-badge">👑 Admin</span>
                    <?php endif; ?>
                </span>
                <a href="logout.php" class="logout-btn">Déconnexion</a>
            </div>
        </header>

        <div class="input-group">
            <input type="text" id="channel-name" placeholder="<?php echo $isAdmin ? 'Entrez le nom du canal' : 'Entrez le code de la conférence'; ?>" required>
            <button id="join-btn">
                <i class="fas fa-video"></i> <?php echo $isAdmin ? 'Créer une conférence' : 'Rejoindre'; ?>
            </button>
            <button id="leave-btn" disabled>
                <i class="fas fa-phone-slash"></i> Quitter
            </button>
        </div>

        <?php if (!$isAdmin): ?>
            <div class="info-message">
                <i class="fas fa-info-circle"></i>
                Seuls les administrateurs peuvent créer des conférences. Veuillez contacter un administrateur pour obtenir un code de conférence.
            </div>
        <?php endif; ?>

        <div class="control-buttons" style="display: none;">
            <button id="toggleMic"><i class="fas fa-microphone"></i></button>
            <button id="toggleCamera"><i class="fas fa-video"></i></button>
            <button id="leave-conference" class="leave-btn">
                <i class="fas fa-sign-out-alt"></i> Quitter
            </button>
        </div>

        <div id="status-indicators" style="display: none;">
            <span id="mic-status" class="status muted">🎤 Muet</span>
            <span id="cam-status" class="status muted">📷 Caméra coupée</span>
            <span id="user-count">👥 0 utilisateur(s) connecté(s)</span>
        </div>

        <div id="video-container">
            <div id="local-video" class="video-placeholder">
                <div class="user-name">Vous</div>
            </div>
        </div>

        <div id="moderator-controls" style="display: none;">
            <!-- Les contrôles de modération seront ajoutés ici dynamiquement -->
        </div>

        <footer>
            <p>&copy; <?php echo date('Y'); ?> VideoConnect - Tous droits réservés</p>
        </footer>
    </div>

    <script src="https://download.agora.io/sdk/release/AgoraRTC_N.js"></script>
    <script src="script.js"></script>
</body>
</html> 