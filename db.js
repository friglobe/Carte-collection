const {DatabaseSync} = require('node:sqlite');
const db = new DatabaseSync('cartes.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS cartes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    jeu TEXT NOT NULL,
    extension TEXT,
    numero INTEGER,
    rarete TEXT,
    quantite INTEGER default 1,
    valeur_estimee REAL,
    image_url TEXT
  );
`);

try {
  db.exec('ALTER TABLE cartes ADD COLUMN foil INTEGER DEFAULT 0');
} catch (erreur) {}

try {
  db.exec('ALTER TABLE cartes ADD COLUMN user_id INTEGER');
} catch (erreur) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom_utilisateur TEXT UNIQUE NOT NULL,
    mot_de_passe_hash TEXT NOT NULL
  );
`);

module.exports = db;