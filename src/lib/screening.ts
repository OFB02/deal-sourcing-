/**
 * Områdescreening: find kandidat-ejendomme i et postnr, filtrér på
 * BBR-kriterier (udlejningsejendomme med fx 4-15 lejemål) og rangér
 * efter distress-score.
 *
 * Alt bygger på gratis kilder (DAWA, BBR, CVR/Ejerfortegnelsen,
 * Statstidende, vurdering, Finans Danmark) - ingen scraping, ingen
 * betalte opslag. Ved rigtig drift bør resultaterne caches lokalt
 * (batch-job), så API'erne ikke rammes live pr. screening.
 */
import {
  getBbrClient,
  getEjendomsSoegningClient,
  getEjerClient,
  getMarkedsDataClient,
  getStatstidendeClient,
  getVurderingClient,
} from "@/integrations";
import type {
  AdresseMatch,
  BbrData,
  EjerInfo,
  MarkedsData,
  ScreeningKriterier,
  StatstidendeMeddelelse,
  Vurdering,
} from "@/integrations/types";
import { beregnDistress, DistressScore } from "./distress";

export interface ScreeningEmne {
  adresse: AdresseMatch;
  bbr: BbrData;
  ejer: EjerInfo | null;
  vurdering: Vurdering | null;
  statstidende: StatstidendeMeddelelse[];
  distress: DistressScore;
}

export interface ScreeningResultat {
  kriterier: ScreeningKriterier;
  marked: MarkedsData | null;
  /** Antal adresser undersøgt før BBR-filtrering */
  antalUndersoegt: number;
  /** Emner der opfylder kriterierne, sorteret efter distress-score */
  emner: ScreeningEmne[];
  fejl: string[];
}

/** Anvendelseskoder for etagebolig (140) og blandet bolig/erhverv (150) */
const RELEVANTE_ANVENDELSER = new Set(["140", "150"]);

export async function koerScreening(kriterier: ScreeningKriterier): Promise<ScreeningResultat> {
  const fejl: string[] = [];
  const adresser = await getEjendomsSoegningClient().findAdresser(kriterier.postnr);

  const marked = await getMarkedsDataClient()
    .hentMarkedsData(kriterier.postnr)
    .catch((e) => {
      fejl.push("Markedsdata: " + (e instanceof Error ? e.message : String(e)));
      return null;
    });

  const bbrClient = getBbrClient();
  const ejerClient = getEjerClient();
  const vurderingClient = getVurderingClient();
  const statstidendeClient = getStatstidendeClient();

  const emner: ScreeningEmne[] = [];

  // Begrænset parallelitet, så en rigtig BBR-kilde ikke overbelastes
  const BATCH = 8;
  for (let i = 0; i < adresser.length; i += BATCH) {
    const batch = adresser.slice(i, i + BATCH);
    const resultater = await Promise.all(
      batch.map(async (adresse): Promise<ScreeningEmne | null> => {
        let bbr: BbrData;
        try {
          bbr = await bbrClient.hentBygningsdata(adresse);
        } catch (e) {
          fejl.push(`${adresse.betegnelse}: BBR - ${e instanceof Error ? e.message : e}`);
          return null;
        }

        // Filtrér: kun udlejningsejendomme inden for lejemåls-kriterierne
        const lejemaal = bbr.antalBoligenheder + bbr.antalErhvervsenheder;
        if (!RELEVANTE_ANVENDELSER.has(bbr.anvendelseskode)) return null;
        if (lejemaal < kriterier.minLejemaal || lejemaal > kriterier.maksLejemaal) return null;

        const [ejer, vurdering] = await Promise.all([
          ejerClient.hentEjerInfo(adresse).catch(() => null),
          vurderingClient.hentVurdering(adresse).catch(() => null),
        ]);
        const statstidende = ejer
          ? await statstidendeClient
              .soegMeddelelser({ navn: ejer.navn, cvrNummer: ejer.cvrNummer })
              .catch(() => [])
          : [];

        const distress = beregnDistress({
          bbr,
          ejer,
          vurdering,
          plandata: null,
          marked,
          statstidende,
          fejl: [],
          hentetTidspunkt: new Date().toISOString(),
        });

        return { adresse, bbr, ejer, vurdering, statstidende, distress };
      })
    );
    for (const r of resultater) if (r) emner.push(r);
  }

  emner.sort((a, b) => b.distress.score - a.distress.score);

  return {
    kriterier,
    marked,
    antalUndersoegt: adresser.length,
    emner,
    fejl,
  };
}
