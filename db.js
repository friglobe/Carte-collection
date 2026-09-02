require('dotenv').config();
const { createClient } = require('@libsql/client');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function initialiserBaseDeDonnees() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS cartes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      jeu TEXT NOT NULL,
      extension TEXT,
      numero INTEGER,
      rarete TEXT,
      quantite INTEGER DEFAULT 1,
      valeur_estimee REAL,
      image_url TEXT,
      foil INTEGER DEFAULT 0,
      user_id INTEGER
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom_utilisateur TEXT UNIQUE NOT NULL,
      mot_de_passe_hash TEXT NOT NULL
    );
  `);

  try {
    await db.execute("ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT '🙂'");
  } catch (erreur) {
    // La colonne existe déjà (normal après le premier lancement) — rien à faire
  }
}

module.exports = { db, initialiserBaseDeDonnees };