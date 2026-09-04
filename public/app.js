let toutesLesCartes = [];
let totalParExtension = {};
let carteSelectionnee = null;

document.addEventListener('DOMContentLoaded', async () => {
  const connecte = await verifierConnexion();
  if (!connecte) return;
  initialiserDeconnexion();

  document.getElementById('filtre-extension').addEventListener('change', (e) => {
    afficherCartes(toutesLesCartes, e.target.value);
  });
  document.getElementById('filtre-foil').addEventListener('change', () => {
    afficherCartes(toutesLesCartes, document.getElementById('filtre-extension').value);
  });
  document.getElementById('tri-collection').addEventListener('change', () => {
    afficherCartes(toutesLesCartes, document.getElementById('filtre-extension').value);
  });

  document.getElementById('modal-fermer').addEventListener('click', fermerModal);
  document.getElementById('modal-confirmer').addEventListener('click', confirmerModification);
  document.getElementById('modal-foil-toggle').addEventListener('click', basculerFoil);

  chargerCartes();
});

async function chargerCartes() {
  const filtreActuel = document.getElementById('filtre-extension').value;

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

  const select = document.getElementById('filtre-extension');
  const filtreEncoreValide = [...select.options].some(option => option.value === filtreActuel);
  if (filtreEncoreValide) {
    select.value = filtreActuel;
  }

  afficherCartes(toutesLesCartes, select.value);
}

function remplirFiltreExtensions() {
  const select = document.getElementById('filtre-extension');
  const extensionsPossedees = [...new Set(toutesLesCartes.map(c => c.extension))].filter(Boolean).sort();
  select.innerHTML = '<option value="">Toutes les extensions</option>' +
    extensionsPossedees.map(ext => `<option value="${ext}">${ext}</option>`).join('');
}

function trierCartes(cartes, critere) {
  const cartesTriees = [...cartes];
  switch (critere) {
    case 'numero':
      cartesTriees.sort((a, b) => String(a.numero).localeCompare(String(b.numero), undefined, { numeric: true }));
      break;
    case 'prix-desc':
      cartesTriees.sort((a, b) => (b.valeur_estimee || 0) - (a.valeur_estimee || 0));
      break;
    case 'prix-asc':
      cartesTriees.sort((a, b) => (a.valeur_estimee || 0) - (b.valeur_estimee || 0));
      break;
    default:
      cartesTriees.sort((a, b) => a.nom.localeCompare(b.nom));
  }
  return cartesTriees;
}

function afficherCartes(cartes, extensionFiltree = '') {
  const conteneur = document.getElementById('liste-cartes');
  let cartesAffichees = extensionFiltree
    ? cartes.filter(c => c.extension === extensionFiltree)
    : cartes;

  const filtreFoil = document.getElementById('filtre-foil').value;
  if (filtreFoil === 'foil') {
    cartesAffichees = cartesAffichees.filter(c => c.foil);
  } else if (filtreFoil === 'normal') {
    cartesAffichees = cartesAffichees.filter(c => !c.foil);
  }

  const critereTri = document.getElementById('tri-collection').value;
  cartesAffichees = trierCartes(cartesAffichees, critereTri);

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

function ouvrirModalModification(carte) {
  carteSelectionnee = carte;

  const image = document.getElementById('modal-image');
  image.src = carte.image_url || '';
  image.hidden = !carte.image_url;

  document.getElementById('modal-nom').textContent = carte.nom;
  document.getElementById('modal-info').textContent = `${carte.extension} - #${carte.numero} - ${carte.rarete || '?'}`;
  document.getElementById('modal-quantite').value = carte.quantite;

  const toggle = document.getElementById('modal-foil-toggle');
  toggle.dataset.foil = carte.foil ? 'true' : 'false';
  toggle.querySelector('.toggle-texte').textContent = carte.foil ? 'Foil' : 'Normal';

  mettreAJourPrixModal();

  document.getElementById('modal-ajout-carte').hidden = false;
}

function fermerModal() {
  document.getElementById('modal-ajout-carte').hidden = true;
  carteSelectionnee = null;
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
  const prix = carteSelectionnee.valeur_estimee;
  document.getElementById('modal-prix').textContent = prix ? `Valeur actuelle : ${prix.toFixed(2)} €` : 'Valeur actuelle : ?';
}

async function confirmerModification() {
  if (!carteSelectionnee) return;
  const quantite = Number(document.getElementById('modal-quantite').value);
  if (!quantite || quantite < 1) return;

  const estFoil = document.getElementById('modal-foil-toggle').dataset.foil === 'true';

  await fetch(`/cartes/${carteSelectionnee.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...carteSelectionnee, quantite, foil: estFoil })
  });

  fermerModal();
  chargerCartes();
}