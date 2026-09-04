let toutesLesExtensions = [];
let cartesExtensionActuelle = [];
let carteSelectionnee = null;

document.addEventListener('DOMContentLoaded', async () => {
  const connecte = await verifierConnexion();
  if (!connecte) return;
  initialiserDeconnexion();

  document.getElementById('recherche-extension-filtre').addEventListener('input', (e) => {
    afficherVignettesExtensions(e.target.value);
  });

  document.getElementById('recherche-nom-carte').addEventListener('input', (e) => {
    filtrerResultatsParNom(e.target.value);
  });

  document.getElementById('modal-fermer').addEventListener('click', fermerModal);
  document.getElementById('modal-confirmer').addEventListener('click', confirmerAjout);
  document.getElementById('modal-foil-toggle').addEventListener('click', basculerFoil);

  document.getElementById('btn-ajout-masse').addEventListener('click', ajouterNumerosEnMasse);

  chargerExtensions();
});

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
  cartesExtensionActuelle = cartes;
  document.getElementById('recherche-nom-carte').value = '';
  afficherResultatsRecherche(cartesExtensionActuelle);
}

function afficherResultatsRecherche(cartes) {
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

function filtrerResultatsParNom(texte) {
  const texteMinuscule = texte.toLowerCase();
  const cartesFiltrees = cartesExtensionActuelle.filter(carte =>
    carte.nom.toLowerCase().includes(texteMinuscule)
  );
  afficherResultatsRecherche(cartesFiltrees);
}

async function ajouterNumerosEnMasse() {
  const champ = document.getElementById('numeros-a-ajouter');
  const message = document.getElementById('message-ajout-masse');

  if (cartesExtensionActuelle.length === 0) {
    message.textContent = "Choisis d'abord une extension ci-dessus.";
    return;
  }

  const numerosDemandes = champ.value.split(',').map(n => n.trim()).filter(Boolean);

  if (numerosDemandes.length === 0) {
    message.textContent = 'Entre au moins un numéro.';
    return;
  }

  const cartesTrouvees = [];
  const numerosIntrouvables = [];

  numerosDemandes.forEach(numero => {
    const carte = cartesExtensionActuelle.find(c => String(c.numero) === numero);
    if (carte) {
      cartesTrouvees.push(carte);
    } else {
      numerosIntrouvables.push(numero);
    }
  });

  await Promise.all(cartesTrouvees.map(carte => fetch('/cartes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...carte, quantite: 1, foil: false, valeur_estimee: carte.prix_eur })
  })));

  let texteMessage = `${cartesTrouvees.length} carte(s) ajoutée(s).`;
  if (numerosIntrouvables.length > 0) {
    texteMessage += ` Numéro(s) introuvable(s) dans cette extension : ${numerosIntrouvables.join(', ')}.`;
  }
  message.textContent = texteMessage;

  champ.value = '';
}

function ouvrirModalAjout(carte) {
  carteSelectionnee = carte;

  const image = document.getElementById('modal-image');
  image.src = carte.image_url || '';
  image.hidden = !carte.image_url;

  document.getElementById('modal-nom').textContent = carte.nom;
  document.getElementById('modal-info').textContent = `${carte.extension} - #${carte.numero} - ${carte.rarete || '?'}`;
  document.getElementById('modal-quantite').value = 1;

  const toggle = document.getElementById('modal-foil-toggle');
  toggle.dataset.foil = 'false';
  toggle.querySelector('.toggle-texte').textContent = 'Normal';

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
  const estFoil = document.getElementById('modal-foil-toggle').dataset.foil === 'true';
  const prix = estFoil ? carteSelectionnee.prix_eur_foil : carteSelectionnee.prix_eur;
  document.getElementById('modal-prix').textContent = prix ? `Prix estimé : ${prix} €` : 'Prix estimé : ?';
}

async function confirmerAjout() {
  if (!carteSelectionnee) return;
  const quantite = Number(document.getElementById('modal-quantite').value);
  if (!quantite || quantite < 1) return;

  const estFoil = document.getElementById('modal-foil-toggle').dataset.foil === 'true';
  const valeurEstimee = estFoil ? carteSelectionnee.prix_eur_foil : carteSelectionnee.prix_eur;

  await fetch('/cartes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...carteSelectionnee, quantite, foil: estFoil, valeur_estimee: valeurEstimee })
  });

  fermerModal();
}