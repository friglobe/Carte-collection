const express = require('express');
const db = require('./db');
const app = express();
const port = 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Ma collection de cartes arrive bientôt !');
});
// Ajouter une carte de test
app.get('/test-insert', (req, res) => {
    const stmt = db.prepare(`INSERT INTO cartes (nom, jeu) VALUES (?, ?)`);
    stmt.run('Dracaufeu', 'Pokémon');
    res.send('Carte insérée!');
});

// Lister toutes les cartes
app.get('/cartes', (req, res) => {
    const cartes = db.prepare('SELECT * FROM cartes').all();
    res.json(cartes);
});

app.listen(port, () => {
  console.log(`Serveur en cours d'exécution sur http://localhost:${port}`);
});