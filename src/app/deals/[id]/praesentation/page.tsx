/**
 * Print-venlig one-pager til præsentation af en færdig deal
 * (investorer, banker, partnere). Brug browserens print-til-PDF.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { hentDeal, hentDokumenter } from "@/lib/db";
import { beregnDriftsudgifter, beregnNoegletal, beregnNoi, kr, pct, tal } from "@/lib/noegletal";
import { beregnTjekliste } from "@/lib/tjekliste";

export const dynamic = "force-dynamic";

export default async function Praesentation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deal = hentDeal(Number(id));
  if (!deal) notFound();

  const n = beregnNoegletal(deal);
  const tj = beregnTjekliste(deal, hentDokumenter(deal.id));
  const bbr = deal.auto?.bbr;
  const aarligLeje = deal.lejeforhold.lejemaal.reduce((s, l) => s + (l.maanedsleje ?? 0), 0) * 12;

  return (
    <>
      <div className="ingen-print" style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Link href={`/deals/${deal.id}`}>← Tilbage til deal</Link>
        <span className="small muted">Brug browserens print (Ctrl/Cmd+P) for PDF.</span>
      </div>

      <div className="card">
        <p className="small muted" style={{ margin: 0 }}>Investeringscase · udlejningsejendom</p>
        <h1>{deal.adresse.betegnelse}</h1>
        <p className="muted small">
          Matr.nr. {deal.adresse.matrikelnr}, {deal.adresse.ejerlav} · BFE {deal.adresse.bfeNummer}
          {!tj.klarTilSourcing && " · UDKAST - dealen er ikke fuldt oplyst endnu"}
        </p>

        <div className="kpi-raekke" style={{ margin: "16px 0" }}>
          <div className="kpi"><div className="label">Pris</div><div className="vaerdi">{kr(n.beregningspris)}</div></div>
          <div className="kpi"><div className="label">Nettoafkast</div><div className="vaerdi">{pct(n.nettoafkastPct)}</div></div>
          <div className="kpi"><div className="label">Bruttoafkast</div><div className="vaerdi">{pct(n.bruttoafkastPct)}</div></div>
          <div className="kpi"><div className="label">NOI</div><div className="vaerdi">{kr(n.noi)}</div></div>
          <div className="kpi"><div className="label">Kvm-pris</div><div className="vaerdi">{n.kvmPris ? tal(n.kvmPris) : "–"}</div></div>
        </div>

        {n.flags.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            {n.flags.map((f, i) => (
              <span key={i} className={`flag ${f.type}`}>{f.tekst}</span>
            ))}
          </div>
        )}
      </div>

      <div className="grid2">
        <div className="card">
          <h2>Ejendommen</h2>
          <table>
            <tbody>
              {bbr && (
                <>
                  <tr><td className="muted">Type</td><td>{bbr.anvendelseTekst}</td></tr>
                  <tr><td className="muted">Byggeår</td><td>{bbr.byggeaar}{bbr.omTilbygningsaar ? ` / renoveret ${bbr.omTilbygningsaar}` : ""}</td></tr>
                  <tr><td className="muted">Bolig / erhverv</td><td>{tal(bbr.samletBoligareal, " m²")} / {tal(bbr.samletErhvervsareal, " m²")}</td></tr>
                  <tr><td className="muted">Lejemål</td><td>{bbr.antalBoligenheder} bolig, {bbr.antalErhvervsenheder} erhverv</td></tr>
                </>
              )}
              <tr><td className="muted">Offentlig vurdering</td><td>{kr(deal.auto?.vurdering?.ejendomsvaerdi ?? null)}</td></tr>
              <tr><td className="muted">Ejer</td><td>{deal.auto?.ejer?.navn ?? "–"} ({deal.auto?.ejer?.ejertype ?? "?"})</td></tr>
              <tr><td className="muted">Lejeregulering</td><td>{deal.lejeforhold.lejeregulering.replace("_", " ")}</td></tr>
              <tr><td className="muted">Tomgang</td><td>{n.tomgangsprocent != null ? `${n.tomgangsprocent} %` : "–"}</td></tr>
              <tr><td className="muted">Renoveringsbudget</td><td>{kr(deal.stand.renoveringsbudget)}</td></tr>
            </tbody>
          </table>

          <h2 style={{ marginTop: 16 }}>Marked ({deal.adresse.postnr} {deal.adresse.postnrnavn})</h2>
          <table>
            <tbody>
              <tr><td className="muted">Kvm-pris i området</td><td className="num">{kr(n.markedsKvmPris)}</td></tr>
              <tr><td className="muted">Afvigelse fra marked</td><td className="num">{n.kvmPrisAfvigelsePct != null ? `${n.kvmPrisAfvigelsePct > 0 ? "+" : ""}${n.kvmPrisAfvigelsePct} %` : "–"}</td></tr>
              <tr><td className="muted">Typisk afkastkrav</td><td className="num">{pct(deal.auto?.marked?.typiskAfkastkravPct ?? null)}</td></tr>
              <tr><td className="muted">Prisudvikling 5 år</td><td className="num">{pct(deal.auto?.marked?.kvmPrisUdvikling5Aar ?? null)}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2>Driftsøkonomi</h2>
          {deal.oekonomi.driftsaar.length > 0 ? (
            <table>
              <thead>
                <tr><th>År</th><th className="num">Bruttoleje</th><th className="num">Driftsudg.</th><th className="num">NOI</th></tr>
              </thead>
              <tbody>
                {deal.oekonomi.driftsaar.map((d) => (
                  <tr key={d.aar}>
                    <td>{d.aar}</td>
                    <td className="num">{kr(d.bruttolejeindtaegt)}</td>
                    <td className="num">{kr(beregnDriftsudgifter(d))}</td>
                    <td className="num"><strong>{kr(beregnNoi(d))}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted small">Driftsregnskab ikke indtastet endnu.</p>
          )}
          {aarligLeje > 0 && (
            <p className="small muted">Aktuel lejeliste: {kr(aarligLeje)}/år fordelt på {deal.lejeforhold.lejemaal.length} lejemål.</p>
          )}

          <h2 style={{ marginTop: 16 }}>Handlen</h2>
          <table>
            <tbody>
              <tr><td className="muted">Udbudspris</td><td className="num">{kr(deal.pris.udbudspris)}</td></tr>
              <tr><td className="muted">Forventet købspris</td><td className="num">{kr(deal.pris.forventetKoebspris)}</td></tr>
              <tr><td className="muted">Belåning til overtagelse</td><td className="num">{deal.pris.belaaningKanOvertages ? `${kr(deal.pris.eksisterendeBelaaning)} (${pct(deal.pris.belaaningRentePct)})` : "Nej"}</td></tr>
              <tr><td className="muted">Sælgers motivation</td><td>{deal.pris.saelgersMotivation || "–"}</td></tr>
              <tr><td className="muted">Tidshorisont</td><td>{deal.pris.tidshorisont || "–"}</td></tr>
            </tbody>
          </table>

          {(deal.juridisk.haeftelser || deal.juridisk.verserendeSager) && (
            <>
              <h2 style={{ marginTop: 16 }}>Juridiske forhold</h2>
              {deal.juridisk.haeftelser && <p className="small"><strong>Hæftelser:</strong> {deal.juridisk.haeftelser}</p>}
              {deal.juridisk.verserendeSager && <p className="small"><strong>Verserende sager:</strong> {deal.juridisk.verserendeSager}</p>}
            </>
          )}
        </div>
      </div>

      {deal.noter && (
        <div className="card">
          <h2>Noter</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{deal.noter}</p>
        </div>
      )}
    </>
  );
}
