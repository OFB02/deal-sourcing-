/**
 * Fælles helper til Datafordelerens REST-tjenester.
 *
 * Autentificering sker med tjenestebrugerens brugernavn/adgangskode som
 * query-parametre (Datafordelerens standardmodel for tjenestebrugere).
 * Legitimationen læses fra DATAFORDELER_USERNAME / DATAFORDELER_PASSWORD
 * i .env (git-ignoreret - må aldrig committes).
 */

const BASE = "https://services.datafordeler.dk";

export class DatafordelerFejl extends Error {
  constructor(tjeneste: string, status: number, krop: string) {
    super(
      `Datafordeler ${tjeneste}: HTTP ${status}. ` +
        (status === 401 || status === 403
          ? "Tjek DATAFORDELER_USERNAME/PASSWORD i .env, og at tjenestebrugeren har adgang til tjenesten. "
          : "") +
        krop.slice(0, 300)
    );
  }
}

export async function datafordelerHent<T>(
  /** Sti efter basen, fx "BBR/BBRPublic/1/REST/bygning" */
  sti: string,
  params: Record<string, string | number>
): Promise<T> {
  const brugernavn = process.env.DATAFORDELER_USERNAME;
  const adgangskode = process.env.DATAFORDELER_PASSWORD;
  if (!brugernavn || !adgangskode) {
    throw new Error(
      "DATAFORDELER_USERNAME/DATAFORDELER_PASSWORD mangler i .env - opret en tjenestebruger på datafordeler.dk."
    );
  }

  const url = new URL(`${BASE}/${sti}`);
  url.searchParams.set("username", brugernavn);
  url.searchParams.set("password", adgangskode);
  url.searchParams.set("format", "json");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new DatafordelerFejl(sti.split("/")[0], res.status, await res.text());
  }
  return (await res.json()) as T;
}
