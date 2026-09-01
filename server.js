process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const db = require('./db');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

// Rechercher des cartes Magic via Scryfall
app.get('/cartes/recherche', async (req, res) => {
  const terme = req.query.nom;

  const reponse = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(terme)}`, {
    headers: {
      'User-Agent': 'CarteCollectionApp/1.0',
      'Accept': 'application/json'
    }
  });

  const resultat = await reponse.json();

  if (!resultat.data) {
    return res.json([]);
  }

  const cartesSimplifiees = resultat.data.map(carte => ({
    nom: carte.name,
    jeu: 'Magic',
    extension: carte.set_name,
    numero: carte.collector_number,
    rarete: carte.rarity,
    image_url: carte.image_uris ? carte.image_uris.normal : null
  }));

  res.json(cartesSimplifiees);
});

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
  const { nom, jeu, extension, numero, rarete, etat, quantite, valeur_estimee, image_url, foil } = req.body;
  const foilValue = foil ? 1 : 0;

  const existante = db.prepare(`
    SELECT * FROM cartes
    WHERE nom = ? AND jeu = ? AND extension = ? AND numero = ? AND foil = ?
  `).get(nom, jeu, extension, numero, foilValue);

  if (existante) {
    db.prepare('UPDATE cartes SET quantite = quantite + ? WHERE id = ?')
      .run(Number(quantite), existante.id);
    return res.json({ id: existante.id, message: 'Quantité mise à jour' });
  }

  const stmt = db.prepare(`
    INSERT INTO cartes (nom, jeu, extension, numero, rarete, etat, quantite, valeur_estimee, image_url, foil)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(nom, jeu, extension, numero, rarete, etat ?? null, quantite, valeur_estimee ?? null, image_url ?? null, foilValue);
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
  stmt.run(nom, jeu, extension, numero, rarete, etat ?? null, quantite, valeur_estimee ?? null, image_url ?? null, req.params.id);
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