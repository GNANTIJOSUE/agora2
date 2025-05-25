<?php
// Fichier partagé pour la liste des utilisateurs connectés
$file = 'users.json';

// Récupère la liste actuelle
$users = file_exists($file) ? json_decode(file_get_contents($file), true) : [];

// Ajout ou suppression d'utilisateur
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $uid = $_POST['uid'];
    $username = isset($_POST['username']) ? $_POST['username'] : '';
    $action = $_POST['action'];

    if ($action === 'join') {
        $users[$uid] = ['uid' => $uid, 'username' => $username];
    } elseif ($action === 'leave') {
        unset($users[$uid]);
    }
    file_put_contents($file, json_encode($users));
    echo json_encode(['success' => true]);
    exit;
}

// Sinon, retourne la liste
echo json_encode(array_values($users)); 