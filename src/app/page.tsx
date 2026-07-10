/**
 * Pipeline-oversigt: alle deals grupperet efter status med de vigtigste
 * nøgletal, så man hurtigt kan se, hvor hver ejendom står i processen.
 */
import Link from "next/link";
import { hentAlleDeals, hentDokumenter } from "@/lib/db";
import { beregnDistress } from "@/lib/distress";
import { beregnNoegletal, kr, pct } from "@/lib/noegletal";
import { beregnTjekliste } from "@/lib/tjekliste";
import { STATUS_LABELS, STATUS_RAEKKEFOELGE } from "@/lib/model";

export const dynamic = "force-dynamic";

export default function Pipeline() {
  const deals = hentAlleDeals();
  const klar = deals.filter((d) => d.status === "klar").length;
  const hoejDistress = deals.filter((d) => beregnDistress(d.auto).niveau === "hoej").length;

  return (
    <>
      <h1>Pipeline</h1>
      <p className="muted">
        {deals.length === 0
          ? "Ingen deals endnu - start med en områdescreening eller opret en deal manuelt."
          : `${deals.length} ejendom${deals.length === 1 ? "" : "me"} i pipelinen.`}
      </p>

      {deals.length > 0 && (
        <div className="kpi-raekke" style={{ marginBottom: 20 }}>
          <div className="kpi">
            <div className="label">I pipeline</div>
            <div className="vaerdi">{deals.length}</div>
          </div>
          <div className="kpi">
            <div className="label">Høj distress</div>
            <div className="vaerdi">{hoejDistress}</div>
            <div className="sub">score ≥ 50</div>
          </div>
          <div className="kpi">
            <div className="label">Klar til sourcing</div>
            <div className="vaerdi">{klar}</div>
          </div>
        </div>
      )}

      {STATUS_RAEKKEFOELGE.map((status) => {
        const gruppe = deals
          .filter((d) => d.status === status)
          .map((deal) => ({ deal, distress: beregnDistress(deal.auto) }))
          .sort((a, b) => b.distress.score - a.distress.score);
        if (gruppe.length === 0) return null;
        return (
          <section key={status} className="card">
            <h2>
              <span className={`badge ${status}`}>{STATUS_LABELS[status]}</span>{" "}
              <span className="muted small">({gruppe.length})</span>
            </h2>
            <table>
              <thead>
                <tr>
                  <th className="num">Distress</th>
                  <th>Adresse</th>
                  <th>Ejer</th>
                  <th className="num">Pris</th>
                  <th className="num">Nettoafkast</th>
                  <th className="num">Kvm-pris vs. marked</th>
                  <th className="num">Komplethed</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {gruppe.map(({ deal, distress }) => {
                  const n = beregnNoegletal(deal);
                  const tj = beregnTjekliste(deal, hentDokumenter(deal.id));
                  return (
                    <tr key={deal.id}>
                      <td className="num">
                        <span className={`score-tal ${distress.niveau}`}>{distress.score}</span>
                      </td>
                      <td>
                        <Link href={`/deals/${deal.id}`}>
                          <strong>{deal.adresse.betegnelse}</strong>
                        </Link>
                        <div className="small muted">
                          {deal.auto?.bbr
                            ? `${deal.auto.bbr.anvendelseTekst} · ${deal.auto.bbr.antalBoligenheder + deal.auto.bbr.antalErhvervsenheder} lejemål · opført ${deal.auto.bbr.byggeaar}`
                            : "Registerdata ikke hentet"}
                        </div>
                      </td>
                      <td>
                        {deal.auto?.ejer ? (
                          <>
                            {deal.auto.ejer.navn}
                            <div className="small muted">
                              {deal.auto.ejer.ejertype === "selskab"
                                ? `CVR ${deal.auto.ejer.cvrNummer}`
                                : deal.auto.ejer.ejertype}
                            </div>
                          </>
                        ) : (
                          "–"
                        )}
                      </td>
                      <td className="num">{kr(n.beregningspris)}</td>
                      <td className="num">{pct(n.nettoafkastPct)}</td>
                      <td className="num">
                        {n.kvmPrisAfvigelsePct == null
                          ? "–"
                          : `${n.kvmPrisAfvigelsePct > 0 ? "+" : ""}${n.kvmPrisAfvigelsePct} %`}
                      </td>
                      <td className="num" style={{ minWidth: 120 }}>
                        <div className={`fremdrift ${tj.klarTilSourcing ? "" : "delvis"}`}>
                          <div style={{ width: `${tj.procent}%` }} />
                        </div>
                        <span className="small muted">{tj.procent} %</span>
                      </td>
                      <td>
                        <Link href={`/deals/${deal.id}`} className="small">
                          Åbn →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}

      {deals.length === 0 && (
        <div className="card">
          <h2>Sådan bruger du platformen</h2>
          <ol>
            <li>
              <strong>Kør en <Link href="/screening">områdescreening</Link></strong> - vælg
              postnummer og lejemåls-kriterier, og få kvarterets ejendomme rangeret efter
              distress-score (selskabsstatus, dødsbo, ejertid, bygningsefterslæb, værdigab).
            </li>
            <li>
              <strong>Opret deals</strong> på de mest interessante emner direkte fra listen -
              registerdata (BBR, vurdering, ejer/CVR, Statstidende, plandata, markedsdata)
              hentes automatisk. Du kan også oprette en deal manuelt via “+ Ny deal”.
            </li>
            <li>
              <strong>Kontakt og kvalificér</strong>: log samtaler i kontaktloggen, og indhent
              manuelt lejeliste, driftsregnskaber, stand og tingbogsattest - tjeklisten viser
              præcis, hvad der mangler.
            </li>
            <li>
              Når alle krævede punkter er opfyldt, er dealen <strong>klar til sourcing</strong> -
              match den med <Link href="/investorer">investorer</Link> og del den print-venlige
              præsentation.
            </li>
          </ol>
        </div>
      )}
    </>
  );
}
