let toutesLesCartes = [];
let toutesLesExtensions = [];
let totalParExtension = {};
let carteSelectionnee = null;
let modeModification = false;

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

  document.getElementById('modal-fermer').addEventListener('click', fermerModal);
  document.getElementById('modal-confirmer').addEventListener('click', confirmerModale);
  document.getElementById('modal-foil-toggle').addEventListener('click', basculerFoil);

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
    <div class="carte" data-rarete="${carte.rarete}">
      ${carte.image_url ? `<img src="${carte.image_url}" alt="${carte.nom}">` : ''}
      <h3>${carte.nom}</h3>
      <p>${carte.extension} - #${carte.numero}</p>
      <p>Rareté : ${carte.rarete || '?'}</p>
      <p>Quantité : ${carte.quantite}${carte.foil ? ' <span class="badge-foil">Foil</span>' : ''}</p>
      <p>Valeur estimée : ${carte.valeur_estimee ? carte.valeur_estimee.toFixed(2) + ' €' : '?'}</p>
      <div class="actions-carte">
        <button class="btn-modifier" data-id="${carte.id}">Modifier</button>
        <button class="btn-supprimer" data-id="${carte.id}">Supprimer</button>
      </div>
    </div>
  `).join('');

  document.querySelectorAll('.btn-modifier').forEach(bouton => {
    bouton.addEventListener('click', () => {
      const carte = cartesAffichees.find(c => c.id === Number(bouton.dataset.id));
      ouvrirModalModification(carte);
    });
  });

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
    <div class="resultat-carte" data-index="${index}" data-rarete="${carte.rarete}">
      ${carte.image_url ? `<img src="${carte.image_url}" alt="${carte.nom}">` : ''}
      <h4>${carte.nom}</h4>
      <p>#${carte.numero} - ${carte.rarete}</p>
      <p>Prix : ${carte.prix_eur ? carte.prix_eur + ' €' : '?'} ${carte.prix_eur_foil ? '(Foil : ' + carte.prix_eur_foil + ' €)' : ''}</p>
    </div>
  `).join('');

  document.querySelectorAll('.resultat-carte').forEach(div => {
    div.addEventListener('click', () => {
      ouvrirModalAjout(cartes[div.dataset.index]);
    });
  });
}

function ouvrirModalAjout(carte) {
  carteSelectionnee = carte;
  modeModification = false;

  const image = document.getElementById('modal-image');
  image.src = carte.image_url || '';
  image.hidden = !carte.image_url;

  document.getElementById('modal-nom').textContent = carte.nom;
  document.getElementById('modal-info').textContent = `${carte.extension} - #${carte.numero} - ${carte.rarete || '?'}`;
  document.getElementById('modal-quantite').value = 1;

  const toggle = document.getElementById('modal-foil-toggle');
  toggle.dataset.foil = 'false';
  toggle.querySelector('.toggle-texte').textContent = 'Normal';

  document.getElementById('modal-confirmer').textContent = 'Ajouter à ma collection';

  mettreAJourPrixModal();

  document.getElementById('modal-ajout-carte').hidden = false;
}

function ouvrirModalModification(carte) {
  carteSelectionnee = carte;
  modeModification = true;

  const image = document.getElementById('modal-image');
  image.src = carte.image_url || '';
  image.hidden = !carte.image_url;

  document.getElementById('modal-nom').textContent = carte.nom;
  document.getElementById('modal-info').textContent = `${carte.extension} - #${carte.numero} - ${carte.rarete || '?'}`;
  document.getElementById('modal-quantite').value = carte.quantite;

  const toggle = document.getElementById('modal-foil-toggle');
  toggle.dataset.foil = carte.foil ? 'true' : 'false';
  toggle.querySelector('.toggle-texte').textContent = carte.foil ? 'Foil' : 'Normal';

  document.getElementById('modal-confirmer').textContent = 'Enregistrer les modifications';

  mettreAJourPrixModal();

  document.getElementById('modal-ajout-carte').hidden = false;
}

function fermerModal() {
  document.getElementById('modal-ajout-carte').hidden = true;
  carteSelectionnee = null;
  modeModification = false;
}

function basculerFoil() {
  const bouton = document.getElementById('modal-foil-toggle');
  const estFoilActuellement = bouton.dataset.foil === 'true';
  const nouvelEtat = !estFoilActuellement;

  bouton.dataset.foil = nouvelEtat;
  bouton.querySelector('.toggle-texte').textContent = nouvelEtat ? 'Foil' : 'Normal';

  mettreAJourPrixModal();
}

function mettreAJourPrixModal() {
  if (!carteSelectionnee) return;

  if (modeModification) {
    const prix = carteSelectionnee.valeur_estimee;
    document.getElementById('modal-prix').textContent = prix ? `Valeur actuelle : ${prix.toFixed(2)} €` : 'Valeur actuelle : ?';
  } else {
    const estFoil = document.getElementById('modal-foil-toggle').dataset.foil === 'true';
    const prix = estFoil ? carteSelectionnee.prix_eur_foil : carteSelectionnee.prix_eur;
    document.getElementById('modal-prix').textContent = prix ? `Prix estimé : ${prix} €` : 'Prix estimé : ?';
  }
}

async function confirmerModale() {
  if (!carteSelectionnee) return;
  const quantite = Number(document.getElementById('modal-quantite').value);
  if (!quantite || quantite < 1) return;

  const estFoil = document.getElementById('modal-foil-toggle').dataset.foil === 'true';

  if (modeModification) {
    await fetch(`/cartes/${carteSelectionnee.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...carteSelectionnee,
        quantite,
        foil: estFoil
      })
    });
  } else {
    const valeurEstimee = estFoil ? carteSelectionnee.prix_eur_foil : carteSelectionnee.prix_eur;
    await fetch('/cartes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...carteSelectionnee,
        quantite,
        foil: estFoil,
        valeur_estimee: valeurEstimee
      })
    });
  }

  fermerModal();
  chargerCartes();
}