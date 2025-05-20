# Application de Visioconférence Agora

## Déploiement sur Render.com

1. Créez un compte sur [Render.com](https://render.com)
2. Cliquez sur "New +" et sélectionnez "Web Service"
3. Connectez votre dépôt GitHub (ou créez-en un nouveau)
4. Configurez le service :
   - Name: `agora-video-chat` (ou le nom que vous souhaitez)
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Plan: `Free`

## Configuration

L'application utilise l'ID d'application Agora suivant :
- App ID: `2071d93215924d1c81e1bca9b4d594c0`

## Utilisation

1. Une fois déployé, vous recevrez une URL (ex: `https://votre-app.onrender.com`)
2. Partagez cette URL avec les participants
3. Pour rejoindre une réunion :
   - Entrez le même nom de canal sur tous les appareils
   - Le premier à se connecter devient le modérateur
   - Les autres participants auront des contrôles limités 