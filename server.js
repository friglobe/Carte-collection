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
  await db.execute({ sql: 'DELETE FROM cartes WHERE user_id = ?', args: [req.session.userId] });
  await db.execute({
    sql: 'DELETE FROM amities WHERE demandeur_id = ? OR destinataire_id = ?',
    args: [req.session.userId, req.session.userId]
  });
  await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [req.session.userId] });
  req.session.destroy(() => { res.json({ message: 'Compte supprimé' }); });
});

app.post('/amis/demande', verifierConnexion, async (req, res) => {
  const { nom_utilisateur } = req.body;
  if (!nom_utilisateur) return res.status(400).json({ erreur: "Nom d'utilisateur requis" });

  const resultatCible = await db.execute({
    sql: 'SELECT id FROM users WHERE nom_utilisateur = ?',
    args: [nom_utilisateur]
  });
  const cible = resultatCible.rows[0];
  if (!cible) return res.status(404).json({ erreur: 'Utilisateur introuvable' });
  if (Number(cible.id) === req.session.userId) {
    return res.status(400).json({ erreur: "Tu ne peux pas t'ajouter toi-même" });
  }

  const relationExistante = await db.execute({
    sql: `SELECT * FROM amities WHERE (demandeur_id = ? AND destinataire_id = ?) OR (demandeur_id = ? AND destinataire_id = ?)`,
    args: [req.session.userId, cible.id, cible.id, req.session.userId]
  });
  if (relationExistante.rows.length > 0) {
    return res.status(400).json({ erreur: 'Une relation existe déjà avec cet utilisateur' });
  }

  await db.execute({
    sql: 'INSERT INTO amities (demandeur_id, destinataire_id, statut) VALUES (?, ?, ?)',
    args: [req.session.userId, cible.id, 'attente']
  });
  res.status(201).json({ message: 'Demande envoyée' });
});

app.get('/amis', verifierConnexion, async (req, res) => {
  const moi = req.session.userId;
  const resultat = await db.execute({
    sql: `
      SELECT a.id, a.statut, a.demandeur_id, a.destinataire_id, u.nom_utilisateur, u.avatar,
        CASE WHEN a.demandeur_id = ? THEN a.destinataire_id ELSE a.demandeur_id END AS ami_id
      FROM amities a
      JOIN users u ON u.id = CASE WHEN a.demandeur_id = ? THEN a.destinataire_id ELSE a.demandeur_id END
      WHERE a.demandeur_id = ? OR a.destinataire_id = ?
    `,
    args: [moi, moi, moi, moi]
  });

  const amis = [];
  const demandesRecues = [];
  const demandesEnvoyees = [];

  resultat.rows.forEach(ligne => {
    const info = { id: Number(ligne.id), ami_id: Number(ligne.ami_id), nom_utilisateur: ligne.nom_utilisateur, avatar: ligne.avatar || '🙂' };
    if (ligne.statut === 'acceptee') {
      amis.push(info);
    } else if (Number(ligne.destinataire_id) === moi) {
      demandesRecues.push(info);
    } else {
      demandesEnvoyees.push(info);
    }
  });

  res.json({ amis, demandesRecues, demandesEnvoyees });
});

app.put('/amis/:id/accepter', verifierConnexion, async (req, res) => {
  const resultat = await db.execute({
    sql: `SELECT * FROM amities WHERE id = ? AND destinataire_id = ? AND statut = 'attente'`,
    args: [req.params.id, req.session.userId]
  });
  if (resultat.rows.length === 0) return res.status(404).json({ erreur: 'Demande introuvable' });

  await db.execute({ sql: `UPDATE amities SET statut = 'acceptee' WHERE id = ?`, args: [req.params.id] });
  res.json({ message: 'Demande acceptée' });
});

app.delete('/amis/:id', verifierConnexion, async (req, res) => {
  await db.execute({
    sql: 'DELETE FROM amities WHERE id = ? AND (demandeur_id = ? OR destinataire_id = ?)',
    args: [req.params.id, req.session.userId, req.session.userId]
  });
  res.json({ message: 'Relation supprimée' });
});

app.get('/amis/:id/stats', verifierConnexion, async (req, res) => {
  const amiId = Number(req.params.id);
  const relation = await db.execute({
    sql: `SELECT * FROM amities WHERE statut = 'acceptee' AND ((demandeur_id = ? AND destinataire_id = ?) OR (demandeur_id = ? AND destinataire_id = ?))`,
    args: [req.session.userId, amiId, amiId, req.session.userId]
  });
  if (relation.rows.length === 0) return res.status(403).json({ erreur: "Vous n'êtes pas amis avec cet utilisateur" });

  const resultatUtilisateur = await db.execute({ sql: 'SELECT nom_utilisateur, avatar FROM users WHERE id = ?', args: [amiId] });
  const utilisateur = resultatUtilisateur.rows[0];
  if (!utilisateur) return res.status(404).json({ erreur: 'Utilisateur introuvable' });

  const resultatCartes = await db.execute({ sql: 'SELECT quantite, valeur_estimee FROM cartes WHERE user_id = ?', args: [amiId] });
  const cartes = resultatCartes.rows;
  const nombreExemplaires = cartes.reduce((somme, c) => somme + Number(c.quantite), 0);
  const valeurTotale = cartes.reduce((somme, c) => somme + (Number(c.valeur_estimee) || 0) * Number(c.quantite), 0);

  res.json({
    nom_utilisateur: utilisateur.nom_utilisateur,
    avatar: utilisateur.avatar || '🙂',
    nombreCartesDifferentes: cartes.length,
    nombreExemplaires,
    valeurTotale
  });
});

app.get('/extensions', async (req, res) => {
  if (req.query.jeu === 'yugioh') {
    const reponse = await fetch('https://db.ygoprodeck.com/api/v7/cardsets.php', {
      headers: { 'Accept': 'application/json' }
    });
    const sets = await reponse.json();
    const extensionsSimplifiees = sets
      .map(set => ({ code: set.set_name, nom: set.set_name, icone: set.set_image || null, total: set.num_of_cards }))
      .sort((a, b) => a.nom.localeCompare(b.nom));
    return res.json(extensionsSimplifiees);
  }

  if (req.query.jeu === 'onepiece') {
    const [reponseSets, reponseCartes] = await Promise.all([
      fetch('https://optcgapi.com/api/allSets/', { headers: { 'Accept': 'application/json' } }),
      fetch('https://optcgapi.com/api/allSetCards/', { headers: { 'Accept': 'application/json' } })
    ]);
    const sets = await reponseSets.json();
    const cartes = await reponseCartes.json();

    const totalParSet = {};
    (Array.isArray(cartes) ? cartes : []).forEach(carte => {
      totalParSet[carte.set_id] = (totalParSet[carte.set_id] || 0) + 1;
    });

    const extensionsSimplifiees = sets
      .map(set => ({ code: set.set_id, nom: set.set_name, icone: null, total: totalParSet[set.set_id] || null }))
      .sort((a, b) => a.nom.localeCompare(b.nom));
    return res.json(extensionsSimplifiees);
  }

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
  if (req.query.jeu === 'yugioh') {
    return rechercherCartesYuGiOh(req, res);
  }

  if (req.query.jeu === 'onepiece') {
    return rechercherCartesOnePiece(req, res);
  }

  const terme = req.query.nom;
  const extension = req.query.extension;
  let requete = '';
  if (terme) requete += terme;
  if (extension) requete += (requete ? ' ' : '') + `e:${extension}`;
  if (!requete) return res.json([]);

  let toutesLesCartesScryfall = [];
  let url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(requete)}&unique=prints`;

  while (url) {
    const reponse = await fetch(url, {
      headers: { 'User-Agent': 'CarteCollectionApp/1.0', 'Accept': 'application/json' }
    });
    const resultat = await reponse.json();
    if (!resultat.data) break;
    toutesLesCartesScryfall = toutesLesCartesScryfall.concat(resultat.data);
    url = resultat.has_more ? resultat.next_page : null;
  }

  const cartesSimplifiees = toutesLesCartesScryfall.map(carte => ({
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

const TRADUCTIONS_RARETE_YUGIOH = {
  'Common': 'Commune',
  'Rare': 'Rare',
  'Super Rare': 'Super Rare',
  'Ultra Rare': 'Ultra Rare',
  'Secret Rare': 'Rare Secrète',
  'Ultra Secret Rare': 'Rare Secrète Ultra',
  'Extra Secret Rare': 'Rare Secrète Extra',
  'Extra Secret': 'Rare Secrète Extra',
  'Prismatic Secret Rare': 'Rare Secrète Prismatique',
  'Quarter Century Secret Rare': 'Rare Secrète Quart de Siècle',
  'Platinum Secret Rare': 'Rare Secrète Platine',
  'Gold Secret Rare': 'Rare Secrète Or',
  'Ultimate Rare': 'Rare Ultime',
  'Ghost Rare': 'Rare Fantôme',
  'Ghost/Gold Rare': 'Rare Fantôme/Or',
  'Gold Rare': 'Rare Or',
  'Premium Gold Rare': 'Rare Or Premium',
  'Platinum Rare': 'Rare Platine',
  'Collector\'s Rare': 'Rare de Collection',
  'Mosaic Rare': 'Rare Mosaïque',
  'Starlight Rare': 'Rare Lumière Astrale',
  'Normal Parallel Rare': 'Rare Parallèle Normale',
  'Super Parallel Rare': 'Rare Parallèle Super',
  'Ultra Parallel Rare': 'Rare Parallèle Ultra',
  'Duel Terminal Normal Parallel Rare': 'Rare Parallèle Normale (Duel Terminal)',
  'Duel Terminal Rare Parallel Rare': 'Rare Parallèle Rare (Duel Terminal)',
  'Duel Terminal Super Parallel Rare': 'Rare Parallèle Super (Duel Terminal)',
  'Duel Terminal Ultra Parallel Rare': 'Rare Parallèle Ultra (Duel Terminal)',
  'Short Print': 'Tirage Court',
  'Super Short Print': 'Tirage Super Court'
};

const TRADUCTIONS_TYPE_YUGIOH = {
  'Normal Monster': 'Monstre Normal',
  'Effect Monster': 'Monstre à Effet',
  'Fusion Monster': 'Monstre Fusion',
  'Ritual Monster': 'Monstre Rituel',
  'Ritual Effect Monster': 'Monstre Rituel à Effet',
  'Synchro Monster': 'Monstre Synchro',
  'Synchro Tuner Monster': 'Monstre Synchro Syntoniseur',
  'Synchro Pendulum Effect Monster': 'Monstre Synchro à Effet Pendule',
  'Xyz Monster': 'Monstre Xyz',
  'Xyz Pendulum Effect Monster': 'Monstre Xyz à Effet Pendule',
  'Link Monster': 'Monstre Lien',
  'Pendulum Normal Monster': 'Monstre Normal Pendule',
  'Pendulum Effect Monster': 'Monstre à Effet Pendule',
  'Pendulum Effect Fusion Monster': 'Monstre Fusion à Effet Pendule',
  'Pendulum Flip Effect Monster': 'Monstre à Effet Retourner Pendule',
  'Flip Effect Monster': 'Monstre à Effet Retourner',
  'Flip Tuner Effect Monster': 'Monstre à Effet Retourner Syntoniseur',
  'Gemini Monster': 'Monstre Jumeau',
  'Spirit Monster': 'Monstre Esprit',
  'Toon Monster': 'Monstre Toon',
  'Tuner Monster': 'Monstre Syntoniseur',
  'Union Effect Monster': 'Monstre à Effet Union',
  'Spell Card': 'Carte Magie',
  'Trap Card': 'Carte Piège',
  'Skill Card': 'Carte Compétence',
  'Token': 'Jeton'
};

function traduireRareteYuGiOh(rarete) {
  return TRADUCTIONS_RARETE_YUGIOH[rarete] || rarete;
}

function traduireTypeYuGiOh(type) {
  return TRADUCTIONS_TYPE_YUGIOH[type] || type;
}

const TRADUCTIONS_RARETE_ONEPIECE = {
  'L': 'Leader',
  'C': 'Commune',
  'UC': 'Peu Commune',
  'R': 'Rare',
  'SR': 'Super Rare',
  'SEC': 'Secrète',
  'PR': 'Promo',
  'P': 'Promo',
  'SP': 'Spéciale'
};

function traduireRareteOnePiece(rarete) {
  return TRADUCTIONS_RARETE_ONEPIECE[rarete] || rarete;
}

async function rechercherCartesYuGiOh(req, res) {
  const terme = req.query.nom;
  const extension = req.query.extension;

  let urlBase;
  if (extension) {
    urlBase = `https://db.ygoprodeck.com/api/v7/cardinfo.php?cardset=${encodeURIComponent(extension)}`;
  } else if (terme) {
    urlBase = `https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(terme)}`;
  } else {
    return res.json([]);
  }

  // L'API ygoprodeck exclut totalement les cartes sans traduction française quand language=fr
  // est précisé. On récupère donc toujours la version anglaise (complète) et on superpose
  // le nom français par-dessus quand il existe, pour ne perdre aucune carte.
  const [reponseBase, reponseFr] = await Promise.all([
    fetch(urlBase, { headers: { 'Accept': 'application/json' } }),
    fetch(`${urlBase}&language=fr`, { headers: { 'Accept': 'application/json' } })
  ]);

  if (reponseBase.status === 400 && reponseFr.status === 400) {
    return res.json([]);
  }

  // La version française d'une carte traduite a un "id" différent de la version anglaise chez
  // ygoprodeck : on ne peut donc pas fusionner par id. Le champ "name_en" de la réponse FR donne
  // le nom anglais d'origine, qui lui correspond bien au nom de la version de base.
  const cartesParNomAnglais = {};
  if (reponseBase.status !== 400) {
    const resultatBase = await reponseBase.json();
    (resultatBase.data || []).forEach(carte => { cartesParNomAnglais[carte.name] = carte; });
  }
  if (reponseFr.status !== 400) {
    const resultatFr = await reponseFr.json();
    (resultatFr.data || []).forEach(carte => {
      const nomAnglais = carte.name_en || carte.name;
      if (cartesParNomAnglais[nomAnglais]) {
        cartesParNomAnglais[nomAnglais].name = carte.name;
      } else {
        cartesParNomAnglais[nomAnglais] = carte;
      }
    });
  }
  const cartesBrutes = Object.values(cartesParNomAnglais);

  const cartesSimplifiees = [];

  cartesBrutes.forEach(carte => {
    const image = carte.card_images && carte.card_images[0] ? carte.card_images[0].image_url : null;
    const prixEur = carte.card_prices && carte.card_prices[0]
      ? parseFloat(carte.card_prices[0].cardmarket_price) || null
      : null;

    if (extension) {
      const impressions = (carte.card_sets || []).filter(s => s.set_name === extension);
      impressions.forEach(impression => {
        cartesSimplifiees.push({
          nom: carte.name,
          jeu: 'Yu-Gi-Oh',
          extension: impression.set_name,
          numero: impression.set_code,
          rarete: traduireRareteYuGiOh(impression.set_rarity),
          image_url: image,
          prix_eur: prixEur,
          prix_eur_foil: null
        });
      });
    } else {
      cartesSimplifiees.push({
        nom: carte.name,
        jeu: 'Yu-Gi-Oh',
        extension: carte.card_sets && carte.card_sets[0] ? carte.card_sets[0].set_name : '',
        numero: carte.card_sets && carte.card_sets[0] ? carte.card_sets[0].set_code : '',
        rarete: carte.card_sets && carte.card_sets[0] ? traduireRareteYuGiOh(carte.card_sets[0].set_rarity) : traduireTypeYuGiOh(carte.type || '?'),
        image_url: image,
        prix_eur: prixEur,
        prix_eur_foil: null
      });
    }
  });

  cartesSimplifiees.sort((a, b) => String(a.numero).localeCompare(String(b.numero), undefined, { numeric: true }));
  res.json(cartesSimplifiees);
}

async function rechercherCartesOnePiece(req, res) {
  const terme = req.query.nom;
  const extension = req.query.extension;

  let url;
  if (extension) {
    url = `https://optcgapi.com/api/sets/${encodeURIComponent(extension)}/`;
  } else if (terme) {
    url = `https://optcgapi.com/api/sets/filtered/?card_name=${encodeURIComponent(terme)}`;
  } else {
    return res.json([]);
  }

  const reponse = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!reponse.ok) {
    return res.json([]);
  }
  const cartesBrutes = await reponse.json();

  const cartesSimplifiees = (Array.isArray(cartesBrutes) ? cartesBrutes : []).map(carte => ({
    nom: carte.card_name,
    jeu: 'One Piece',
    extension: carte.set_name,
    numero: carte.card_set_id,
    rarete: traduireRareteOnePiece(carte.rarity),
    image_url: carte.card_image || null,
    prix_eur: null,
    prix_eur_foil: null
  }));

  cartesSimplifiees.sort((a, b) => String(a.numero).localeCompare(String(b.numero), undefined, { numeric: true }));
  res.json(cartesSimplifiees);
}

app.get('/cartes', verifierConnexion, async (req, res) => {
  const resultat = await db.execute({ sql: 'SELECT * FROM cartes WHERE user_id = ?', args: [req.session.userId] });
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
    sql: `SELECT * FROM cartes WHERE nom = ? AND jeu = ? AND extension = ? AND numero = ? AND rarete = ? AND foil = ? AND user_id = ?`,
    args: [nom, jeu, extension, numero, rarete, foilValue, req.session.userId]
  });
  if (existante.rows.length > 0) {
    const carteExistante = existante.rows[0];
    await db.execute({ sql: 'UPDATE cartes SET quantite = quantite + ? WHERE id = ?', args: [Number(quantite), carteExistante.id] });
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
  await db.execute({ sql: 'DELETE FROM cartes WHERE id = ? AND user_id = ?', args: [req.params.id, req.session.userId] });
  res.json({ message: 'Carte supprimée' });
});

initialiserBaseDeDonnees().then(() => {
  app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
  });
});