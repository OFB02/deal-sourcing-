/**
 * Områdescreening: vælg postnummer + kriterier, og få en prioriteret
 * liste over de ejendomme i området med højest distress-score.
 * Formålet er at reducere et helt kvarter til de 10-20 emner, der er
 * værd at kontakte - ikke at træffe beslutningen.
 */
import Link from "next/link";
import { SCREENING_POSTNRE } from "@/integrations/mock/data";
import { opretDealAction } from "@/lib/actions";
import { hentAlleDeals } from "@/lib/db";
import { koerScreening } from "@/lib/screening";
import { kr } from "@/lib/noegletal";

export const dynamic = "force-dynamic";

export default async function Screening({
  searchParams,
}: {
  searchParams: Promise<{ postnr?: string; min?: string; maks?: string }>;
}) {
  const params = await searchParams;
  const postnr = params.postnr?.trim() ?? "";
  const min = Math.max(1, Number(params.min) || 4);
  const maks = Math.max(min, Number(params.maks) || 15);

  const resultat = postnr
    ? await koerScreening({ postnr, minLejemaal: min, maksLejemaal: maks })
    : null;

  const eksisterende = new Set(hentAlleDeals().map((d) => d.adresse.betegnelse));

  return (
    <>
      <h1>Områdescreening</h1>
      <p className="muted">
        Finder udlejningsejendomme i et postnummer (BBR-anvendelse 140/150) inden for dine
        lejemåls-kriterier og rangerer dem efter distress-score. Bygger udelukkende på gratis
        registerdata - ingen scraping, ingen betalte opslag.
      </p>

      <div className="card">
        <form method="get" className="form-raekke" style={{ alignItems: "end" }}>
          <div>
            <label htmlFor="postnr">Postnummer</label>
            <input
              id="postnr"
              type="text"
              name="postnr"
              defaultValue={postnr}
              placeholder="Fx 2200"
              list="postnr-forslag"
              required
            />
            <datalist id="postnr-forslag">
              {SCREENING_POSTNRE.map((p) => (
                <option key={p.postnr} value={p.postnr}>{p.navn}</option>
              ))}
            </datalist>
          </div>
          <div>
            <label htmlFor="min">Min. lejemål</label>
            <input id="min" type="number" name="min" defaultValue={min} min={1} />
          </div>
          <div>
            <label htmlFor="maks">Maks. lejemål</label>
            <input id="maks" type="number" name="maks" defaultValue={maks} min={1} />
          </div>
          <div>
            <button type="submit">Kør screening</button>
          </div>
        </form>
        <p className="small muted" style={{ marginBottom: 0 }}>
          Anbefalet afgrænsning i starten: ét kvarter og 4-15 lejemål, så du kan validere
          scoringen manuelt på 20-30 ejendomme.
        </p>
      </div>

      {resultat && (
        <>
          <div className="kpi-raekke" style={{ marginBottom: 20 }}>
            <div className="kpi">
              <div className="label">Adresser undersøgt</div>
              <div className="vaerdi">{resultat.antalUndersoegt}</div>
            </div>
            <div className="kpi">
              <div className="label">Opfylder kriterier</div>
              <div className="vaerdi">{resultat.emner.length}</div>
              <div className="sub">{min}-{maks} lejemål, anvendelse 140/150</div>
            </div>
            <div className="kpi">
              <div className="label">Høj distress (≥50)</div>
              <div className="vaerdi">{resultat.emner.filter((e) => e.distress.niveau === "hoej").length}</div>
            </div>
            <div className="kpi">
              <div className="label">Kvm-pris i området</div>
              <div className="vaerdi">{resultat.marked ? resultat.marked.kvmPrisSeneste.toLocaleString("da-DK") : "–"}</div>
              <div className="sub">Finans Danmark-niveau</div>
            </div>
          </div>

          {resultat.fejl.length > 0 && (
            <div className="fejlboks">
              {resultat.fejl.slice(0, 5).map((f, i) => (
                <div key={i}>{f}</div>
              ))}
              {resultat.fejl.length > 5 && <div>… og {resultat.fejl.length - 5} flere fejl</div>}
            </div>
          )}

          <div className="card">
            <h2>Prioriteret liste ({resultat.emner.length})</h2>
            {resultat.emner.length === 0 ? (
              <p className="muted">Ingen ejendomme opfyldte kriterierne i {postnr}.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 130 }}>Distress</th>
                    <th>Ejendom</th>
                    <th>Ejer</th>
                    <th>Signaler</th>
                    <th className="num">Off. vurdering</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {resultat.emner.map((e) => {
                    const lejemaal = e.bbr.antalBoligenheder + e.bbr.antalErhvervsenheder;
                    const iPipeline = eksisterende.has(e.adresse.betegnelse);
                    return (
                      <tr key={e.adresse.id}>
                        <td>
                          <div className={`score-tal ${e.distress.niveau}`}>{e.distress.score}</div>
                          <div className="fremdrift delvis" style={{ marginTop: 4 }}>
                            <div style={{ width: `${e.distress.score}%` }} />
                          </div>
                        </td>
                        <td>
                          <strong>{e.adresse.betegnelse}</strong>
                          <div className="small muted">
                            {lejemaal} lejemål · {e.bbr.samletBoligareal + e.bbr.samletErhvervsareal} m² · opført {e.bbr.byggeaar}
                            {e.bbr.omTilbygningsaar ? ` (omb. ${e.bbr.omTilbygningsaar})` : ""}
                          </div>
                        </td>
                        <td>
                          {e.ejer ? (
                            <>
                              {e.ejer.navn}
                              <div className="small muted">
                                {e.ejer.ejertype}
                                {e.ejer.overtagelsesAar ? ` · ejet siden ${e.ejer.overtagelsesAar}` : ""}
                              </div>
                            </>
                          ) : (
                            "–"
                          )}
                        </td>
                        <td>
                          {e.distress.signaler.length === 0 && <span className="muted small">ingen</span>}
                          {e.distress.signaler.map((s) => (
                            <span key={s.navn} className="signal-chip" title={s.begrundelse}>
                              {s.navn} +{s.point}
                            </span>
                          ))}
                        </td>
                        <td className="num">{kr(e.vurdering?.ejendomsvaerdi ?? null)}</td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {iPipeline ? (
                            <span className="badge shortlist">I pipeline</span>
                          ) : (
                            <form action={opretDealAction}>
                              <input type="hidden" name="adresse" value={JSON.stringify(e.adresse)} />
                              <button type="submit" className="lille">Opret deal</button>
                            </form>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <p className="small muted">
              Hold musen over et signal for begrundelsen. Scoren er en prioritering, ikke en
              vurdering - valider de øverste emner manuelt, før du kontakter nogen.
            </p>
          </div>
        </>
      )}

      {!resultat && (
        <p className="small muted">
          Prøv fx <Link href="/screening?postnr=2200">2200 København N</Link>,{" "}
          <Link href="/screening?postnr=2400">2400 København NV</Link> eller{" "}
          <Link href="/screening?postnr=8000">8000 Aarhus C</Link> (mock-data).
        </p>
      )}
    </>
  );
}
