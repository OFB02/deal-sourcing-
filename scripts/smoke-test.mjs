/**
 * End-to-end røgtest: opretter en deal via UI'et, udfylder pris og
 * driftsår og verificerer, at nøgletal og flags beregnes.
 *
 * Kør serveren først (npm run dev eller npm start), derefter:
 *   node scripts/smoke-test.mjs
 *
 * Peger Playwright på en anden Chromium med CHROMIUM_PATH om nødvendigt.
 */
import { chromium } from "playwright";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const fejl = [];
page.on("pageerror", (e) => fejl.push("pageerror: " + e.message));

// 1. Opret deal via adressesøgning (mock-adresse)
await page.goto(base + "/deals/new");
await page.fill("#adresse-soeg", "Søndergade 12");
await page.waitForSelector(".adresse-resultat", { timeout: 5000 });
await page.click(".adresse-resultat button");
await page.waitForURL(/\/deals\/\d+$/, { timeout: 20000 });
const dealUrl = page.url();
console.log("Deal oprettet:", dealUrl);
await page.waitForSelector("h1");

// 2. Registerdata hentet?
const bodyText = await page.textContent("body");
for (const forventet of ["BBR - bygning", "Offentlig vurdering", "Ejerforhold", "Plangrundlag", "Tjekliste"]) {
  if (!bodyText.includes(forventet)) fejl.push("Mangler på dealside: " + forventet);
}

// 3. Lejeliste fra BBR
const bbrKnap = page.locator("form button", { hasText: "Opret lejeliste-skelet" });
if (await bbrKnap.count()) {
  await bbrKnap.click();
  await page.waitForLoadState("networkidle");
}

// 4. Gem pris
await page.fill('input[name="udbudspris"]', "12500000");
await page.fill('textarea[name="saelgersMotivation"]', "Ønsker hurtigt salg - generationsskifte");
await page.click('#pris button[type="submit"]');
await page.waitForLoadState("networkidle");

// 5. Gem driftsår
await page.fill('input[name="bruttolejeindtaegt"]', "980000");
await page.fill('input[name="ejendomsskat"]', "110000");
await page.fill('input[name="vedligehold"]', "85000");
await page.fill('input[name="administration"]', "45000");
await page.click('#oekonomi form[action] button');
await page.waitForLoadState("networkidle");

// 6. Nøgletal beregnet? (NOI = 980.000 - 240.000 = 740.000)
await page.reload({ waitUntil: "networkidle" });
const efter = await page.textContent("body");
if (!efter.includes("740.000")) fejl.push("NOI 740.000 kr. blev ikke beregnet/vist");
if (!efter.includes("Sælger ønsker hurtigt salg")) fejl.push("Motivations-flag mangler");

// 7. Præsentation + pipeline
await page.goto(dealUrl + "/praesentation");
if (!(await page.textContent("body")).includes("Investeringscase")) fejl.push("Præsentationsside fejlede");
await page.goto(base + "/");
if (!(await page.textContent("body")).includes("Søndergade 12")) fejl.push("Deal vises ikke i pipeline");

await browser.close();
if (fejl.length) {
  console.error("FEJL:\n" + fejl.join("\n"));
  process.exit(1);
}
console.log("Alle end-to-end-tjek bestået.");
