/**
 * Visning af de automatisk indhentede registerdata (BBR, vurdering,
 * ejer/CVR, plandata, markedsdata).
 */
import type { AutoIndhentning } from "@/integrations/types";
import { kr, pct, tal } from "@/lib/noegletal";

const STATSTIDENDE_LABELS: Record<string, string> = {
  doedsbo: "Dødsbo",
  konkurs: "Konkurs",
  tvangsoploesning: "Tvangsopløsning",
  likvidation: "Likvidation",
  andet: "Andet",
};

export default function AutoData({ auto }: { auto: AutoIndhentning }) {
  const { bbr, vurdering, ejer, plandata, marked } = auto;
  const statstidende = auto.statstidende ?? [];
  return (
    <>
      {auto.fejl.length > 0 && (
        <div className="fejlboks">
          <strong>Kilder der fejlede:</strong>
          <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
            {auto.fejl.map((f) => (
              <li key={f.kilde}>
                <strong>{f.kilde}:</strong> {f.besked}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid2">
        <div>
          <h3>BBR - bygning</h3>
          {bbr ? (
            <table>
              <tbody>
                <tr><td className="muted">Byggeår</td><td>{bbr.byggeaar}{bbr.omTilbygningsaar ? ` (om-/tilbygget ${bbr.omTilbygningsaar})` : ""}</td></tr>
                <tr><td className="muted">Anvendelse</td><td>{bbr.anvendelseTekst} (kode {bbr.anvendelseskode})</td></tr>
                <tr><td className="muted">Boligareal</td><td>{tal(bbr.samletBoligareal, " m²")} fordelt på {bbr.antalBoligenheder} enheder</td></tr>
                <tr><td className="muted">Erhvervsareal</td><td>{bbr.samletErhvervsareal > 0 ? `${tal(bbr.samletErhvervsareal, " m²")} fordelt på ${bbr.antalErhvervsenheder} enheder` : "Intet"}</td></tr>
                <tr><td className="muted">Etager</td><td>{bbr.antalEtager}</td></tr>
                <tr><td className="muted">Tag / ydervæg</td><td>{bbr.tagmateriale ?? "–"} / {bbr.ydervaegsmateriale ?? "–"}</td></tr>
                <tr><td className="muted">Varme</td><td>{bbr.varmeinstallation ?? "–"}</td></tr>
              </tbody>
            </table>
          ) : (
            <p className="muted small">Ingen data.</p>
          )}
        </div>

        <div>
          <h3>Offentlig vurdering</h3>
          {vurdering ? (
            <table>
              <tbody>
                <tr><td className="muted">Ejendomsværdi ({vurdering.vurderingsaar})</td><td className="num">{kr(vurdering.ejendomsvaerdi)}</td></tr>
                <tr><td className="muted">Grundværdi</td><td className="num">{kr(vurdering.grundvaerdi)}</td></tr>
                {vurdering.historik.map((h) => (
                  <tr key={h.aar}>
                    <td className="muted small">Historik {h.aar}</td>
                    <td className="num small">{kr(h.ejendomsvaerdi)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted small">Ingen data.</p>
          )}

          <h3 style={{ marginTop: 16 }}>Markedsdata ({marked?.postnr ?? "område"})</h3>
          {marked ? (
            <table>
              <tbody>
                <tr><td className="muted">Kvm-pris, seneste</td><td className="num">{kr(marked.kvmPrisSeneste)}</td></tr>
                <tr><td className="muted">Udvikling 1 år / 5 år</td><td className="num">{pct(marked.kvmPrisUdvikling1Aar)} / {pct(marked.kvmPrisUdvikling5Aar)}</td></tr>
                <tr><td className="muted">Handler seneste år</td><td className="num">{marked.antalHandlerSenesteAar}</td></tr>
                <tr><td className="muted">Typisk afkastkrav</td><td className="num">{pct(marked.typiskAfkastkravPct)}</td></tr>
              </tbody>
            </table>
          ) : (
            <p className="muted small">Ingen data.</p>
          )}
        </div>

        <div>
          <h3>Ejerforhold</h3>
          {ejer ? (
            <>
              <table>
                <tbody>
                  <tr><td className="muted">Ejer</td><td>{ejer.navn}</td></tr>
                  <tr><td className="muted">Type</td><td>{ejer.ejertype}</td></tr>
                  {ejer.overtagelsesAar && (
                    <tr>
                      <td className="muted">Ejet siden</td>
                      <td>{ejer.overtagelsesAar} ({new Date().getFullYear() - ejer.overtagelsesAar} år)</td>
                    </tr>
                  )}
                  {ejer.cvrNummer && <tr><td className="muted">CVR</td><td>{ejer.cvrNummer}</td></tr>}
                  {ejer.selskab && (
                    <>
                      <tr>
                        <td className="muted">Form / status</td>
                        <td>
                          {ejer.selskab.virksomhedsform} ·{" "}
                          {ejer.selskab.status === "Normal" ? (
                            ejer.selskab.status
                          ) : (
                            <span className="badge afvist">{ejer.selskab.status}</span>
                          )}
                        </td>
                      </tr>
                      <tr><td className="muted">Branche</td><td className="small">{ejer.selskab.branche}</td></tr>
                      <tr><td className="muted">Reelle ejere</td><td>{ejer.selskab.reelleEjere.join(", ")}</td></tr>
                    </>
                  )}
                </tbody>
              </table>

              <h3 style={{ marginTop: 12 }}>Statstidende</h3>
              {statstidende.length === 0 ? (
                <p className="muted small">Ingen meddelelser fundet for ejeren.</p>
              ) : (
                <table>
                  <tbody>
                    {statstidende.map((m, i) => (
                      <tr key={i}>
                        <td>
                          <span className="badge afvist">{STATSTIDENDE_LABELS[m.type] ?? m.type}</span>
                        </td>
                        <td>
                          <strong>{m.overskrift}</strong>
                          <div className="small muted">{m.dato} · {m.resume}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {ejer.selskab && (
                <>
                  <h3 style={{ marginTop: 12 }}>Seneste årsregnskaber (CVR)</h3>
                  <table>
                    <thead>
                      <tr><th>År</th><th className="num">Resultat</th><th className="num">Egenkapital</th></tr>
                    </thead>
                    <tbody>
                      {ejer.selskab.regnskaber.map((r) => (
                        <tr key={r.aar}>
                          <td>{r.aar}</td>
                          <td className="num">{kr(r.resultat)}</td>
                          <td className="num">{kr(r.egenkapital)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </>
          ) : (
            <p className="muted small">Ingen data.</p>
          )}
        </div>

        <div>
          <h3>Plangrundlag</h3>
          {plandata ? (
            <>
              <table>
                <tbody>
                  <tr><td className="muted">Kommuneplanramme</td><td>{plandata.kommuneplanramme ?? "–"}</td></tr>
                  <tr><td className="muted">Anvendelse</td><td>{plandata.anvendelseGenerel ?? "–"}</td></tr>
                  <tr><td className="muted">Maks. bebyggelses-%</td><td>{tal(plandata.maksBebyggelsesprocent, " %")}</td></tr>
                  <tr><td className="muted">Maks. etager</td><td>{tal(plandata.maksEtager)}</td></tr>
                </tbody>
              </table>
              <h3 style={{ marginTop: 12 }}>Lokalplaner</h3>
              <table>
                <tbody>
                  {plandata.lokalplaner.map((l) => (
                    <tr key={l.planId}>
                      <td>
                        <strong>{l.planId}</strong> {l.navn}
                        <div className="small muted">{l.dato}</div>
                      </td>
                      <td>
                        <span className={`badge ${l.status === "forslag" ? "indhentning" : "screening"}`}>
                          {l.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="muted small">Ingen data.</p>
          )}
        </div>
      </div>
    </>
  );
}
