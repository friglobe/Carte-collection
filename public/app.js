let toutesLesCartes = [];
let toutesLesExtensions = [];
let totalParExtension = {};

document.getElementById('btn-toggle-recherche').addEventListener('click', () => {
    const zone = document.getElementById('zone-recherche');
    zone.hidden = !zone.hidden;

    const bouton = document.getElementById('btn-toggle-recherche');
    bouton.textContent = zone.hidden ? '🔍 Rechercher une carte' : '✖ Fermer la recherche';
});
// Ouvre automatiquement la recherche si on arrive depuis le bouton de l'accueil
const parametresUrl = new URLSearchParams(window.location.search);
if (parametresUrl.get('recherche')) {
    document.getElementById('zone-recherche').hidden = false;
    document.getElementById('btn-toggle-recherche').textContent = '✖ Fermer la recherche';
}
// --- Affichage de la collection ---

async function chargerCartes() {
    const [reponseCartes, reponseExtensions] = await Promise.all([
        fetch('/cartes'),
        fetch('/extensions?tous=1')
    ]);
    toutesLesCartes = await reponseCartes.json();
    const extensions = await reponseExtensions.json();

    totalParExtension = {};
    extensions.forEach(extension => {
        totalParExtension[extension.nom] = extension.total;
    });

    remplirFiltreExtensions();
    afficherCartes(toutesLesCartes);
}
chargerCartes();

function remplirFiltreExtensions() {
    const selecteur = document.getElementById('filtre-extension');
    const extensionSelectionnee = selecteur.value;

    const extensions = [...new Set(toutesLesCartes.map(carte => carte.extension).filter(Boolean))].sort();

    selecteur.innerHTML = '<option value="">Toutes les extensions</option>';
    extensions.forEach(extension => {
        const option = document.createElement('option');
        option.value = extension;
        option.textContent = extension;
        selecteur.appendChild(option);
    });

    selecteur.value = extensionSelectionnee;
}

document.getElementById('filtre-extension').addEventListener('change', (event) => {
    const extensionChoisie = event.target.value;

    const cartesFiltrees = extensionChoisie
        ? toutesLesCartes.filter(carte => carte.extension === extensionChoisie)
        : toutesLesCartes;

    afficherCartes(cartesFiltrees, extensionChoisie);
});

function afficherCartes(cartes, extensionFiltree = '') {
    const conteneur = document.getElementById('liste-cartes');
    conteneur.innerHTML = '';

    let valeurTotale = 0;
    let nombreExemplaires = 0;

    cartes.forEach(carte => {
        valeurTotale += (carte.valeur_estimee || 0) * carte.quantite;
        nombreExemplaires += carte.quantite;

        const div = document.createElement('div');
        div.className = 'carte';
        div.innerHTML = `
            ${carte.image_url ? `<img src="${carte.image_url}" alt="${carte.nom}">` : ''}
            <h3>${carte.nom}</h3>
            <p>${carte.jeu} - ${carte.extension || '?'}</p>
            <p>Rareté: ${carte.rarete || '?'} | Quantité: ${carte.quantite} ${carte.foil ? '✨ Foil' : ''}</p>
            ${carte.valeur_estimee ? `<p class="prix">${carte.valeur_estimee.toFixed(2)} € / unité</p>` : ''}
            <button class="btn-supprimer">Supprimer</button>
            `;

        div.querySelector('.btn-supprimer').addEventListener('click', async () => {
            await fetch(`/cartes/${carte.id}`, { method: 'DELETE' });
            chargerCartes();
        });

        conteneur.appendChild(div);
    });

    let texteStats = `${cartes.length} carte(s) différente(s) • ${nombreExemplaires} exemplaire(s) • Valeur estimée : ${valeurTotale.toFixed(2)} €`;

    if (extensionFiltree && totalParExtension[extensionFiltree]) {
        texteStats += ` • ${nombreExemplaires} / ${totalParExtension[extensionFiltree]} cartes de l'extension possédées`;
    }

    document.getElementById('stats-collection').textContent = texteStats;
}

// --- Recherche par extension ---

async function chargerExtensions() {
    const reponse = await fetch('/extensions');
    toutesLesExtensions = await reponse.json();
    afficherVignettesExtensions(toutesLesExtensions);
}
chargerExtensions();

function afficherVignettesExtensions(extensions) {
    const conteneur = document.getElementById('extensions-vignettes');
    conteneur.innerHTML = '';

    extensions.forEach(extension => {
        const div = document.createElement('div');
        div.className = 'vignette-extension';
        div.innerHTML = `
            <img src="${extension.icone}" alt="${extension.nom}">
            <p>${extension.nom}</p>
        `;
        div.addEventListener('click', () => rechercherParExtension(extension.code));
        conteneur.appendChild(div);
    });
}

document.getElementById('recherche-extension-filtre').addEventListener('input', (event) => {
    const texteRecherche = event.target.value.toLowerCase();
    const extensionsFiltrees = toutesLesExtensions.filter(extension =>
        extension.nom.toLowerCase().includes(texteRecherche)
    );
    afficherVignettesExtensions(extensionsFiltrees);
});

async function rechercherParExtension(code) {
    const reponse = await fetch(`/cartes/recherche?extension=${code}`);
    const resultats = await reponse.json();

    const conteneur = document.getElementById('resultats-recherche');
    conteneur.innerHTML = '';

    resultats.forEach(carte => {
        const div = document.createElement('div');
        div.className = 'resultat-carte';
        div.innerHTML = `
            <img src="${carte.image_url}" alt="${carte.nom}">
            <p>${carte.nom}<br>${carte.extension}</p>
        `;
        div.addEventListener('click', async () => {
            const quantite = prompt(`Combien d'exemplaires de "${carte.nom}" veux-tu ajouter ?`, '1');
            if (quantite === null) return;

            const estFoil = confirm(`Est-ce une version foil (brillante) de "${carte.nom}" ?`);
            const valeurEstimee = estFoil ? (carte.prix_eur_foil || carte.prix_eur) : carte.prix_eur;

            await fetch('/cartes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...carte, quantite, foil: estFoil, valeur_estimee: valeurEstimee })
            });

            conteneur.innerHTML = '';
            chargerCartes();
        });
        conteneur.appendChild(div);
    });
}