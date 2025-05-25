<?php
require_once 'auth.php';

if (!isLoggedIn()) {
    header('Location: login.php');
    exit();
}

$user = getCurrentUser();
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>À propos - VideoConnect | Solution d'appel vidéo professionnelle</title>
    <meta name="description" content="Découvrez VideoConnect, votre solution professionnelle d'appel vidéo. Notre plateforme offre des conférences en ligne sécurisées et de haute qualité.">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
</head>
<body>
    <div class="container">
        <header>
            <h1>À propos de VideoConnect</h1>
            <div class="user-info">
                <span>Bienvenue, <?php echo htmlspecialchars($user['username']); ?></span>
                <a href="index.php" class="btn">Retour à l'accueil</a>
                <a href="logout.php" class="logout-btn">Déconnexion</a>
            </div>
        </header>

        <main class="about-content">
            <section class="about-section">
                <h2>Notre Mission</h2>
                <p>VideoConnect est né de la volonté de fournir une solution d'appel vidéo professionnelle, sécurisée et facile à utiliser. Notre mission est de permettre aux entreprises et aux particuliers de communiquer efficacement, peu importe leur localisation.</p>
            </section>

            <section class="about-section">
                <h2>Nos Fonctionnalités</h2>
                <div class="features-grid">
                    <div class="feature-card">
                        <i class="fas fa-video"></i>
                        <h3>Appel Vidéo HD</h3>
                        <p>Qualité d'image et de son optimale pour des réunions professionnelles.</p>
                    </div>
                    <div class="feature-card">
                        <i class="fas fa-shield-alt"></i>
                        <h3>Sécurité Maximale</h3>
                        <p>Protection des données et chiffrement de bout en bout.</p>
                    </div>
                    <div class="feature-card">
                        <i class="fas fa-users"></i>
                        <h3>Multi-participants</h3>
                        <p>Organisez des conférences avec plusieurs participants.</p>
                    </div>
                    <div class="feature-card">
                        <i class="fas fa-desktop"></i>
                        <h3>Partage d'écran</h3>
                        <p>Partagez votre écran pour des présentations efficaces.</p>
                    </div>
                </div>
            </section>

            <section class="about-section">
                <h2>Pourquoi Nous Choisir ?</h2>
                <ul class="benefits-list">
                    <li><i class="fas fa-check"></i> Interface intuitive et facile à utiliser</li>
                    <li><i class="fas fa-check"></i> Support technique réactif</li>
                    <li><i class="fas fa-check"></i> Mises à jour régulières</li>
                    <li><i class="fas fa-check"></i> Compatible avec tous les navigateurs modernes</li>
                </ul>
            </section>
        </main>

        <footer class="about-footer">
            <p>&copy; <?php echo date('Y'); ?> VideoConnect. Tous droits réservés.</p>
        </footer>
    </div>
</body>
</html> 