(function(root){
  'use strict';
  // Suggestions only: choosing a line never supplies a guessed amount.
  const templates=[];
  function group(family,key,rows){
    for(const [id,label,category,frequency='monthly',essential=true] of rows)templates.push({id,label,category,family,key,frequency,essential:key==='incomes'?false:essential});
  }
  group('Travail et autres revenus','incomes',[
    ['salary','Salaire net','Salaire','biweekly'],['self','Travail autonome, net des frais et impôts','Travail autonome'],
    ['bonus','Prime ou commission nette','Primes et commissions','once'],['rental','Loyer reçu','Revenus locatifs'],
    ['investments','Intérêts ou dividendes reçus','Revenus de placements','quarterly'],['refund','Remboursement d’impôt','Remboursement d’impôt','once'],
    ['other-income','Autre revenu','Autre']
  ]);
  group('Famille, prestations et retraite','incomes',[
    ['canada-child','Allocation canadienne pour enfants','Allocations familiales'],['quebec-child','Allocation famille du Québec','Allocations familiales','quarterly'],
    ['parental','RQAP / congé parental','Prestations parentales','biweekly'],['employment','Assurance-emploi','Assurance-emploi','biweekly'],
    ['support-in','Pension alimentaire reçue','Pension alimentaire reçue'],['retirement','Pension / RRQ / Sécurité de la vieillesse','Retraite'],
    ['tax-credit','Crédit TPS/TVH ou solidarité','Crédits et prestations','quarterly'],['scholarship','Bourse d’études','Bourses','once']
  ]);
  group('Logement et services','bills',[
    ['rent','Loyer','Maison'],['mortgage','Paiement hypothécaire','Maison','biweekly'],['condo','Frais de copropriété','Maison'],
    ['hydro','Électricité / chauffage','Énergie'],['internet','Internet','Télécommunications'],['phone','Téléphone cellulaire','Télécommunications'],
    ['home-insurance','Assurance habitation','Assurances'],['home-help','Ménage / entretien régulier','Services à domicile','monthly',false]
  ]);
  group('Vie courante','envelopes',[
    ['food','Épicerie','Épicerie'],['restaurants','Restaurants et livraison','Restaurants','monthly',false],
    ['household','Produits ménagers et petits achats','Produits de maison'],['clothes','Vêtements','Vêtements'],
    ['personal','Soins personnels','Soins personnels','monthly',false],['gifts','Cadeaux et dons','Cadeaux et dons','monthly',false]
  ]);
  group('Transport','bills',[
    ['car-loan','Prêt ou location automobile','Transport'],['car-insurance','Assurance automobile','Assurances'],['transit','Abonnement transport collectif','Transport']
  ]);
  group('Transport','envelopes',[
    ['fuel','Essence / recharge','Carburant et recharge'],['parking','Stationnement / taxi','Stationnement et taxi']
  ]);
  group('Famille et santé','bills',[
    ['daycare','Garderie / service de garde','Garde d’enfants'],['support-out','Pension alimentaire versée','Pension alimentaire versée'],
    ['life-insurance','Assurance vie / invalidité / maladie grave','Assurances']
  ]);
  group('Famille et santé','envelopes',[
    ['children','Activités et besoins des enfants','Enfants'],['school','Frais scolaires courants','Études'],
    ['health','Médicaments / dentiste / soins non remboursés','Santé'],['pets','Animaux / nourriture / vétérinaire','Animaux'],
    ['relatives','Aide à un proche','Aide aux proches']
  ]);
  group('Loisirs et abonnements','bills',[
    ['subscriptions','Télévision / musique / applications','Abonnements','monthly',false],['gym','Gym / club sportif','Loisirs','monthly',false],
    ['recreation-loan','Paiement VR / bateau / motoneige / VTT','Véhicules de loisir','monthly',false]
  ]);
  group('Loisirs et abonnements','envelopes',[
    ['leisure','Sorties, loisirs et passe-temps','Loisirs','monthly',false],['recreation','Utilisation des véhicules de loisir','Loisirs motorisés','monthly',false]
  ]);
  group('Dettes et frais','bills',[
    ['credit','Remboursement d’une ancienne dette de carte','Remboursement de dettes'],['loan','Prêt personnel / marge de crédit','Remboursement de dettes'],
    ['student-loan','Prêt étudiant','Remboursement de dettes'],['bank-fees','Frais bancaires','Frais bancaires']
  ]);
  group('À préparer dans l’année','provisions',[
    ['taxes','Taxes municipales / scolaires','Taxes foncières'],['registration','Immatriculations / permis','Immatriculations et permis'],
    ['car-maintenance','Pneus / entretien automobile','Entretien automobile'],['back-school','Rentrée scolaire','Rentrée scolaire'],
    ['vacation','Vacances','Vacances','yearly',false],['holidays','Fêtes et Noël','Fêtes','yearly',false],
    ['annual-insurance','Assurance payée une fois par année','Assurances'],['annual-membership','Cotisation annuelle','Cotisations','yearly',false]
  ]);
  group('Épargne prévue','bills',[
    ['emergency','Mise de côté pour les imprévus','Épargne','monthly',false],['rrsp','REER','REER','weekly',false],['tfsa','CELI','CELI','weekly',false],
    ['education-save','Épargne études / REEE','Épargne','monthly',false],['project-save','Épargne pour un autre objectif','Épargne','monthly',false]
  ]);
  const categories=[...new Set(['Maison','Épicerie','Transport','Loisirs','Assurances','Épargne','Salaire','Autre',...templates.map(x=>x.category)])];
  function create(id,uuid,day){
    const t=templates.find(x=>x.id===id);if(!t)return null;
    const row={id:uuid,label:t.label,category:t.category,essential:t.essential};
    if(['REER','CELI'].includes(t.category))row.accountBalance=null;
    if(t.key==='provisions')Object.assign(row,{annualAmount:null,savedAmount:0,dueDate:''});
    else {row.amount=null;if(t.key!=='envelopes')Object.assign(row,{frequency:t.frequency,anchorDate:day,secondDay:null})}
    return {key:t.key,row};
  }
  root.hpBudgetCatalog={templates,categories,create};
})(typeof globalThis!=='undefined'?globalThis:window);
