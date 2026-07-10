/**
 * Formularer til den manuelle indhentning: lejeforhold, driftsøkonomi,
 * stand, pris/finansiering, juridisk, dokumenter og noter.
 * Alle formularer gemmer via server actions.
 */
import type { Deal, Dokument } from "@/lib/model";
import { DOKUMENT_KATEGORIER } from "@/lib/model";
import { beregnDriftsudgifter, beregnNoi, kr } from "@/lib/noegletal";
import {
  gemDriftsAarAction,
  gemJuridiskAction,
  gemLejeforholdAction,
  gemNoterAction,
  gemOekonomiNoterAction,
  gemPrisAction,
  gemStandAction,
  opdaterLejemaalAction,
  opretLejelisteFraBbrAction,
  sletDokumentAction,
  sletDriftsAarAction,
  sletLejemaalAction,
  tilfoejLejemaalAction,
  uploadDokumentAction,
} from "@/lib/actions";

const STAND_VALG = [
  { v: "", t: "Ikke vurderet" },
  { v: "1", t: "1 - Kritisk" },
  { v: "2", t: "2 - Dårlig" },
  { v: "3", t: "3 - Middel" },
  { v: "4", t: "4 - God" },
  { v: "5", t: "5 - Nyistandsat" },
];

function StandSelect({ navn, label, vaerdi }: { navn: string; label: string; vaerdi: number | null }) {
  return (
    <div>
      <label htmlFor={`stand-${navn}`}>{label}</label>
      <select id={`stand-${navn}`} name={navn} defaultValue={vaerdi ?? ""}>
        {STAND_VALG.map((o) => (
          <option key={o.v} value={o.v}>{o.t}</option>
        ))}
      </select>
    </div>
  );
}

export function LejeforholdSektion({ deal }: { deal: Deal }) {
  const lf = deal.lejeforhold;
  return (
    <section className="card" id="lejeforhold">
      <h2>Lejeforhold <span className="small muted">(manuel - fra sælger/mægler)</span></h2>

      <form action={gemLejeforholdAction}>
        <input type="hidden" name="dealId" value={deal.id} />
        <div className="form-raekke">
          <div>
            <label htmlFor="lejeregulering">Lejeregulering</label>
            <select id="lejeregulering" name="lejeregulering" defaultValue={lf.lejeregulering}>
              <option value="ukendt">Ukendt / ikke afklaret</option>
              <option value="omkostningsbestemt">Omkostningsbestemt leje</option>
              <option value="fri_leje">Fri leje</option>
              <option value="smaahusreglerne">Småhusreglerne</option>
              <option value="blandet">Blandet</option>
            </select>
          </div>
          <div>
            <label htmlFor="hn-sager">Verserende huslejenævnssager</label>
            <input id="hn-sager" type="text" name="verserendeHuslejenaevnssager" defaultValue={lf.verserendeHuslejenaevnssager} placeholder="Fx sagsnr. og status - tomt hvis ingen" />
          </div>
        </div>
        <label htmlFor="lf-note">Note</label>
        <textarea id="lf-note" name="note" defaultValue={lf.note} />
        <button type="submit" style={{ marginTop: 10 }}>Gem lejeforhold</button>
      </form>

      <h3 style={{ marginTop: 20 }}>Lejeliste ({lf.lejemaal.length} lejemål)</h3>
      {lf.lejemaal.length === 0 && deal.auto?.bbr && (
        <form action={opretLejelisteFraBbrAction} style={{ marginBottom: 12 }}>
          <input type="hidden" name="dealId" value={deal.id} />
          <button type="submit" className="sekundaer">
            Opret lejeliste-skelet fra BBR-enhederne ({deal.auto.bbr.enheder.length} stk.)
          </button>
        </form>
      )}
      {lf.lejemaal.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Lejemål</th>
              <th>Type</th>
              <th className="num">Areal</th>
              <th className="num">Leje kr./md.</th>
              <th>Tomgang</th>
              <th>HN-sag</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lf.lejemaal.map((l) => (
              <tr key={l.id}>
                <td>
                  {l.betegnelse || "–"}
                  {l.note && <div className="small muted">{l.note}</div>}
                </td>
                <td>{l.type}</td>
                <td className="num">{l.areal != null ? `${l.areal} m²` : "–"}</td>
                <td className="num" style={{ minWidth: 130 }}>
                  <form action={opdaterLejemaalAction} style={{ display: "flex", gap: 6, justifyContent: "flex-end" }} id={`lm-${l.id}`}>
                    <input type="hidden" name="dealId" value={deal.id} />
                    <input type="hidden" name="lejemaalId" value={l.id} />
                    <input type="number" name="maanedsleje" defaultValue={l.maanedsleje ?? ""} placeholder="kr./md." style={{ width: 100, padding: "3px 6px" }} />
                  </form>
                </td>
                <td>
                  <input type="checkbox" name="tomgang" defaultChecked={l.tomgang} form={`lm-${l.id}`} />
                </td>
                <td>
                  <input type="checkbox" name="huslejenaevnssag" defaultChecked={l.huslejenaevnssag} form={`lm-${l.id}`} />
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button type="submit" className="lille sekundaer" form={`lm-${l.id}`}>Gem</button>{" "}
                  <form action={sletLejemaalAction} style={{ display: "inline" }}>
                    <input type="hidden" name="dealId" value={deal.id} />
                    <input type="hidden" name="lejemaalId" value={l.id} />
                    <button type="submit" className="fare">Slet</button>
                  </form>
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={3}><strong>I alt ({lf.lejemaal.filter((l) => l.tomgang).length} tomme)</strong></td>
              <td className="num">
                <strong>{kr(lf.lejemaal.reduce((s, l) => s + (l.maanedsleje ?? 0), 0))}</strong>
                <div className="small muted">= {kr(lf.lejemaal.reduce((s, l) => s + (l.maanedsleje ?? 0), 0) * 12)}/år</div>
              </td>
              <td colSpan={3}></td>
            </tr>
          </tbody>
        </table>
      )}

      <details className="sektion" style={{ marginTop: 12 }}>
        <summary>Tilføj lejemål manuelt</summary>
        <form action={tilfoejLejemaalAction}>
          <input type="hidden" name="dealId" value={deal.id} />
          <div className="form-raekke">
            <div>
              <label>Betegnelse</label>
              <input type="text" name="betegnelse" placeholder="Fx 2. tv" />
            </div>
            <div>
              <label>Type</label>
              <select name="type" defaultValue="bolig">
                <option value="bolig">Bolig</option>
                <option value="erhverv">Erhverv</option>
              </select>
            </div>
            <div>
              <label>Areal (m²)</label>
              <input type="number" name="areal" />
            </div>
            <div>
              <label>Leje kr./md.</label>
              <input type="number" name="maanedsleje" />
            </div>
            <div>
              <label>Opsigelsesvarsel</label>
              <input type="text" name="opsigelsesvarsel" placeholder="Fx 3 mdr." />
            </div>
          </div>
          <label className="check"><input type="checkbox" name="tomgang" /> Lejemålet står tomt</label>
          <label className="check"><input type="checkbox" name="huslejenaevnssag" /> Verserende huslejenævnssag</label>
          <label>Note</label>
          <input type="text" name="note" />
          <button type="submit" style={{ marginTop: 10 }}>Tilføj lejemål</button>
        </form>
      </details>
    </section>
  );
}

export function OekonomiSektion({ deal }: { deal: Deal }) {
  const oe = deal.oekonomi;
  const naesteAar = new Date().getFullYear() - 1;
  return (
    <section className="card" id="oekonomi">
      <h2>Driftsøkonomi <span className="small muted">(manuel - bed om 2-3 års regnskab)</span></h2>

      {oe.driftsaar.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>År</th>
              <th className="num">Bruttoleje</th>
              <th className="num">Ejd.skat</th>
              <th className="num">Forsikring</th>
              <th className="num">Vedligehold</th>
              <th className="num">Admin.</th>
              <th className="num">Renovation</th>
              <th className="num">Øvrige</th>
              <th className="num">Driftsudg. i alt</th>
              <th className="num">NOI</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {oe.driftsaar.map((d) => (
              <tr key={d.aar}>
                <td><strong>{d.aar}</strong></td>
                <td className="num">{kr(d.bruttolejeindtaegt)}</td>
                <td className="num">{kr(d.ejendomsskat)}</td>
                <td className="num">{kr(d.forsikring)}</td>
                <td className="num">{kr(d.vedligehold)}</td>
                <td className="num">{kr(d.administration)}</td>
                <td className="num">{kr(d.renovation)}</td>
                <td className="num">{kr(d.oevrigeUdgifter)}</td>
                <td className="num">{kr(beregnDriftsudgifter(d))}</td>
                <td className="num"><strong>{kr(beregnNoi(d))}</strong></td>
                <td>
                  <form action={sletDriftsAarAction}>
                    <input type="hidden" name="dealId" value={deal.id} />
                    <input type="hidden" name="aar" value={d.aar} />
                    <button type="submit" className="fare">Slet</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <details className="sektion" style={{ marginTop: 12 }} open={oe.driftsaar.length === 0}>
        <summary>Tilføj/opdatér driftsår</summary>
        <form action={gemDriftsAarAction}>
          <input type="hidden" name="dealId" value={deal.id} />
          <div className="form-raekke">
            <div><label>År</label><input type="number" name="aar" defaultValue={naesteAar} required /></div>
            <div><label>Bruttolejeindtægt</label><input type="number" name="bruttolejeindtaegt" /></div>
            <div><label>Ejendomsskat</label><input type="number" name="ejendomsskat" /></div>
            <div><label>Forsikring</label><input type="number" name="forsikring" /></div>
            <div><label>Vedligehold</label><input type="number" name="vedligehold" /></div>
            <div><label>Administration</label><input type="number" name="administration" /></div>
            <div><label>Renovation</label><input type="number" name="renovation" /></div>
            <div><label>Øvrige udgifter</label><input type="number" name="oevrigeUdgifter" /></div>
          </div>
          <button type="submit" style={{ marginTop: 10 }}>Gem driftsår</button>
          <p className="small muted">Findes året allerede, overskrives det. NOI beregnes automatisk.</p>
        </form>
      </details>

      <form action={gemOekonomiNoterAction} style={{ marginTop: 8 }}>
        <input type="hidden" name="dealId" value={deal.id} />
        <label>Planlagte/igangværende forbedringer</label>
        <textarea name="planlagteForbedringer" defaultValue={oe.planlagteForbedringer} placeholder="Fx tagudskiftning 2027, budget 1,8 mio." />
        <label>PBL-varslinger (påvirker fremtidig leje)</label>
        <textarea name="pblVarsling" defaultValue={oe.pblVarsling} />
        <button type="submit" style={{ marginTop: 10 }}>Gem</button>
      </form>
    </section>
  );
}

export function StandSektion({ deal }: { deal: Deal }) {
  const s = deal.stand;
  return (
    <section className="card" id="stand">
      <h2>Stand <span className="small muted">(manuel - besigtigelse; kritisk for renoveringsbudget)</span></h2>
      <form action={gemStandAction}>
        <input type="hidden" name="dealId" value={deal.id} />
        <div className="form-raekke">
          <StandSelect navn="tag" label="Tag" vaerdi={s.tag} />
          <StandSelect navn="facade" label="Facade" vaerdi={s.facade} />
          <StandSelect navn="vvs" label="VVS" vaerdi={s.vvs} />
          <StandSelect navn="el" label="El" vaerdi={s.el} />
          <StandSelect navn="vinduer" label="Vinduer" vaerdi={s.vinduer} />
          <div>
            <label>Renoveringsbudget (kr., skøn)</label>
            <input type="number" name="renoveringsbudget" defaultValue={s.renoveringsbudget ?? ""} />
          </div>
        </div>
        <label>Note</label>
        <textarea name="note" defaultValue={s.note} />
        <button type="submit" style={{ marginTop: 10 }}>Gem stand</button>
      </form>
    </section>
  );
}

export function PrisSektion({ deal }: { deal: Deal }) {
  const p = deal.pris;
  return (
    <section className="card" id="pris">
      <h2>Pris og finansiering <span className="small muted">(manuel)</span></h2>
      <form action={gemPrisAction}>
        <input type="hidden" name="dealId" value={deal.id} />
        <div className="form-raekke">
          <div><label>Udbudspris (kr.)</label><input type="number" name="udbudspris" defaultValue={p.udbudspris ?? ""} /></div>
          <div><label>Forventet købspris (kr.)</label><input type="number" name="forventetKoebspris" defaultValue={p.forventetKoebspris ?? ""} /></div>
          <div><label>Eksisterende belåning (kr.)</label><input type="number" name="eksisterendeBelaaning" defaultValue={p.eksisterendeBelaaning ?? ""} /></div>
          <div><label>Rente på belåning (%)</label><input type="number" step="0.01" name="belaaningRentePct" defaultValue={p.belaaningRentePct ?? ""} /></div>
        </div>
        <label className="check">
          <input type="checkbox" name="belaaningKanOvertages" defaultChecked={p.belaaningKanOvertages} />
          Belåningen kan overtages (kan give bedre rente end nyfinansiering)
        </label>
        <div className="grid2">
          <div>
            <label>Sælgers motivation</label>
            <textarea name="saelgersMotivation" defaultValue={p.saelgersMotivation} placeholder="Fx generationsskifte, ønsker hurtigt salg…" />
          </div>
          <div>
            <label>Tidshorisont</label>
            <textarea name="tidshorisont" defaultValue={p.tidshorisont} placeholder="Fx overtagelse ønskes 1. oktober" />
          </div>
        </div>
        <button type="submit" style={{ marginTop: 10 }}>Gem pris og finansiering</button>
      </form>
    </section>
  );
}

export function JuridiskSektion({ deal }: { deal: Deal }) {
  const j = deal.juridisk;
  return (
    <section className="card" id="juridisk">
      <h2>Juridisk <span className="small muted">(manuel - tingbog kræver MitID + betaling pr. opslag)</span></h2>
      <form action={gemJuridiskAction}>
        <input type="hidden" name="dealId" value={deal.id} />
        <label className="check">
          <input type="checkbox" name="tingbogsattestIndhentet" defaultChecked={j.tingbogsattestIndhentet} />
          Tingbogsattest indhentet (tinglysning.dk)
        </label>
        <div className="grid2">
          <div>
            <label>Hæftelser</label>
            <textarea name="haeftelser" defaultValue={j.haeftelser} placeholder="Pantebreve, ejerpant m.m. fra tingbogsattesten" />
          </div>
          <div>
            <label>Servitutter</label>
            <textarea name="servitutter" defaultValue={j.servitutter} />
          </div>
        </div>
        <label>Verserende sager (huslejenævn, boligret, syn og skøn)</label>
        <textarea name="verserendeSager" defaultValue={j.verserendeSager} />
        <label>Note</label>
        <textarea name="note" defaultValue={j.note} />
        <button type="submit" style={{ marginTop: 10 }}>Gem juridisk</button>
      </form>
    </section>
  );
}

export function DokumentSektion({ deal, dokumenter }: { deal: Deal; dokumenter: Dokument[] }) {
  return (
    <section className="card" id="dokumenter">
      <h2>Dokumenter <span className="small muted">(driftsregnskaber, lejekontrakter, tingbogsattest…)</span></h2>
      {dokumenter.length > 0 && (
        <table>
          <thead>
            <tr><th>Kategori</th><th>Fil</th><th>Uploadet</th><th></th></tr>
          </thead>
          <tbody>
            {dokumenter.map((d) => (
              <tr key={d.id}>
                <td><span className="badge screening">{d.kategori}</span></td>
                <td>{d.filnavn}</td>
                <td className="small muted">{new Date(d.uploadet).toLocaleDateString("da-DK")}</td>
                <td>
                  <form action={sletDokumentAction}>
                    <input type="hidden" name="dealId" value={deal.id} />
                    <input type="hidden" name="dokumentId" value={d.id} />
                    <button type="submit" className="fare">Slet</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <form action={uploadDokumentAction} style={{ marginTop: 12 }}>
        <input type="hidden" name="dealId" value={deal.id} />
        <div className="form-raekke">
          <div>
            <label>Kategori</label>
            <select name="kategori">
              {DOKUMENT_KATEGORIER.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Fil</label>
            <input type="file" name="fil" required />
          </div>
        </div>
        <button type="submit" style={{ marginTop: 10 }}>Upload</button>
      </form>
    </section>
  );
}

export function NoteSektion({ deal }: { deal: Deal }) {
  return (
    <section className="card" id="noter">
      <h2>Noter</h2>
      <form action={gemNoterAction}>
        <input type="hidden" name="dealId" value={deal.id} />
        <textarea name="noter" defaultValue={deal.noter} placeholder="Samtalenoter, aftaler med mægler, næste skridt…" style={{ minHeight: 110 }} />
        <button type="submit" style={{ marginTop: 10 }}>Gem noter</button>
      </form>
    </section>
  );
}
