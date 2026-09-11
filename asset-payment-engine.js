(function(root){
 'use strict';
 const prefix='asset-payment:';
 const frequencies={weekly:'par semaine',biweekly:'aux deux semaines',semimonthly:'deux fois par mois',monthly:'par mois',quarterly:'par trimestre',yearly:'par année'};
 const counts={weekly:52,biweekly:26,semimonthly:24,monthly:12,quarterly:4,yearly:1};
 const linked=row=>typeof row?.id==='string'&&row.id.startsWith(prefix);
 const cleanPlan=plan=>({...plan,bills:Array.isArray(plan?.bills)?plan.bills.filter(x=>!linked(x)):plan?.bills});
 function bill(row){return {id:prefix+row.id,label:('Paiement '+(row.asset_name||'du bien')).slice(0,120),category:row.property_id?'Maison':'Loisirs',essential:row.essential===true,amount:Number(row.amount),frequency:row.frequency,anchorDate:row.anchor_date,secondDay:row.second_day??null};}
 function merge(plan,payments){return {...plan,bills:[...(cleanPlan(plan).bills||[]),...payments.map(bill)]};}
 function totals(amount,frequency){
  const value=Number(amount);if(amount===''||amount==null||!Number.isFinite(value)||value<0||!counts[frequency])return null;
  const annual=Math.round(value*100)*counts[frequency];return {annual,monthly:Math.round(annual/12)};
 }
 root.hpAssetPaymentEngine={prefix,frequencies,linked,cleanPlan,bill,merge,totals};
})(typeof window==='undefined'?globalThis:window);
