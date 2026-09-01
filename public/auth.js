async function verifierConnexion() {
  const reponse = await fetch('/moi');
  const resultat = await reponse.json();
  if (!resultat.connecte) {
    window.location.href = 'connexion.html';
    return false;
  }
  return true;
}

function initialiserDeconnexion() {
  const bouton = document.getElementById('btn-deconnexion');
  if (!bouton) return;
  bouton.addEventListener('click', async () => {
    await fetch('/deconnexion', { method: 'POST' });
    window.location.href = 'connexion.html';
  });
}