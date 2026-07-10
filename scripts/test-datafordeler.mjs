/**
 * Lokal test af Datafordeler-adgangen (BBR) + DAWA.
 *
 * Kør fra projektroden på en maskine med normal internetadgang:
 *   node scripts/test-datafordeler.mjs "Vesterbrogade 142, 1620"
 *
 * Scriptet:
 *  1. Slår adressen op i DAWA (åben, ingen nøgle)
 *  2. Henter bygninger fra BBR med din tjenestebruger (.env)
 *  3. Henter enheder for første bygning
 * og printer rå JSON-uddrag, så felt-mapningen i
 * src/integrations/real/clients.ts kan verificeres/justeres.
 */
import fs from "node:fs";

// Læs .env uden afhængigheder
const env = {};
try {
  for (const linje of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = linje.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m) env[m[1]] = m[2];
  }
} catch {
  console.error("Kunne ikke læse .env - kopiér .env.example til .env og udfyld DATAFORDELER_*");
  process.exit(1);
}

const U = env.DATAFORDELER_USERNAME;
const P = env.DATAFORDELER_PASSWORD;
if (!U || !P) {
  console.error("DATAFORDELER_USERNAME/PASSWORD mangler i .env");
  process.exit(1);
}

const soegning = process.argv[2] ?? "Vesterbrogade 142, 1620";

function uddrag(obj, antal = 1) {
  const liste = Array.isArray(obj) ? obj.slice(0, antal) : obj;
  return JSON.stringify(liste, null, 2).slice(0, 2500);
}

// 1. DAWA
console.log(`\n=== 1. DAWA-opslag: "${soegning}" ===`);
const dawaRes = await fetch(
  `https://api.dataforsyningen.dk/adgangsadresser?q=${encodeURIComponent(soegning)}&struktur=nestet&per_side=1`
);
if (!dawaRes.ok) {
  console.error(`DAWA fejlede: HTTP ${dawaRes.status}`);
  process.exit(1);
}
const [adresse] = await dawaRes.json();
if (!adresse) {
  console.error("Ingen adresse fundet - prøv en anden søgning.");
  process.exit(1);
}
console.log(`Fundet: ${adresse.vejstykke?.navn} ${adresse.husnr}, ${adresse.postnummer?.nr} (id ${adresse.id})`);
console.log(`matrikelnr: ${adresse.matrikelnr ?? "?"} · ejerlav: ${adresse.ejerlav?.navn ?? "?"} · esrejendomsnr: ${adresse.esrejendomsnr ?? "?"}`);

// 2. BBR bygninger
console.log(`\n=== 2. BBR bygninger (husnummer=${adresse.id}) ===`);
const bygUrl = new URL("https://services.datafordeler.dk/BBR/BBRPublic/1/REST/bygning");
bygUrl.searchParams.set("username", U);
bygUrl.searchParams.set("password", P);
bygUrl.searchParams.set("format", "json");
bygUrl.searchParams.set("husnummer", adresse.id);
bygUrl.searchParams.set("pagesize", "10");
const bygRes = await fetch(bygUrl);
console.log(`HTTP ${bygRes.status}`);
if (!bygRes.ok) {
  console.error((await bygRes.text()).slice(0, 500));
  console.error("\n401/403 = forkert brugernavn/adgangskode eller manglende tjeneste-adgang på datafordeler.dk");
  process.exit(1);
}
const bygninger = await bygRes.json();
console.log(`Antal bygninger: ${Array.isArray(bygninger) ? bygninger.length : "?"}`);
console.log("Rå uddrag (første bygning):\n" + uddrag(bygninger));

// 3. BBR enheder for første bygning
const foerste = Array.isArray(bygninger) ? bygninger[0] : null;
if (foerste?.id_lokalId) {
  console.log(`\n=== 3. BBR enheder (bygning=${foerste.id_lokalId}) ===`);
  const enhUrl = new URL("https://services.datafordeler.dk/BBR/BBRPublic/1/REST/enhed");
  enhUrl.searchParams.set("username", U);
  enhUrl.searchParams.set("password", P);
  enhUrl.searchParams.set("format", "json");
  enhUrl.searchParams.set("bygning", foerste.id_lokalId);
  enhUrl.searchParams.set("pagesize", "5");
  const enhRes = await fetch(enhUrl);
  console.log(`HTTP ${enhRes.status}`);
  if (enhRes.ok) {
    const enheder = await enhRes.json();
    console.log(`Antal enheder (første side): ${Array.isArray(enheder) ? enheder.length : "?"}`);
    console.log("Rå uddrag (første enhed):\n" + uddrag(enheder));
  } else {
    console.error((await enhRes.text()).slice(0, 500));
  }
}

console.log(`\n=== Færdig ===
Virkede alle tre trin, kan du sætte DATASOURCE_DAWA=real og DATASOURCE_BBR=real i .env.
Afviger felt-navnene i de rå uddrag fra mapningen i src/integrations/real/clients.ts,
så send outputtet, og mapningen justeres.`);
