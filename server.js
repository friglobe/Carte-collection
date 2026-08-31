const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('Ma collection de cartes arrive bientôt !');
});

app.listen(port, () => {
  console.log(`Serveur en cours d'exécution sur http://localhost:${port}`);
});