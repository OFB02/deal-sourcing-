/**
 * Investorliste (CRM): kapital-siden af deal sourcing. Investorer kan
 * matches til deals på dealsiden, så du har aftagere klar, når en deal
 * er kvalificeret.
 */
import { opretInvestorAction, sletInvestorAction } from "@/lib/actions";
import { antalMatchesPrInvestor, hentInvestorer } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function Investorer() {
  const investorer = hentInvestorer();
  const matches = antalMatchesPrInvestor();

  return (
    <>
      <h1>Investorer</h1>
      <p className="muted">
        Byg investorlisten parallelt med pipelinen, så kapitalen er klar, når første deal er
        kvalificeret. Match investorer til konkrete deals på dealsiden.
      </p>

      <div className="card">
        <h2>Tilføj investor</h2>
        <form action={opretInvestorAction}>
          <div className="form-raekke">
            <div>
              <label>Navn *</label>
              <input type="text" name="navn" required />
            </div>
            <div>
              <label>Selskab</label>
              <input type="text" name="selskab" />
            </div>
            <div>
              <label>Kontakt (e-mail/telefon)</label>
              <input type="text" name="kontaktinfo" />
            </div>
            <div>
              <label>Fokus (område/type)</label>
              <input type="text" name="fokus" placeholder="Fx brokvartererne, 5-20 mio., value-add" />
            </div>
            <div>
              <label>Budget</label>
              <input type="text" name="budget" placeholder="Fx 10-30 mio." />
            </div>
          </div>
          <label>Note</label>
          <textarea name="note" />
          <button type="submit" style={{ marginTop: 10 }}>Tilføj investor</button>
        </form>
      </div>

      <div className="card">
        <h2>Liste ({investorer.length})</h2>
        {investorer.length === 0 ? (
          <p className="muted">Ingen investorer endnu.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Navn</th>
                <th>Kontakt</th>
                <th>Fokus</th>
                <th>Budget</th>
                <th className="num">Deal-matches</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {investorer.map((i) => (
                <tr key={i.id}>
                  <td>
                    <strong>{i.navn}</strong>
                    {i.selskab && <div className="small muted">{i.selskab}</div>}
                    {i.note && <div className="small muted">{i.note}</div>}
                  </td>
                  <td>{i.kontaktinfo || "–"}</td>
                  <td>{i.fokus || "–"}</td>
                  <td>{i.budget || "–"}</td>
                  <td className="num">{matches.get(i.id) ?? 0}</td>
                  <td>
                    <form action={sletInvestorAction}>
                      <input type="hidden" name="investorId" value={i.id} />
                      <button type="submit" className="fare">Slet</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
