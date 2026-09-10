(function(){
 const IDEAS={
  spring:[
   ['🌱','Nettoyage de printemps','Profite du retour du beau temps pour faire une petite tournée préventive.','Vérifie les filtres, les détecteurs, les drains extérieurs et les gouttières. Commence par 15 minutes.'],
   ['🪟','Aérer la maison','Après l’hiver, une bonne aération aide à renouveler l’air intérieur.','Ouvre quelques fenêtres pendant 10 à 15 minutes si la météo le permet et vérifie les moustiquaires.'],
   ['🌧️','Inspecter les gouttières','La fonte des neiges peut révéler des obstructions ou des fuites.','Regarde si l’eau s’écoule librement et si les descentes dirigent l’eau loin des fondations.'],
   ['💧','Vérifier la pompe de puisard','Le printemps est une période critique pour les infiltrations d’eau.','Verse doucement un peu d’eau dans le puisard pour vérifier que la pompe démarre et évacue correctement.'],
   ['🚨','Tester les détecteurs','Un petit test aujourd’hui peut éviter un gros risque plus tard.','Teste les détecteurs de fumée et de CO et remplace les piles faibles.'],
   ['🌿','Préparer le terrain','Les premières semaines du printemps sont idéales pour repérer les dommages hivernaux.','Fais le tour du terrain : branches cassées, clôtures, drains, terrasse et zones détrempées.'],
   ['🏠','Observer les fondations','La fonte peut faire apparaître des fissures ou des traces d’humidité.','Inspecte visuellement le sous-sol et le pourtour des fondations pour repérer humidité ou fissures nouvelles.'],
   ['🧹','Nettoyer les entrées d’air','Les grilles extérieures peuvent accumuler poussière et débris.','Nettoie délicatement les prises et sorties d’air accessibles et vérifie qu’elles ne sont pas bloquées.'],
   ['🛠️','Faire l’inventaire des petits travaux','Le printemps est un bon moment pour planifier avant la haute saison.','Note trois petits travaux à régler ce mois-ci et ajoute-les à Nuvabri.'],
   ['🌼','Préparer la terrasse','Un contrôle rapide évite les surprises au premier BBQ.','Inspecte les planches, rampes, marches et vis avant de remettre le mobilier extérieur.'],
   ['🚿','Vérifier les robinets extérieurs','Le gel peut avoir causé des dommages invisibles.','Ouvre progressivement les robinets extérieurs et vérifie s’il y a une fuite à l’intérieur ou autour du raccord.'],
   ['🧽','Nettoyer un filtre aujourd’hui','Un seul filtre propre peut déjà améliorer le rendement d’un appareil.','Choisis aujourd’hui le filtre de la thermopompe, de l’échangeur d’air ou de la hotte et nettoie-le selon le manuel.']
  ],
  summer:[
   ['☀️','Vérifier l’ombre et la chaleur','Une maison plus fraîche réduit l’effort de climatisation.','Ferme stores ou rideaux du côté ensoleillé pendant les heures les plus chaudes.'],
   ['🌡️','Nettoyer le filtre de climatisation','Un filtre propre aide la thermopompe à mieux travailler pendant les journées chaudes.','Vérifie le filtre intérieur et nettoie-le ou remplace-le selon le manuel du fabricant.'],
   ['🏊','Faire un contrôle piscine','La chaleur accélère les variations de l’eau.','Vérifie visuellement la clarté, la circulation et le niveau d’eau avant d’ajouter un produit.'],
   ['💦','Surveiller les fuites extérieures','Les tuyaux et raccords sont très sollicités l’été.','Fais le tour des boyaux, robinets et raccords extérieurs pour repérer les petites fuites.'],
   ['🔥','Inspecter le BBQ','Quelques minutes de contrôle avant la cuisson peuvent éviter des problèmes.','Vérifie le bac à graisse, les brûleurs et l’état général des raccords avant la prochaine utilisation.'],
   ['🪴','Arroser intelligemment','Le matin limite l’évaporation et aide les plantes à mieux profiter de l’eau.','Arrose tôt le matin plutôt qu’en pleine chaleur lorsque c’est possible.'],
   ['🦟','Éliminer l’eau stagnante','Les moustiques profitent des petites accumulations d’eau.','Vide les soucoupes, jouets, bâches et contenants qui gardent de l’eau après la pluie.'],
   ['🏡','Inspecter la terrasse','Le soleil et l’humidité peuvent faire bouger le bois et les fixations.','Vérifie rapidement rampes, marches, vis et planches qui semblent instables.'],
   ['🚪','Lubrifier les mécanismes extérieurs','La chaleur et la poussière usent les mécanismes mobiles.','Vérifie les charnières et mécanismes accessibles de porte ou remise et lubrifie seulement si le fabricant le recommande.'],
   ['🍋','Limonade maison','Une idée simple pour profiter du patio.','Mélange 1 L d’eau, le jus de 4 citrons et sucre au goût.'],
   ['🌙','Profiter de la fraîcheur du soir','La température extérieure peut aider à rafraîchir naturellement la maison.','Si l’air extérieur est plus frais et l’humidité raisonnable, aère brièvement en soirée.'],
   ['🧼','Nettoyer les moustiquaires','Des moustiquaires propres laissent mieux circuler l’air.','Passe doucement l’aspirateur ou rince-les selon leur matériau, puis laisse-les sécher complètement.']
  ],
  autumn:[
   ['🍂','Ramasser les feuilles près des drains','Les feuilles peuvent bloquer rapidement l’évacuation de l’eau.','Dégage les drains, margelles et descentes de gouttières autour de la maison.'],
   ['🔥','Préparer le chauffage','Avant les grands froids, vérifie que ton système est prêt.','Nettoie ou remplace les filtres applicables et planifie l’entretien si nécessaire.'],
   ['🚨','Tester les détecteurs','Avec le retour du chauffage, c’est un bon moment pour vérifier fumée et CO.','Appuie sur le bouton test et vérifie la date de remplacement de chaque détecteur.'],
   ['🌧️','Nettoyer les gouttières','Les feuilles d’automne peuvent provoquer des débordements et de la glace plus tard.','Retire les feuilles si tu peux le faire en sécurité et vérifie l’écoulement des descentes.'],
   ['🪟','Vérifier les coupe-froid','Une petite fuite d’air devient coûteuse quand le froid arrive.','Passe la main autour des portes et fenêtres lors d’une journée fraîche pour repérer les courants d’air.'],
   ['🚿','Fermer les robinets extérieurs','Avant le gel, protège les conduites extérieures.','Débranche les boyaux, ferme l’alimentation si ton installation le prévoit et suis la procédure adaptée à ta maison.'],
   ['🧱','Inspecter la cheminée','La saison des feux approche.','Si tu utilises un appareil à combustion solide, assure-toi que l’entretien et l’inspection requis sont à jour.'],
   ['🏠','Regarder le toit depuis le sol','Une inspection visuelle peut révéler des dommages avant l’hiver.','Depuis un endroit sécuritaire, cherche bardeaux déplacés, solins suspects ou accumulation de débris.'],
   ['❄️','Préparer le déneigement','Un peu de préparation évite le chaos à la première neige.','Vérifie pelle, souffleuse, sel ou abrasif et l’espace de rangement nécessaire.'],
   ['☕','Chocolat chaud maison','Une recette réconfortante pour une soirée fraîche.','Pour 2 tasses : 500 mL de lait, 2 c. à soupe de cacao, sucre au goût et un peu de vanille.'],
   ['🔋','Vérifier les batteries saisonnières','Le froid peut révéler une batterie déjà faible.','Passe en revue détecteurs, ouvre-porte de garage, équipements de loisir et lampes d’urgence.'],
   ['🧰','Rentrer les produits sensibles au gel','Certains produits se dégradent lorsqu’ils gèlent.','Vérifie peintures, produits de piscine, nettoyants et liquides selon les indications sur leurs étiquettes.']
  ],
  winter:[
   ['❄️','Dégager les sorties extérieures','La neige peut bloquer des ouvertures importantes.','Vérifie les sorties de sécheuse, échangeur d’air, thermopompe et autres évents accessibles.'],
   ['🔥','Surveiller le chauffage','Un comportement inhabituel mérite d’être remarqué tôt.','Écoute les bruits inhabituels et vérifie que les pièces chauffent normalement.'],
   ['💧','Observer la condensation','Trop d’humidité sur les fenêtres peut signaler un problème d’humidité intérieure.','Essuie la condensation importante et ajuste l’humidité ou la ventilation au besoin.'],
   ['🚨','Tester fumée et CO','L’hiver est une période importante pour la sécurité liée au chauffage.','Teste les détecteurs et assure-toi qu’ils ne sont pas obstrués ou trop vieux.'],
   ['🏠','Surveiller la neige sur le toit','Certaines accumulations inhabituelles méritent une attention particulière.','Observe depuis le sol les accumulations importantes et signes de glace; évite de monter sur un toit enneigé.'],
   ['🚪','Dégager portes et sorties','Les sorties doivent rester utilisables même après une grosse bordée.','Garde les portes, escaliers et issues secondaires libres de neige et de glace.'],
   ['🧂','Prévenir la glace aux marches','Une petite plaque de glace suffit pour provoquer une chute.','Dégage l’eau et utilise un abrasif ou produit approprié lorsque nécessaire.'],
   ['🌡️','Vérifier une pièce froide','Une pièce anormalement froide peut révéler un problème simple.','Vérifie que les registres ou plinthes ne sont pas bloqués par un meuble ou des rideaux.'],
   ['🧺','Nettoyer le filtre de sécheuse','En hiver, on utilise souvent davantage la sécheuse.','Nettoie le filtre après chaque cycle et vérifie périodiquement que la sortie extérieure reste dégagée.'],
   ['🔦','Préparer une panne de courant','Une petite préparation est utile pendant les tempêtes.','Regroupe lampes, piles, chargeurs portatifs et une source d’information accessible.'],
   ['☕','Ambiance cocooning','Une petite soirée maison avec boisson chaude et lumière douce.','Prépare une boisson chaude et profite d’un moment tranquille.'],
   ['🚗','Dégager le monoxyde autour des véhicules','La neige peut obstruer un tuyau d’échappement.','Avant de démarrer un véhicule entouré de neige, vérifie toujours que l’échappement est complètement dégagé.']
  ],
  christmas:[
   ['🎄','Vérifier les lumières de Noël','Les décorations doivent rester belles et sécuritaires.','Inspecte les fils, prises et rallonges et remplace tout élément endommagé.'],
   ['🔥','Garder les décorations loin des sources de chaleur','Les décorations sèches peuvent devenir inflammables.','Laisse un espace sécuritaire autour des chaufferettes, foyers, plinthes et chandelles.'],
   ['🎁','Préparer un coin cadeaux','Un peu d’organisation réduit le stress avant les Fêtes.','Choisis un espace pour regrouper papier, ruban, ciseaux et étiquettes.'],
   ['☕','Chocolat chaud des Fêtes','Une version festive du chocolat chaud pour décembre.','Ajoute cannelle, mini-guimauves ou copeaux de chocolat.'],
   ['🕯️','Sécurité des chandelles','Une chandelle oubliée peut devenir dangereuse rapidement.','Garde-les sur une surface stable, loin des tissus et éteins-les avant de quitter la pièce.'],
   ['🧊','Préparer l’entrée pour les invités','Une entrée sécuritaire est particulièrement importante pendant les rassemblements.','Dégage neige et glace et ajoute de l’abrasif si nécessaire.'],
   ['🍪','Préparer une recette simple','Une petite activité cuisine suffit pour créer une ambiance des Fêtes.','Choisis une recette courte et prépare les ingrédients avant de commencer.'],
   ['🔌','Éviter de surcharger les prises','Les décorations augmentent parfois beaucoup la demande électrique.','Répartis les appareils et respecte la capacité des rallonges et multiprises.'],
   ['🏡','Faire un mini-tour de la maison','Avant une période occupée, règle les petits irritants faciles.','Vérifie ampoules, détecteurs, entrée, salle de bain et cuisine en 10 minutes.'],
   ['🎶','Créer une soirée tranquille','Toutes les idées saisonnières n’ont pas besoin d’être des tâches.','Choisis une musique des Fêtes, baisse les lumières et profite simplement de la maison.'],
   ['🧹','Préparer la maison avant les visites','Une courte routine vaut mieux qu’un grand ménage stressant.','Concentre-toi sur entrée, cuisine, salle de bain et surfaces visibles.'],
   ['✨','Faire le bilan de l’année','Décembre est un bon moment pour regarder ce qui a été fait.','Regarde les tâches complétées dans Nuvabri et note deux priorités pour l’année prochaine.']
  ]
 };
 function seasonKey(d){const m=d.getMonth()+1;return m===12?'christmas':m>=3&&m<=5?'spring':m>=6&&m<=8?'summer':m>=9&&m<=11?'autumn':'winter'}
 function dayIndex(d,len){const start=new Date(d.getFullYear(),0,0),day=Math.floor((d-start)/86400000);return (day+d.getFullYear())%len}
 let current=null;
 function apply(){const d=new Date(),k=seasonKey(d),list=IDEAS[k]||[];if(!list.length)return;current=list[dayIndex(d,list.length)];const emoji=document.getElementById('se'),title=document.getElementById('it'),body=document.getElementById('ib'),details=document.getElementById('id');if(emoji)emoji.textContent=current[0];if(title)title.textContent=current[1];if(body)body.textContent=current[2];if(details){details.textContent=current[3];details.classList.add('hidden')}
   window.idea=function(){const box=document.getElementById('id');if(!box)return;box.textContent=current?.[3]||'';box.classList.toggle('hidden')};
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);else apply();
 setTimeout(apply,500);
})();