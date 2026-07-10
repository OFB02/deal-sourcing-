/**
 * CRM-sektioner på dealsiden: kontaktlog (relationsdata) og
 * investor-matches. Ejendomsdata og relationsdata holdes adskilt.
 */
import type { Deal, Investor, InvestorMatch, Kontakt } from "@/lib/model";
import { INVESTOR_MATCH_STATUSSER, KONTAKT_KANALER } from "@/lib/model";
import {
  gemInvestorMatchAction,
  sletInvestorMatchAction,
  sletKontaktAction,
  tilfoejKontaktAction,
} from "@/lib/actions";
import Link from "next/link";

export function KontaktlogSektion({ deal, kontakter }: { deal: Deal; kontakter: Kontakt[] }) {
  const iDag = new Date().toISOString().slice(0, 10);
  return (
    <section className="card" id="kontaktlog">
      <h2>Kontaktlog <span className="small muted">(sælger, mægler, kurator, skifteret…)</span></h2>

      {kontakter.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Dato</th>
              <th>Kanal</th>
              <th>Person</th>
              <th>Resumé</th>
              <th>Næste skridt</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {kontakter.map((k) => (
              <tr key={k.id}>
                <td style={{ whiteSpace: "nowrap" }}>{new Date(k.dato).toLocaleDateString("da-DK")}</td>
                <td>{k.kanal}</td>
                <td>{k.person || "–"}</td>
                <td>{k.resume || "–"}</td>
                <td>
                  {k.naesteSkridt || "–"}
                  {k.naesteSkridtDato && (
                    <div className="small muted">senest {new Date(k.naesteSkridtDato).toLocaleDateString("da-DK")}</div>
                  )}
                </td>
                <td>
                  <form action={sletKontaktAction}>
                    <input type="hidden" name="dealId" value={deal.id} />
                    <input type="hidden" name="kontaktId" value={k.id} />
                    <button type="submit" className="fare">Slet</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <details className="sektion" style={{ marginTop: 12 }} open={kontakter.length === 0}>
        <summary>Registrér kontakt</summary>
        <form action={tilfoejKontaktAction}>
          <input type="hidden" name="dealId" value={deal.id} />
          <div className="form-raekke">
            <div>
              <label>Dato</label>
              <input type="date" name="dato" defaultValue={iDag} />
            </div>
            <div>
              <label>Kanal</label>
              <select name="kanal">
                {KONTAKT_KANALER.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Person/rolle</label>
              <input type="text" name="person" placeholder="Fx mægler Jens, kurator..." />
            </div>
          </div>
          <label>Resumé</label>
          <textarea name="resume" placeholder="Hvad blev sagt/aftalt?" />
          <div className="form-raekke">
            <div>
              <label>Næste skridt</label>
              <input type="text" name="naesteSkridt" placeholder="Fx følg op med bud, bed om regnskaber" />
            </div>
            <div>
              <label>Frist for næste skridt</label>
              <input type="date" name="naesteSkridtDato" />
            </div>
          </div>
          <button type="submit" style={{ marginTop: 10 }}>Gem kontakt</button>
        </form>
      </details>
    </section>
  );
}

export function InvestorMatchSektion({
  deal,
  matches,
  investorer,
}: {
  deal: Deal;
  matches: InvestorMatch[];
  investorer: Investor[];
}) {
  return (
    <section className="card" id="investorer">
      <h2>Investor-matches</h2>

      {matches.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Investor</th>
              <th>Status</th>
              <th>Note</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => (
              <tr key={m.id}>
                <td><strong>{m.investorNavn}</strong></td>
                <td>
                  <span className={`badge ${m.status === "Interesseret" ? "klar" : m.status === "Afvist" ? "afvist" : "shortlist"}`}>
                    {m.status}
                  </span>
                </td>
                <td>{m.note || "–"}</td>
                <td>
                  <form action={sletInvestorMatchAction}>
                    <input type="hidden" name="dealId" value={deal.id} />
                    <input type="hidden" name="matchId" value={m.id} />
                    <button type="submit" className="fare">Fjern</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {investorer.length === 0 ? (
        <p className="muted small">
          Ingen investorer i systemet endnu - <Link href="/investorer">tilføj dem her</Link>.
        </p>
      ) : (
        <form action={gemInvestorMatchAction} style={{ marginTop: 12 }}>
          <input type="hidden" name="dealId" value={deal.id} />
          <div className="form-raekke">
            <div>
              <label>Investor</label>
              <select name="investorId">
                {investorer.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.navn}{i.selskab ? ` (${i.selskab})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Status</label>
              <select name="status">
                {INVESTOR_MATCH_STATUSSER.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Note</label>
              <input type="text" name="note" placeholder="Fx sendt teaser 12/7" />
            </div>
          </div>
          <button type="submit" style={{ marginTop: 10 }}>Gem match</button>
          <p className="small muted">Findes matchet allerede, opdateres status og note.</p>
        </form>
      )}
    </section>
  );
}
