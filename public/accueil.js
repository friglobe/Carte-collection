document.addEventListener('DOMContentLoaded', async () => {
  const connecte = await verifierConnexion();
  if (!connecte) return;
  initialiserDeconnexion();
  chargerTableauDeBord();
});

async function chargerTableauDeBord() {
  const [reponseCartes, reponseExtensionsMagic, reponseExtensionsYugioh, reponseExtensionsOnePiece] = await Promise.all([
    fetch('/cartes'),
    fetch('/extensions?tous=1'),
    fetch('/extensions?jeu=yugioh'),
    fetch('/extensions?jeu=onepiece')
  ]);
  const cartes = await reponseCartes.json();
  const extensionsMagic = await reponseExtensionsMagic.json();
  const extensionsYugioh = await reponseExtensionsYugioh.json();
  const extensionsOnePiece = await reponseExtensionsOnePiece.json();

  const totalParExtension = {};
  [...extensionsMagic, ...extensionsYugioh, ...extensionsOnePiece].forEach(ext => {
    totalParExtension[ext.nom] = ext.total;
  });

  const valeurTotale = cartes.reduce((somme, c) => somme + (c.valeur_estimee || 0) * c.quantite, 0);
  const nombreExemplaires = cartes.reduce((somme, c) => somme + c.quantite, 0);
  const nombreFoil = cartes.filter(c => c.foil).reduce((somme, c) => somme + c.quantite, 0);

  const parExtension = {};
  cartes.forEach(carte => {
    if (!parExtension[carte.extension]) parExtension[carte.extension] = 0;
    parExtension[carte.extension] += carte.quantite;
  });

  let carteLaPlusChere = null;
  cartes.forEach(carte => {
    if (carte.valeur_estimee && (!carteLaPlusChere || carte.valeur_estimee > carteLaPlusChere.valeur_estimee)) {
      carteLaPlusChere = carte;
    }
  });

  const conteneur = document.getElementById('stats-dashboard');

  const tuiles = `
    <div class="cartes-stats">
      <div class="stat-tuile"><span>${cartes.length}</span><p>Cartes différentes</p></div>
      <div class="stat-tuile"><span>${nombreExemplaires}</span><p>Exemplaires au total</p></div>
      <div class="stat-tuile"><span>${nombreFoil}</span><p>Exemplaires Foil</p></div>
      <div class="stat-tuile"><span>${valeurTotale.toFixed(2)} €</span><p>Valeur estimée</p></div>
    </div>
  `;

  const carteMiseEnAvant = carteLaPlusChere ? `
    <div class="carte-mise-en-avant">
      <h3>Carte la plus chère</h3>
      ${carteLaPlusChere.image_url ? `<img src="${carteLaPlusChere.image_url}" alt="${carteLaPlusChere.nom}">` : ''}
      <p>${carteLaPlusChere.nom} - ${carteLaPlusChere.valeur_estimee.toFixed(2)} €</p>
    </div>
  ` : '';

  const repartition = `
    <div class="repartition-extensions">
      <h3>Répartition par extension</h3>
      <ul>
        ${Object.entries(parExtension)
          .sort((a, b) => b[1] - a[1])
          .map(([extension, quantite]) => {
            const total = totalParExtension[extension];
            return `<li>${extension} : ${quantite}${total ? ' / ' + total : ''}</li>`;
          }).join('')}
      </ul>
    </div>
  `;

  conteneur.innerHTML = `${tuiles}<div class="dashboard-colonnes">${carteMiseEnAvant}${repartition}</div>`;
}