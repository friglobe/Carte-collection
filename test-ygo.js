process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function testRecherche() {
  const reponse = await fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=blue-eyes', {
    headers: {
      'User-Agent': 'CarteCollectionApp/1.0',
      'Accept': 'application/json'
    }
  });
  const resultat = await reponse.json();
  console.log('--- RECHERCHE PAR NOM ---');
  console.log(JSON.stringify(resultat.data[0], null, 2));
}

async function testExtensions() {
  const reponse = await fetch('https://db.ygoprodeck.com/api/v7/cardsets.php', {
    headers: {
      'User-Agent': 'CarteCollectionApp/1.0',
      'Accept': 'application/json'
    }
  });
  const resultat = await reponse.json();
  console.log('--- LISTE DES EXTENSIONS (3 premières) ---');
  console.log(JSON.stringify(resultat.slice(0, 3), null, 2));
}

testRecherche();
testExtensions();