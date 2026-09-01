const express = require('express');
const db = require('./db');
const app = express();
const PORT = 3000;

app.use(express.json());

// Lister toutes les cartes
app.get('/cartes', (req, res) => {
  const cartes = db.prepare('SELECT * FROM cartes').all();
  res.json(cartes);
});

// Récupérer une carte par son id
app.get('/cartes/:id', (req, res) => {
  const carte = db.prepare('SELECT * FROM cartes WHERE id = ?').get(req.params.id);
  if (!carte) {
    return res.status(404).json({ erreur: 'Carte non trouvée' });
  }
  res.json(carte);
});

// Ajouter une carte
app.post('/cartes', (req, res) => {
  const { nom, jeu, extension, numero, rarete, etat, quantite, valeur_estimee, image_url } = req.body;
  const stmt = db.prepare(`
    INSERT INTO cartes (nom, jeu, extension, numero, rarete, etat, quantite, valeur_estimee, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(nom, jeu, extension, numero, rarete, etat, quantite, valeur_estimee, image_url);
  res.status(201).json({ id: Number(result.lastInsertRowid) });
});

// Modifier une carte
app.put('/cartes/:id', (req, res) => {
  const { nom, jeu, extension, numero, rarete, etat, quantite, valeur_estimee, image_url } = req.body;
  const stmt = db.prepare(`
    UPDATE cartes
    SET nom = ?, jeu = ?, extension = ?, numero = ?, rarete = ?, etat = ?, quantite = ?, valeur_estimee = ?, image_url = ?
    WHERE id = ?
  `);
  stmt.run(nom, jeu, extension, numero, rarete, etat, quantite, valeur_estimee, image_url, req.params.id);
  res.json({ message: 'Carte mise à jour' });
});

// Supprimer une carte
app.delete('/cartes/:id', (req, res) => {
  db.prepare('DELETE FROM cartes WHERE id = ?').run(req.params.id);
  res.json({ message: 'Carte supprimée' });
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});