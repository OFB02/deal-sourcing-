/**
 * Fabrik der vælger mock- eller rigtig klient pr. datakilde ud fra .env.
 *
 * DATASOURCE_DAWA=mock|real, DATASOURCE_BBR=mock|real, osv.
 * Standard er mock, så appen virker uden nogen API-adgang.
 */
import type {
  AdresseMatch,
  AutoIndhentning,
  BbrClient,
  DawaClient,
  EjerClient,
  MarkedsDataClient,
  PlanDataClient,
  VurderingClient,
} from "./types";
import {
  MockBbrClient,
  MockDawaClient,
  MockEjerClient,
  MockMarkedsDataClient,
  MockPlanDataClient,
  MockVurderingClient,
} from "./mock/clients";
import {
  RealBbrClient,
  RealDawaClient,
  RealEjerClient,
  RealMarkedsDataClient,
  RealPlanDataClient,
  RealVurderingClient,
} from "./real/clients";

function erReal(kilde: string): boolean {
  return process.env[`DATASOURCE_${kilde}`] === "real";
}

export function getDawaClient(): DawaClient {
  return erReal("DAWA") ? new RealDawaClient() : new MockDawaClient();
}
export function getBbrClient(): BbrClient {
  return erReal("BBR") ? new RealBbrClient() : new MockBbrClient();
}
export function getVurderingClient(): VurderingClient {
  return erReal("VURDERING") ? new RealVurderingClient() : new MockVurderingClient();
}
export function getEjerClient(): EjerClient {
  return erReal("CVR") ? new RealEjerClient() : new MockEjerClient();
}
export function getPlanDataClient(): PlanDataClient {
  return erReal("PLANDATA") ? new RealPlanDataClient() : new MockPlanDataClient();
}
export function getMarkedsDataClient(): MarkedsDataClient {
  return erReal("MARKED") ? new RealMarkedsDataClient() : new MockMarkedsDataClient();
}

/**
 * Kører hele den automatiske indhentning for en adresse.
 * Kilder der fejler stopper ikke de andre - fejl samles og vises i UI'et,
 * så en halvt implementeret opsætning stadig giver mest mulig data.
 */
export async function koerAutoIndhentning(adresse: AdresseMatch): Promise<AutoIndhentning> {
  const fejl: { kilde: string; besked: string }[] = [];

  async function sikker<T>(kilde: string, fn: () => Promise<T>): Promise<T | null> {
    try {
      return await fn();
    } catch (e) {
      fejl.push({ kilde, besked: e instanceof Error ? e.message : String(e) });
      return null;
    }
  }

  const [bbr, vurdering, ejer, plandata, marked] = await Promise.all([
    sikker("BBR", () => getBbrClient().hentBygningsdata(adresse)),
    sikker("Vurdering", () => getVurderingClient().hentVurdering(adresse)),
    sikker("Ejer/CVR", () => getEjerClient().hentEjerInfo(adresse)),
    sikker("Plandata", () => getPlanDataClient().hentPlanData(adresse)),
    sikker("Markedsdata", () => getMarkedsDataClient().hentMarkedsData(adresse.postnr)),
  ]);

  return { bbr, vurdering, ejer, plandata, marked, fejl, hentetTidspunkt: new Date().toISOString() };
}
