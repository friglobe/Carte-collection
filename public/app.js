let toutesLesCartes = [];
let toutesLesExtensions = [];
let totalParExtension = {};

document.addEventListener('DOMContentLoaded', async () => {
  const connecte = await verifierConnexion();
  if (!connecte) return;
  initialiserDeconnexion();

  document.getElementById('btn-toggle-recherche').addEventListener('click', () => {
    const zone = document.getElementById('zone-recherche');
    zone.hidden = !zone.hidden;
  });

  document.getElementById('recherche-extension-filtre').addEventListener('input', (e) => {
    afficherVignettesExtensions(e.target.value);
  });

  document.getElementById('filtre-extension').addEventListener('change', (e) => {
    afficherCartes(toutesLesCartes, e.target.value);
  });

  chargerCartes();
  chargerExtensions();

  const params = new URLSearchParams(window.location.search);
  if (params.get('recherche')) {
    document.getElementById('zone-recherche').hidden = false;
  }
});

async function chargerCartes() {
  const [reponseCartes, reponseExtensions] = await Promise.all([
    fetch('/cartes'),
    fetch('/extensions?tous=1')
  ]);
  toutesLesCartes = await reponseCartes.json();
  const extensions = await reponseExtensions.json();

  totalParExtension = {};
  extensions.forEach(ext => {
    totalParExtension[ext.nom] = ext.total;
  });

  remplirFiltreExtensions();
  afficherCartes(toutesLesCartes);
}

function remplirFiltreExtensions() {
  const select = document.getElementById('filtre-extension');
  const extensionsPossedees = [...new Set(toutesLesCartes.map(c => c.extension))].filter(Boolean).sort();
  select.innerHTML = '<option value="">Toutes les extensions</option>' +
    extensionsPossedees.map(ext => `<option value="${ext}">${ext}</option>`).join('');
}

function afficherCartes(cartes, extensionFiltree = '') {
  const conteneur = document.getElementById('liste-cartes');
  const cartesAffichees = extensionFiltree
    ? cartes.filter(c => c.extension === extensionFiltree)
    : cartes;

  const valeurTotale = cartesAffichees.reduce((somme, c) => somme + (c.valeur_estimee || 0) * c.quantite, 0);
  const nombreExemplaires = cartesAffichees.reduce((somme, c) => somme + c.quantite, 0);

  let texteStats = `${cartesAffichees.length} carte(s) différente(s), ${nombreExemplaires} exemplaire(s), valeur estimée : ${valeurTotale.toFixed(2)} €`;
  if (extensionFiltree && totalParExtension[extensionFiltree]) {
    texteStats += ` — ${cartesAffichees.length} / ${totalParExtension[extensionFiltree]} cartes de l'extension possédées`;
  }
  document.getElementById('stats-collection').textContent = texteStats;

  conteneur.innerHTML = cartesAffichees.map(carte => `
    <div class="carte">
      ${carte.image_url ? `<img src="${carte.image_url}" alt="${carte.nom}">` : ''}
      <h3>${carte.nom}</h3>
      <p>${carte.extension} - #${carte.numero}</p>
      <p>Rareté : ${carte.rarete || '?'}</p>
      <p>Quantité : ${carte.quantite}${carte.foil ? ' <span class="badge-foil">Foil</span>' : ''}</p>
      <p>Valeur estimée : ${carte.valeur_estimee ? carte.valeur_estimee.toFixed(2) + ' €' : '?'}</p>
      <button class="btn-supprimer" data-id="${carte.id}">Supprimer</button>
    </div>
  `).join('');

  document.querySelectorAll('.btn-supprimer').forEach(bouton => {
    bouton.addEventListener('click', async () => {
      await fetch(`/cartes/${bouton.dataset.id}`, { method: 'DELETE' });
      chargerCartes();
    });
  });
}

async function chargerExtensions() {
  const reponse = await fetch('/extensions');
  toutesLesExtensions = await reponse.json();
  afficherVignettesExtensions();
}

function afficherVignettesExtensions(filtre = '') {
  const conteneur = document.getElementById('extensions-vignettes');
  const filtreMinuscule = filtre.toLowerCase();
  const extensionsFiltrees = toutesLesExtensions.filter(ext =>
    ext.nom.toLowerCase().includes(filtreMinuscule)
  );

  conteneur.innerHTML = extensionsFiltrees.map(ext => `
    <div class="vignette-extension" data-code="${ext.code}">
      ${ext.icone ? `<img src="${ext.icone}" alt="${ext.nom}">` : ''}
      <span>${ext.nom}</span>
    </div>
  `).join('');

  document.querySelectorAll('.vignette-extension').forEach(vignette => {
    vignette.addEventListener('click', () => {
      rechercherParExtension(vignette.dataset.code);
    });
  });
}

async function rechercherParExtension(code) {
  const reponse = await fetch(`/cartes/recherche?extension=${encodeURIComponent(code)}`);
  const cartes = await reponse.json();
  const conteneur = document.getElementById('resultats-recherche');

  conteneur.innerHTML = cartes.map((carte, index) => `
    <div class="resultat-carte" data-index="${index}">
      ${carte.image_url ? `<img src="${carte.image_url}" alt="${carte.nom}">` : ''}
      <h4>${carte.nom}</h4>
      <p>#${carte.numero} - ${carte.rarete}</p>
      <p>Prix : ${carte.prix_eur ? carte.prix_eur + ' €' : '?'} ${carte.prix_eur_foil ? '(Foil : ' + carte.prix_eur_foil + ' €)' : ''}</p>
    </div>
  `).join('');

  document.querySelectorAll('.resultat-carte').forEach(div => {
    div.addEventListener('click', async () => {
      const carte = cartes[div.dataset.index];
      const quantite = prompt(`Quantité pour "${carte.nom}" ?`, '1');
      if (!quantite) return;
      const estFoil = confirm('Est-ce une version Foil ?');
      const valeurEstimee = estFoil ? carte.prix_eur_foil : carte.prix_eur;

      await fetch('/cartes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...carte,
          quantite: Number(quantite),
          foil: estFoil,
          valeur_estimee: valeurEstimee
        })
      });

      alert('Carte ajoutée à la collection !');
      chargerCartes();
    });
  });
}