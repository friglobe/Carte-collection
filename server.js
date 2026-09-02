require('dotenv').config();

if (process.env.RESEAU_ENTREPRISE === 'true') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { db, initialiserBaseDeDonnees } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-moi-un-jour-en-vraie-cle-secrete',
  resave: false,
  saveUninitialized: false
}));
app.use(express.static('public'));

function verifierConnexion(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ erreur: 'Non connecté' });
  }
  next();
}

app.post('/inscription', async (req, res) => {
  const { nom_utilisateur, mot_de_passe } = req.body;
  if (!nom_utilisateur || !mot_de_passe) {
    return res.status(400).json({ erreur: "Nom d'utilisateur et mot de passe requis" });
  }
  const hash = bcrypt.hashSync(mot_de_passe, 10);
  try {
    const resultat = await db.execute({
      sql: 'INSERT INTO users (nom_utilisateur, mot_de_passe_hash) VALUES (?, ?)',
      args: [nom_utilisateur, hash]
    });
    req.session.userId = Number(resultat.lastInsertRowid);
    res.status(201).json({ message: 'Compte créé' });
  } catch (erreur) {
    res.status(400).json({ erreur: "Ce nom d'utilisateur est déjà pris" });
  }
});

app.post('/connexion', async (req, res) => {
  const { nom_utilisateur, mot_de_passe } = req.body;
  const resultat = await db.execute({
    sql: 'SELECT * FROM users WHERE nom_utilisateur = ?',
    args: [nom_utilisateur]
  });
  const utilisateur = resultat.rows[0];
  if (!utilisateur || !bcrypt.compareSync(mot_de_passe, utilisateur.mot_de_passe_hash)) {
    return res.status(401).json({ erreur: 'Identifiants incorrects' });
  }
  req.session.userId = Number(utilisateur.id);
  res.json({ message: 'Connecté' });
});

app.post('/deconnexion', (req, res) => {
  req.session.destroy(() => { res.json({ message: 'Déconnecté' }); });
});

app.get('/moi', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ connecte: false });
  res.json({ connecte: true });
});

app.get('/profil', verifierConnexion, async (req, res) => {
  const resultat = await db.execute({
    sql: 'SELECT nom_utilisateur, avatar FROM users WHERE id = ?',
    args: [req.session.userId]
  });
  const utilisateur = resultat.rows[0];
  res.json({ nom_utilisateur: utilisateur.nom_utilisateur, avatar: utilisateur.avatar || '🙂' });
});

app.put('/profil/mot-de-passe', verifierConnexion, async (req, res) => {
  const { mot_de_passe_actuel, nouveau_mot_de_passe } = req.body;
  if (!mot_de_passe_actuel || !nouveau_mot_de_passe) {
    return res.status(400).json({ erreur: 'Les deux mots de passe sont requis' });
  }

  const resultat = await db.execute({
    sql: 'SELECT * FROM users WHERE id = ?',
    args: [req.session.userId]
  });
  const utilisateur = resultat.rows[0];

  if (!bcrypt.compareSync(mot_de_passe_actuel, utilisateur.mot_de_passe_hash)) {
    return res.status(401).json({ erreur: 'Mot de passe actuel incorrect' });
  }

  const nouveauHash = bcrypt.hashSync(nouveau_mot_de_passe, 10);
  await db.execute({
    sql: 'UPDATE users SET mot_de_passe_hash = ? WHERE id = ?',
    args: [nouveauHash, req.session.userId]
  });

  res.json({ message: 'Mot de passe mis à jour' });
});

app.put('/profil/avatar', verifierConnexion, async (req, res) => {
  const { avatar } = req.body;
  if (!avatar) return res.status(400).json({ erreur: 'Avatar requis' });

  await db.execute({
    sql: 'UPDATE users SET avatar = ? WHERE id = ?',
    args: [avatar, req.session.userId]
  });

  res.json({ message: 'Avatar mis à jour' });
});

app.delete('/profil', verifierConnexion, async (req, res) => {
  await db.execute({
    sql: 'DELETE FROM cartes WHERE user_id = ?',
    args: [req.session.userId]
  });
  await db.execute({
    sql: 'DELETE FROM users WHERE id = ?',
    args: [req.session.userId]
  });

  req.session.destroy(() => {
    res.json({ message: 'Compte supprimé' });
  });
});

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

app.get('/cartes', verifierConnexion, async (req, res) => {
  const resultat = await db.execute({
    sql: 'SELECT * FROM cartes WHERE user_id = ?',
    args: [req.session.userId]
  });
  res.json(resultat.rows);
});

app.get('/cartes/:id', verifierConnexion, async (req, res) => {
  const resultat = await db.execute({
    sql: 'SELECT * FROM cartes WHERE id = ? AND user_id = ?',
    args: [req.params.id, req.session.userId]
  });
  const carte = resultat.rows[0];
  if (!carte) return res.status(404).json({ erreur: 'Carte non trouvée' });
  res.json(carte);
});

app.post('/cartes', verifierConnexion, async (req, res) => {
  const { nom, jeu, extension, numero, rarete, quantite, valeur_estimee, image_url, foil } = req.body;
  const foilValue = foil ? 1 : 0;

  const existante = await db.execute({
    sql: `SELECT * FROM cartes WHERE nom = ? AND jeu = ? AND extension = ? AND numero = ? AND foil = ? AND user_id = ?`,
    args: [nom, jeu, extension, numero, foilValue, req.session.userId]
  });

  if (existante.rows.length > 0) {
    const carteExistante = existante.rows[0];
    await db.execute({
      sql: 'UPDATE cartes SET quantite = quantite + ? WHERE id = ?',
      args: [Number(quantite), carteExistante.id]
    });
    return res.json({ id: Number(carteExistante.id), message: 'Quantité mise à jour' });
  }

  const resultat = await db.execute({
    sql: `INSERT INTO cartes (nom, jeu, extension, numero, rarete, quantite, valeur_estimee, image_url, foil, user_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [nom, jeu, extension, numero, rarete, quantite, valeur_estimee ?? null, image_url ?? null, foilValue, req.session.userId]
  });

  res.status(201).json({ id: Number(resultat.lastInsertRowid) });
});

app.put('/cartes/:id', verifierConnexion, async (req, res) => {
  const { nom, jeu, extension, numero, rarete, quantite, valeur_estimee, image_url, foil } = req.body;
  const foilValue = foil ? 1 : 0;
  await db.execute({
    sql: `UPDATE cartes
          SET nom = ?, jeu = ?, extension = ?, numero = ?, rarete = ?, quantite = ?, valeur_estimee = ?, image_url = ?, foil = ?
          WHERE id = ? AND user_id = ?`,
    args: [nom, jeu, extension, numero, rarete, quantite, valeur_estimee ?? null, image_url ?? null, foilValue, req.params.id, req.session.userId]
  });
  res.json({ message: 'Carte mise à jour' });
});

app.delete('/cartes/:id', verifierConnexion, async (req, res) => {
  await db.execute({
    sql: 'DELETE FROM cartes WHERE id = ? AND user_id = ?',
    args: [req.params.id, req.session.userId]
  });
  res.json({ message: 'Carte supprimée' });
});

initialiserBaseDeDonnees().then(() => {
  app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
  });
});