async function chargerCartes() {
    const reponse = await fetch('/cartes');
    const cartes = await reponse.json();

    const conteneur = document.getElementById('liste-cartes');
    conteneur.innerHTML = '';

    cartes.forEach(carte => {
        const div = document.createElement('div');
        div.className = 'carte';
        div.innerHTML = `
            <h3>${carte.nom}</h3>
            <p>${carte.jeu} - ${carte.extension || '?'}</p>
            <p>Rareté: ${carte.rarete || '?'} | Quantité: ${carte.quantite}</p>
            `;
        conteneur.appendChild(div);
    });
}
chargerCartes();

document.getElementById('btn-recherche').addEventListener('click', async () => {
    const terme = document.getElementById('recherche-nom').value;
    if (!terme) return;

    const reponse = await fetch(`/cartes/recherche?nom=${encodeURIComponent(terme)}`);
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

            await fetch('/cartes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...carte, quantite })
            });

            conteneur.innerHTML = '';
            document.getElementById('recherche-nom').value = '';
            chargerCartes();
        });
        conteneur.appendChild(div);
    });
});