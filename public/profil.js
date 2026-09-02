const AVATARS_DISPONIBLES = ['🙂', '😎', '🧙', '🐉', '🃏', '⚡', '🔥', '🌟', '🎯', '🦊'];

document.addEventListener('DOMContentLoaded', async () => {
  const connecte = await verifierConnexion();
  if (!connecte) return;
  initialiserDeconnexion();

  await chargerProfil();
  initialiserToggleTheme();

  document.getElementById('btn-theme-sombre').addEventListener('click', basculerTheme);
  document.getElementById('form-mot-de-passe').addEventListener('submit', changerMotDePasse);

  document.getElementById('btn-supprimer-compte').addEventListener('click', () => {
    document.getElementById('confirmation-suppression').hidden = false;
  });
  document.getElementById('btn-annuler-suppression').addEventListener('click', () => {
    document.getElementById('confirmation-suppression').hidden = true;
  });
  document.getElementById('btn-confirmer-suppression').addEventListener('click', supprimerCompte);
});

async function chargerProfil() {
  const reponse = await fetch('/profil');
  const profil = await reponse.json();

  document.getElementById('avatar-actuel').textContent = profil.avatar;

  const conteneurChoix = document.getElementById('choix-avatars');
  conteneurChoix.innerHTML = AVATARS_DISPONIBLES.map(emoji => `
    <button type="button" class="choix-avatar" data-emoji="${emoji}">${emoji}</button>
  `).join('');

  document.querySelectorAll('.choix-avatar').forEach(bouton => {
    bouton.addEventListener('click', () => choisirAvatar(bouton.dataset.emoji));
  });
}

async function choisirAvatar(emoji) {
  await fetch('/profil/avatar', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ avatar: emoji })
  });
  document.getElementById('avatar-actuel').textContent = emoji;
}

async function changerMotDePasse(e) {
  e.preventDefault();
  const donnees = Object.fromEntries(new FormData(e.target));
  const message = document.getElementById('message-mot-de-passe');

  const reponse = await fetch('/profil/mot-de-passe', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(donnees)
  });
  const resultat = await reponse.json();

  if (!reponse.ok) {
    message.style.color = 'var(--danger)';
    message.textContent = resultat.erreur;
    return;
  }

  message.style.color = 'green';
  message.textContent = 'Mot de passe mis à jour !';
  e.target.reset();
}

async function supprimerCompte() {
  await fetch('/profil', { method: 'DELETE' });
  window.location.href = 'connexion.html';
}

function initialiserToggleTheme() {
  const bouton = document.getElementById('btn-theme-sombre');
  const estSombre = document.documentElement.getAttribute('data-theme') === 'sombre';
  mettreAJourBoutonTheme(bouton, estSombre);
}

function basculerTheme() {
  const bouton = document.getElementById('btn-theme-sombre');
  const estSombreActuellement = document.documentElement.getAttribute('data-theme') === 'sombre';
  const nouvelEtat = !estSombreActuellement;

  if (nouvelEtat) {
    document.documentElement.setAttribute('data-theme', 'sombre');
    localStorage.setItem('theme', 'sombre');
  } else {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('theme', 'clair');
  }

  mettreAJourBoutonTheme(bouton, nouvelEtat);
}

function mettreAJourBoutonTheme(bouton, estSombre) {
  bouton.dataset.actif = estSombre;
  bouton.querySelector('.toggle-texte').textContent = estSombre ? 'Sombre' : 'Clair';
}