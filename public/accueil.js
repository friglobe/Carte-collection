async function chargerTableauDeBord() {
    const reponse = await fetch('/cartes');
    const cartes = await reponse.json();

    const conteneur = document.getElementById('stats-dashboard');

    if (cartes.length === 0) {
        conteneur.innerHTML = '<p>Ta collection est vide pour le moment. Va sur "Ma collection" pour ajouter des cartes !</p>';
        return;
    }

    let valeurTotale = 0;
    let nombreExemplaires = 0;
    let nombreFoil = 0;
    const parExtension = {};
    let carteLaPlusChere = null;

    cartes.forEach(carte => {
        valeurTotale += (carte.valeur_estimee || 0) * carte.quantite;
        nombreExemplaires += carte.quantite;

        if (carte.foil) {
            nombreFoil += carte.quantite;
        }

        const extension = carte.extension || 'Extension inconnue';
        parExtension[extension] = (parExtension[extension] || 0) + carte.quantite;

        if (!carteLaPlusChere || (carte.valeur_estimee || 0) > (carteLaPlusChere.valeur_estimee || 0)) {
            carteLaPlusChere = carte;
        }
    });

    const extensionsTriees = Object.entries(parExtension).sort((a, b) => b[1] - a[1]);

    conteneur.innerHTML = `
        <div class="cartes-stats">
            <div class="stat-tuile">
                <p class="stat-valeur">${cartes.length}</p>
                <p class="stat-label">Cartes différentes</p>
            </div>
            <div class="stat-tuile">
                <p class="stat-valeur">${nombreExemplaires}</p>
                <p class="stat-label">Exemplaires au total</p>
            </div>
            <div class="stat-tuile">
                <p class="stat-valeur">${valeurTotale.toFixed(2)} €</p>
                <p class="stat-label">Valeur estimée</p>
            </div>
            <div class="stat-tuile">
                <p class="stat-valeur">✨ ${nombreFoil}</p>
                <p class="stat-label">Exemplaires foil</p>
            </div>
        </div>

        <div class="dashboard-colonnes">
            <div class="carte-mise-en-avant">
                <h3>Carte la plus chère</h3>
                ${carteLaPlusChere.image_url ? `<img src="${carteLaPlusChere.image_url}" alt="${carteLaPlusChere.nom}">` : ''}
                <p><strong>${carteLaPlusChere.nom}</strong></p>
                <p>${(carteLaPlusChere.valeur_estimee || 0).toFixed(2)} € / unité</p>
            </div>

            <div class="repartition-extensions">
                <h3>Répartition par extension</h3>
                <ul>
                    ${extensionsTriees.map(([nom, quantite]) => `<li><span>${nom}</span><span>${quantite}</span></li>`).join('')}
                </ul>
            </div>
        </div>
    `;
}
chargerTableauDeBord();