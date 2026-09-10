// Requested by the HomePilot owner on 2026-09-10. This is editorial placement,
// not a paid partnership, licence verification or service-quality rating.
export const GESTI_ENERGIE_ID='5d02c57d-3f85-46dd-a06f-c533a960de0e';
export const SAGUENAY_REGION='Saguenay-Lac-Saint-Jean';
const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\bst\b/g,'saint').replace(/\bste\b/g,'sainte');
// Municipalities in the region, plus common Saguenay borough names. Do not infer
// a region from G7/G8 alone: postal districts and administrative borders differ.
const localCities=new Set([
 'Albanel','Alma','Bégin','Canton Tremblay','Chambord','Chicoutimi','Desbiens','Dolbeau-Mistassini',
 'Ferland-et-Boilleau','Girardville','Hébertville','Hébertville-Station','Jonquière',
 'L’Anse-Saint-Jean','L’Ascension-de-Notre-Seigneur','La Baie','La Doré','Labrecque','Lac-Bouchette',
 'Lamarche','Larouche','Mashteuiatsh','Métabetchouan','Métabetchouan–Lac-à-la-Croix','Normandin',
 'Péribonka','Rivière-Éternité','Roberval','Saguenay','Saint-Ambroise','Saint-André-du-Lac-Saint-Jean',
 'Saint-Charles-de-Bourget','Saint-David-de-Falardeau','Saint-Edmond-les-Plaines','Saint-Eugène-d’Argentenay',
 'Saint-Félicien','Saint-Félix-d’Otis','Saint-François-de-Sales','Saint-Fulgence','Saint-Gédéon',
 'Saint-Henri-de-Taillon','Saint-Honoré','Saint-Ludger-de-Milot','Saint-Nazaire','Saint-Prime',
 'Saint-Thomas-Didyme','Sainte-Hedwidge','Sainte-Jeanne-d’Arc','Shipshaw','Lac-Kénogami'
].map(norm));
const ambiguousCities=new Set(['Saint-Augustin','Saint-Bruno','Saint-Stanislas','Sainte-Monique'].map(norm));
export function directoryRegion({city='',region='',postal=''}={}){
 if(String(region).trim())return region; // The property's explicit region takes precedence.
 const name=norm(city),postcode=String(postal).toUpperCase().replace(/\s/g,'');
 return localCities.has(name)||(ambiguousCities.has(name)&&postcode.startsWith('G0W'))?SAGUENAY_REGION:'';
}
export function preferredProfessionalId(context){
 return context.category==='electrical'&&(!context.service||context.service==='electrical')&&norm(directoryRegion(context))===norm(SAGUENAY_REGION)?GESTI_ENERGIE_ID:null;
}
export function eligiblePriority(profile,context){
 return profile.id===preferredProfessionalId(context)&&profile.active===true&&Array.isArray(profile.directory_issues)&&profile.directory_issues.length===0&&profile.category==='electrical'&&(!context.service||profile.service_categories?.includes(context.service));
}
export function rankProfessionals(rows,context){
 const tier=t=>t==='sponsored'?3:t==='partner'?2:1;
 return rows.map(profile=>({...profile,homepilot_featured:eligiblePriority(profile,context)})).sort((a,b)=>Number(b.homepilot_featured)-Number(a.homepilot_featured)||tier(b.listing_tier)-tier(a.listing_tier));
}
