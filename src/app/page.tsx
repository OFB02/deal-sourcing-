/**
 * Pipeline-oversigt: alle deals grupperet efter status med de vigtigste
 * nøgletal, så man hurtigt kan se, hvor hver ejendom står i processen.
 */
import Link from "next/link";
import { hentAlleDeals, hentDokumenter } from "@/lib/db";
import { beregnNoegletal, kr, pct } from "@/lib/noegletal";
import { beregnTjekliste } from "@/lib/tjekliste";
import { STATUS_LABELS, STATUS_RAEKKEFOELGE } from "@/lib/model";

export const dynamic = "force-dynamic";

export default function Pipeline() {
  const deals = hentAlleDeals();

  return (
    <>
      <h1>Pipeline</h1>
      <p className="muted">
        {deals.length === 0
          ? "Ingen deals endnu - opret den første med “+ Ny deal”."
          : `${deals.length} ejendom${deals.length === 1 ? "" : "me"} i pipelinen.`}
      </p>

      {STATUS_RAEKKEFOELGE.map((status) => {
        const gruppe = deals.filter((d) => d.status === status);
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
                {gruppe.map((deal) => {
                  const n = beregnNoegletal(deal);
                  const tj = beregnTjekliste(deal, hentDokumenter(deal.id));
                  return (
                    <tr key={deal.id}>
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
              <strong>Opret en deal</strong> ved at søge adressen frem - registerdata (BBR,
              vurdering, ejer/CVR, plandata, markedsdata) hentes automatisk.
            </li>
            <li>
              <strong>Screen</strong> ud fra de automatiske nøgletal, og flyt de interessante
              ejendomme til shortlisten.
            </li>
            <li>
              <strong>Indhent manuelt</strong> lejeliste, driftsregnskaber, standvurdering og
              tingbogsattest fra sælger/mægler - tjeklisten viser præcis, hvad der mangler.
            </li>
            <li>
              Når alle krævede punkter er opfyldt, er dealen <strong>klar til sourcing</strong> og
              kan præsenteres via print-venlig one-pager.
            </li>
          </ol>
        </div>
      )}
    </>
  );
}
