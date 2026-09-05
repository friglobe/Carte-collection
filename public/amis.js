document.addEventListener('DOMContentLoaded', async () => {
  const connecte = await verifierConnexion();
  if (!connecte) return;
  initialiserDeconnexion();

  document.getElementById('btn-demande-ami').addEventListener('click', envoyerDemandeAmi);

  chargerAmis();
});

async function envoyerDemandeAmi() {
  const champ = document.getElementById('nom-utilisateur-ami');
  const message = document.getElementById('message-demande-ami');
  const nom_utilisateur = champ.value.trim();

  if (!nom_utilisateur) {
    message.textContent = "Entre un nom d'utilisateur.";
    return;
  }

  const reponse = await fetch('/amis/demande', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nom_utilisateur })
  });
  const resultat = await reponse.json();

  if (!reponse.ok) {
    message.textContent = resultat.erreur;
    return;
  }

  message.textContent = `Demande envoyée à ${nom_utilisateur}.`;
  champ.value = '';
  chargerAmis();
}

async function chargerAmis() {
  const reponse = await fetch('/amis');
  const { amis, demandesRecues, demandesEnvoyees } = await reponse.json();

  const sectionRecues = document.getElementById('section-demandes-recues');
  sectionRecues.hidden = demandesRecues.length === 0;
  document.getElementById('liste-demandes-recues').innerHTML = demandesRecues.map(demande => `
    <div class="carte-ami">
      <span class="avatar-ami">${demande.avatar}</span>
      <span class="nom-ami">${demande.nom_utilisateur}</span>
      <div class="actions-ami">
        <button class="btn-accepter-ami" data-id="${demande.id}">Accepter</button>
        <button class="btn-refuser-ami" data-id="${demande.id}">Refuser</button>
      </div>
    </div>
  `).join('');

  const sectionEnvoyees = document.getElementById('section-demandes-envoyees');
  sectionEnvoyees.hidden = demandesEnvoyees.length === 0;
  document.getElementById('liste-demandes-envoyees').innerHTML = demandesEnvoyees.map(demande => `
    <div class="carte-ami">
      <span class="avatar-ami">${demande.avatar}</span>
      <span class="nom-ami">${demande.nom_utilisateur}</span>
      <p class="statut-attente">En attente...</p>
      <div class="actions-ami">
        <button class="btn-annuler-ami" data-id="${demande.id}">Annuler</button>
      </div>
    </div>
  `).join('');

  document.getElementById('message-aucun-ami').hidden = amis.length > 0;
  document.getElementById('liste-amis').innerHTML = amis.map(ami => `
    <div class="carte-ami" data-ami-id="${ami.ami_id}">
      <span class="avatar-ami">${ami.avatar}</span>
      <span class="nom-ami">${ami.nom_utilisateur}</span>
      <div class="stats-ami" id="stats-ami-${ami.ami_id}">
        <button class="btn-voir-stats" data-ami-id="${ami.ami_id}">Voir sa collection</button>
      </div>
      <div class="actions-ami">
        <button class="btn-retirer-ami" data-id="${ami.id}">Retirer</button>
      </div>
    </div>
  `).join('');

  document.querySelectorAll('.btn-accepter-ami').forEach(bouton => {
    bouton.addEventListener('click', async () => {
      await fetch(`/amis/${bouton.dataset.id}/accepter`, { method: 'PUT' });
      chargerAmis();
    });
  });

  document.querySelectorAll('.btn-refuser-ami, .btn-annuler-ami, .btn-retirer-ami').forEach(bouton => {
    bouton.addEventListener('click', async () => {
      await fetch(`/amis/${bouton.dataset.id}`, { method: 'DELETE' });
      chargerAmis();
    });
  });

  document.querySelectorAll('.btn-voir-stats').forEach(bouton => {
    bouton.addEventListener('click', () => afficherStatsAmi(bouton.dataset.amiId));
  });
}

async function afficherStatsAmi(amiId) {
  const conteneur = document.getElementById(`stats-ami-${amiId}`);
  conteneur.innerHTML = 'Chargement...';

  const reponse = await fetch(`/amis/${amiId}/stats`);
  const resultat = await reponse.json();

  if (!reponse.ok) {
    conteneur.innerHTML = `<p class="message-erreur">${resultat.erreur}</p>`;
    return;
  }

  conteneur.innerHTML = `
    <p><strong>${resultat.nombreCartesDifferentes}</strong> cartes différentes</p>
    <p><strong>${resultat.nombreExemplaires}</strong> exemplaires au total</p>
    <p><strong>${resultat.valeurTotale.toFixed(2)} €</strong> de valeur estimée</p>
  `;
}
