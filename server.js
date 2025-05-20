const express = require('express');
const app = express();
const port = 3000;

app.use(express.static('public'));

app.listen(port, '0.0.0.0', () => {
    console.log(`Serveur démarré sur http://0.0.0.0:${port}`);
    console.log(`Pour accéder depuis d'autres appareils sur le même réseau, utilisez l'adresse IP de votre ordinateur`);
});