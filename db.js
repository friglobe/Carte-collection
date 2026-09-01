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
    etat TEXT,
    quantite INTEGER default 1,
    valeur_estimee REAL,
    image_url TEXT
  );
`);

module.exports = db;