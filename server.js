process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const db = require('./db');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(session({
  secret: 'change-moi-un-jour-en-vraie-cle-secrete',
  resave: false,
  saveUninitialized: false
}));
app.use(express.static('public'));

// Middleware qui bloque l'accès si personne n'est connecté
function verifierConnexion(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ erreur: 'Non connecté' });
  }
  next();
}

// --- Authentification ---

app.post('/inscription', (req, res) => {
  const { nom_utilisateur, mot_de_passe } = req.body;

  if (!nom_utilisateur || !mot_de_passe) {
    return res.status(400).json({ erreur: "Nom d'utilisateur et mot de passe requis" });
  }

  const hash = bcrypt.hashSync(mot_de_passe, 10);

  try {
    const result = db.prepare('INSERT INTO users (nom_utilisateur, mot_de_passe_hash) VALUES (?, ?)').run(nom_utilisateur, hash);
    req.session.userId = Number(result.lastInsertRowid);
    res.status(201).json({ message: 'Compte créé' });
  } catch (erreur) {
    res.status(400).json({ erreur: 'Ce nom d\'utilisateur est déjà pris' });
  }
});

app.post('/connexion', (req, res) => {
  const { nom_utilisateur, mot_de_passe } = req.body;

  const utilisateur = db.prepare('SELECT * FROM users WHERE nom_utilisateur = ?').get(nom_utilisateur);

  if (!utilisateur || !bcrypt.compareSync(mot_de_passe, utilisateur.mot_de_passe_hash)) {
    return res.status(401).json({ erreur: 'Identifiants incorrects' });
  }

  req.session.userId = utilisateur.id;
  res.json({ message: 'Connecté' });
});

app.post('/deconnexion', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Déconnecté' });
  });
});

app.get('/moi', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ connecte: false });
  }
  res.json({ connecte: true });
});

// --- Recherche (pas besoin d'être connecté pour chercher, juste pour ajouter à SA collection) ---

app.get('/extensions', async (req, res) => {
  const reponse = await fetch('https://api.scryfall.com/sets', {
    headers: { 'User-Agent': 'CarteCollectionApp/1.0', 'Accept': 'application/json' }
  });
  const resultat = await reponse.json();

  let extensions = resultat.data;
  if (!req.query.tous) {
    extensions = extensions.filter(set => set.set_type === 'expansion' || set.set_type === 'core');
  }

  const extensionsSimplifiees = extensions
    .map(set => ({ code: set.code, nom: set.name, icone: set.icon_svg_uri, total: set.card_count }))
    .sort((a, b) => a.nom.localeCompare(b.nom));

  res.json(extensionsSimplifiees);
});

app.get('/cartes/recherche', async (req, res) => {
  const terme = req.query.nom;
  const extension = req.query.extension;
  let requete = '';
  if (terme) requete += terme;
  if (extension) requete += (requete ? ' ' : '') + `e:${extension}`;
  if (!requete) return res.json([]);
  const reponse = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(requete)}`, {
    headers: { 'User-Agent': 'CarteCollectionApp/1.0', 'Accept': 'application/json' }
  });
  const resultat = await reponse.json();
  if (!resultat.data) return res.json([]);
  const cartesSimplifiees = resultat.data.map(carte => ({
    nom: carte.name,
    jeu: 'Magic',
    extension: carte.set_name,
    numero: carte.collector_number,
    rarete: carte.rarity,
    image_url: carte.image_uris ? carte.image_uris.normal : null,
    prix_eur: carte.prices ? parseFloat(carte.prices.eur) || null : null,
    prix_eur_foil: carte.prices ? parseFloat(carte.prices.eur_foil) || null : null
  }));

  cartesSimplifiees.sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }));

  res.json(cartesSimplifiees);
});

// --- Collection personnelle (protégée, chacun ne voit/modifie que la sienne) ---

app.get('/cartes', verifierConnexion, (req, res) => {
  const cartes = db.prepare('SELECT * FROM cartes WHERE user_id = ?').all(req.session.userId);
  res.json(cartes);
});

app.get('/cartes/:id', verifierConnexion, (req, res) => {
  const carte = db.prepare('SELECT * FROM cartes WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
  if (!carte) {
    return res.status(404).json({ erreur: 'Carte non trouvée' });
  }
  res.json(carte);
});

app.post('/cartes', verifierConnexion, (req, res) => {
  const { nom, jeu, extension, numero, rarete, etat, quantite, valeur_estimee, image_url, foil } = req.body;
  const foilValue = foil ? 1 : 0;

  const existante = db.prepare(`
    SELECT * FROM cartes
    WHERE nom = ? AND jeu = ? AND extension = ? AND numero = ? AND foil = ? AND user_id = ?
  `).get(nom, jeu, extension, numero, foilValue, req.session.userId);

  if (existante) {
    db.prepare('UPDATE cartes SET quantite = quantite + ? WHERE id = ?')
      .run(Number(quantite), existante.id);
    return res.json({ id: existante.id, message: 'Quantité mise à jour' });
  }

  const stmt = db.prepare(`
    INSERT INTO cartes (nom, jeu, extension, numero, rarete, etat, quantite, valeur_estimee, image_url, foil, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(nom, jeu, extension, numero, rarete, etat ?? null, quantite, valeur_estimee ?? null, image_url ?? null, foilValue, req.session.userId);
  res.status(201).json({ id: Number(result.lastInsertRowid) });
});

app.put('/cartes/:id', verifierConnexion, (req, res) => {
  const { nom, jeu, extension, numero, rarete, etat, quantite, valeur_estimee, image_url } = req.body;
  const stmt = db.prepare(`
    UPDATE cartes
    SET nom = ?, jeu = ?, extension = ?, numero = ?, rarete = ?, etat = ?, quantite = ?, valeur_estimee = ?, image_url = ?
    WHERE id = ? AND user_id = ?
  `);
  stmt.run(nom, jeu, extension, numero, rarete, etat ?? null, quantite, valeur_estimee ?? null, image_url ?? null, req.params.id, req.session.userId);
  res.json({ message: 'Carte mise à jour' });
});

app.delete('/cartes/:id', verifierConnexion, (req, res) => {
  db.prepare('DELETE FROM cartes WHERE id = ? AND user_id = ?').run(req.params.id, req.session.userId);
  res.json({ message: 'Carte supprimée' });
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});