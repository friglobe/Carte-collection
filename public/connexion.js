const ongletConnexion = document.getElementById('onglet-connexion');
const ongletInscription = document.getElementById('onglet-inscription');
const formConnexion = document.getElementById('form-connexion');
const formInscription = document.getElementById('form-inscription');
const message = document.getElementById('message-connexion');

ongletConnexion.addEventListener('click', () => {
  ongletConnexion.classList.add('actif');
  ongletInscription.classList.remove('actif');
  formConnexion.hidden = false;
  formInscription.hidden = true;
  message.textContent = '';
});

ongletInscription.addEventListener('click', () => {
  ongletInscription.classList.add('actif');
  ongletConnexion.classList.remove('actif');
  formInscription.hidden = false;
  formConnexion.hidden = true;
  message.textContent = '';
});

formConnexion.addEventListener('submit', async (e) => {
  e.preventDefault();
  const donnees = Object.fromEntries(new FormData(formConnexion));
  const reponse = await fetch('/connexion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(donnees)
  });
  const resultat = await reponse.json();
  if (!reponse.ok) {
    message.textContent = resultat.erreur;
    return;
  }
  window.location.href = 'index.html';
});

formInscription.addEventListener('submit', async (e) => {
  e.preventDefault();
  const donnees = Object.fromEntries(new FormData(formInscription));
  const reponse = await fetch('/inscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(donnees)
  });
  const resultat = await reponse.json();
  if (!reponse.ok) {
    message.textContent = resultat.erreur;
    return;
  }
  window.location.href = 'index.html';
});