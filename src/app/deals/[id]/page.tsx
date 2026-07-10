/**
 * Deal-detaljeside: automatiske registerdata, nøgletal, tjekliste
 * og alle manuelle sektioner.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  hentDeal,
  hentDokumenter,
  hentInvestorer,
  hentInvestorMatches,
  hentKontakter,
} from "@/lib/db";
import { beregnDistress } from "@/lib/distress";
import { beregnNoegletal, kr, pct, tal } from "@/lib/noegletal";
import { beregnTjekliste } from "@/lib/tjekliste";
import { STATUS_LABELS, STATUS_RAEKKEFOELGE } from "@/lib/model";
import { genindhentAutoAction, saetStatusAction, sletDealAction } from "@/lib/actions";
import AutoData from "./AutoData";
import { InvestorMatchSektion, KontaktlogSektion } from "./CrmSektioner";
import {
  DokumentSektion,
  JuridiskSektion,
  LejeforholdSektion,
  NoteSektion,
  OekonomiSektion,
  PrisSektion,
  StandSektion,
} from "./ManuelleSektioner";

export const dynamic = "force-dynamic";

export default async function DealSide({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deal = hentDeal(Number(id));
  if (!deal) notFound();

  const dokumenter = hentDokumenter(deal.id);
  const kontakter = hentKontakter(deal.id);
  const investorer = hentInvestorer();
  const matches = hentInvestorMatches(deal.id);
  const n = beregnNoegletal(deal);
  const tjekliste = beregnTjekliste(deal, dokumenter);
  const distress = beregnDistress(deal.auto);

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <h1>{deal.adresse.betegnelse}</h1>
          <p className="muted small">
            Matr.nr. {deal.adresse.matrikelnr}, {deal.adresse.ejerlav} · BFE {deal.adresse.bfeNummer}
            {" · "}Oprettet {new Date(deal.oprettet).toLocaleDateString("da-DK")}
          </p>
        </div>
        <div className="ingen-print" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <form action={saetStatusAction} style={{ display: "flex", gap: 8 }}>
            <input type="hidden" name="dealId" value={deal.id} />
            <select name="status" defaultValue={deal.status}>
              {STATUS_RAEKKEFOELGE.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
            <button type="submit" className="sekundaer">Skift status</button>
          </form>
          <Link href={`/deals/${deal.id}/praesentation`} className="btn">Deal-præsentation</Link>
        </div>
      </div>

      <div style={{ margin: "10px 0 18px" }}>
        <span className={`badge ${deal.status}`}>{STATUS_LABELS[deal.status]}</span>{" "}
        {tjekliste.klarTilSourcing ? (
          <span className="badge klar">✓ Alle krævede oplysninger på plads</span>
        ) : (
          <span className="badge indhentning">
            {tjekliste.antalKraevetOpfyldt}/{tjekliste.antalKraevet} krævede oplysninger på plads
          </span>
        )}
      </div>

      {/* Nøgletal */}
      <div className="kpi-raekke" style={{ marginBottom: 20 }}>
        <div className="kpi">
          <div className="label">Pris</div>
          <div className="vaerdi">{kr(n.beregningspris)}</div>
          <div className="sub">{deal.pris.forventetKoebspris ? "forventet købspris" : "udbudspris"}</div>
        </div>
        <div className="kpi">
          <div className="label">Nettoafkast</div>
          <div className="vaerdi">{pct(n.nettoafkastPct)}</div>
          <div className="sub">NOI {kr(n.noi)}</div>
        </div>
        <div className="kpi">
          <div className="label">Bruttoafkast</div>
          <div className="vaerdi">{pct(n.bruttoafkastPct)}</div>
          <div className="sub">Bruttoleje {kr(n.bruttoleje)}</div>
        </div>
        <div className="kpi">
          <div className="label">Kvm-pris</div>
          <div className="vaerdi">{n.kvmPris ? tal(n.kvmPris) : "–"}</div>
          <div className="sub">
            marked: {n.markedsKvmPris ? tal(n.markedsKvmPris) : "–"}
            {n.kvmPrisAfvigelsePct != null && ` (${n.kvmPrisAfvigelsePct > 0 ? "+" : ""}${n.kvmPrisAfvigelsePct} %)`}
          </div>
        </div>
        <div className="kpi">
          <div className="label">Areal</div>
          <div className="vaerdi">{n.samletAreal ? tal(n.samletAreal, " m²") : "–"}</div>
          <div className="sub">leje/m²/år: {n.lejePrKvm ? tal(n.lejePrKvm) : "–"}</div>
        </div>
        <div className="kpi">
          <div className="label">Tomgang</div>
          <div className="vaerdi">{n.tomgangsprocent != null ? `${n.tomgangsprocent} %` : "–"}</div>
          <div className="sub">af {deal.lejeforhold.lejemaal.length || "?"} lejemål</div>
        </div>
        <div className="kpi">
          <div className="label">Distress-score</div>
          <div className={`vaerdi score-tal ${distress.niveau}`}>{distress.score}</div>
          <div className="sub">{distress.signaler.length} signal{distress.signaler.length === 1 ? "" : "er"}</div>
        </div>
      </div>

      {distress.signaler.length > 0 && (
        <div className="card">
          <h2>Distress-signaler</h2>
          <table>
            <tbody>
              {distress.signaler.map((s) => (
                <tr key={s.navn}>
                  <td style={{ width: 180 }}><strong>{s.navn}</strong></td>
                  <td className="num" style={{ width: 90, whiteSpace: "nowrap" }}>+{s.point} / {s.maksPoint}</td>
                  <td>{s.begrundelse}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small muted">
            Vægtene kan justeres i <code>src/lib/distress.ts</code> uden at ændre dataindhentningen.
          </p>
        </div>
      )}

      {/* Flags */}
      {n.flags.length > 0 && (
        <div className="card">
          <h2>Opmærksomhedspunkter</h2>
          {n.flags.map((f, i) => (
            <span key={i} className={`flag ${f.type}`}>
              {f.type === "positiv" ? "▲ " : f.type === "advarsel" ? "⚠ " : "ℹ "}
              {f.tekst}
            </span>
          ))}
        </div>
      )}

      <div className="grid2">
        {/* Tjekliste */}
        <div className="card">
          <h2>Tjekliste - klar til sourcing?</h2>
          <div className={`fremdrift ${tjekliste.klarTilSourcing ? "" : "delvis"}`} style={{ marginBottom: 12 }}>
            <div style={{ width: `${tjekliste.procent}%` }} />
          </div>
          {tjekliste.grupper.map((g) => (
            <div key={g.navn} style={{ marginBottom: 10 }}>
              <h3>{g.navn}</h3>
              <ul className="tjek">
                {g.punkter.map((p) => (
                  <li key={p.tekst}>
                    <span className={p.opfyldt ? "ok" : "mangler"}>{p.opfyldt ? "✓" : "○"}</span>
                    <span style={{ opacity: p.opfyldt ? 1 : 0.75 }}>
                      {p.tekst}
                      {!p.kraevet && <span className="muted"> (valgfri)</span>}
                    </span>
                    <span className="kilde">{p.kilde === "auto" ? "auto" : "manuel"}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Automatiske data */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <h2>Registerdata (automatisk)</h2>
            <form action={genindhentAutoAction} className="ingen-print">
              <input type="hidden" name="dealId" value={deal.id} />
              <button type="submit" className="sekundaer lille">Genindhent</button>
            </form>
          </div>
          {deal.auto ? (
            <>
              <p className="small muted">
                Hentet {new Date(deal.auto.hentetTidspunkt).toLocaleString("da-DK")}
              </p>
              <AutoData auto={deal.auto} />
            </>
          ) : (
            <p className="muted">Registerdata er ikke hentet endnu - klik “Genindhent”.</p>
          )}
        </div>
      </div>

      {/* Manuelle sektioner */}
      <div className="sektionsnav ingen-print">
        <a href="#kontaktlog">Kontaktlog</a>
        <a href="#lejeforhold">Lejeforhold</a>
        <a href="#oekonomi">Driftsøkonomi</a>
        <a href="#stand">Stand</a>
        <a href="#pris">Pris & finansiering</a>
        <a href="#juridisk">Juridisk</a>
        <a href="#dokumenter">Dokumenter</a>
        <a href="#investorer">Investorer</a>
        <a href="#noter">Noter</a>
      </div>

      <KontaktlogSektion deal={deal} kontakter={kontakter} />
      <LejeforholdSektion deal={deal} />
      <OekonomiSektion deal={deal} />
      <StandSektion deal={deal} />
      <PrisSektion deal={deal} />
      <JuridiskSektion deal={deal} />
      <DokumentSektion deal={deal} dokumenter={dokumenter} />
      <InvestorMatchSektion deal={deal} matches={matches} investorer={investorer} />
      <NoteSektion deal={deal} />

      <form
        action={sletDealAction}
        className="ingen-print"
        style={{ marginTop: 8, textAlign: "right" }}
      >
        <input type="hidden" name="dealId" value={deal.id} />
        <button type="submit" className="fare">Slet deal</button>
      </form>
    </>
  );
}
