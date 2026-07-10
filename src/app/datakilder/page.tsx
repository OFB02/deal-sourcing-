/**
 * Statusside for datakilderne: hvilke kører mock, hvilke kører rigtig API,
 * og hvad der skal til for at koble den rigtige kilde på.
 */
export const dynamic = "force-dynamic";

const KILDER = [
  {
    env: "DATASOURCE_DAWA",
    navn: "DAWA - adresser og matrikel",
    leverandoer: "Dataforsyningen (åben, gratis)",
    kraever: "Ingen nøgle. Den rigtige klient er allerede implementeret - sæt DATASOURCE_DAWA=real.",
    fil: "src/integrations/real/clients.ts → RealDawaClient",
  },
  {
    env: "DATASOURCE_BBR",
    navn: "BBR - bygnings- og boligregistret",
    leverandoer: "Datafordeler.dk",
    kraever: "Gratis tjenestebruger på datafordeler.dk (DATAFORDELER_USERNAME/PASSWORD).",
    fil: "src/integrations/real/clients.ts → RealBbrClient",
  },
  {
    env: "DATASOURCE_VURDERING",
    navn: "Offentlig ejendomsvurdering",
    leverandoer: "Datafordeler.dk (EJVF) / Vurderingsportalen",
    kraever: "Samme Datafordeler-tjenestebruger som BBR.",
    fil: "src/integrations/real/clients.ts → RealVurderingClient",
  },
  {
    env: "DATASOURCE_CVR",
    navn: "Ejerforhold og CVR",
    leverandoer: "Datafordeler (Ejerfortegnelsen) + Erhvervsstyrelsen/Virk",
    kraever: "Datafordeler-bruger + CVR system-til-system-aftale (CVR_API_USERNAME/PASSWORD).",
    fil: "src/integrations/real/clients.ts → RealEjerClient",
  },
  {
    env: "DATASOURCE_PLANDATA",
    navn: "Plandata - lokalplaner og kommuneplanrammer",
    leverandoer: "Plandata.dk (åben)",
    kraever: "Ingen nøgle - kun implementering af WFS-opslag.",
    fil: "src/integrations/real/clients.ts → RealPlanDataClient",
  },
  {
    env: "DATASOURCE_MARKED",
    navn: "Markedsdata - kvm-priser for området",
    leverandoer: "Finans Danmarks boligmarkedsstatistik (åben, aggregeret)",
    kraever: "Ingen nøgle. Bemærk: Boliga/DinGeo har ikke åbne API'er til kommerciel brug.",
    fil: "src/integrations/real/clients.ts → RealMarkedsDataClient",
  },
  {
    env: "DATASOURCE_STATSTIDENDE",
    navn: "Statstidende - dødsboer, konkurser, tvangsopløsninger",
    leverandoer: "Statstidende (gratis, opdateres dagligt)",
    kraever: "Gratis API-oprettelse på statstidende.dk. Kernesignal i distress-scoringen.",
    fil: "src/integrations/real/clients.ts → RealStatstidendeClient",
  },
  {
    env: "DATASOURCE_EJENDOMSSOEGNING",
    navn: "Ejendomssøgning - adresser til områdescreening",
    leverandoer: "DAWA (åben) + BBR-filtrering",
    kraever: "Ingen nøgle til DAWA. Kør som batch-job med lokal cache ved rigtig drift.",
    fil: "src/integrations/real/clients.ts → RealEjendomsSoegningClient",
  },
];

const MANUELLE = [
  { navn: "Lejeliste og lejekontrakter", hvorfor: "Findes ikke i offentlige registre - indhentes fra sælger/mægler." },
  { navn: "Driftsregnskaber (2-3 år)", hvorfor: "Kun via sælger/mægler. Er ejer et selskab, giver CVR-årsregnskaber et førstehåndsindtryk." },
  { navn: "Tingbogsattest (hæftelser/servitutter)", hvorfor: "Tinglysning.dk kræver MitID-login og betaling pr. opslag - ingen åben bulk-API." },
  { navn: "Standvurdering", hvorfor: "Kræver besigtigelse. Registreres pr. bygningsdel under dealen." },
  { navn: "Sælgers motivation og pris", hvorfor: "Dialog med sælger/mægler." },
];

export default function Datakilder() {
  return (
    <>
      <h1>Datakilder</h1>
      <p className="muted">
        Hver kilde kan omstilles mellem <strong>mock</strong> (testdata) og{" "}
        <strong>rigtig API</strong> via miljøvariabler - se <code>.env.example</code>.
        Platformen bruger <strong>kun gratis, offentlige kilder</strong>: ingen scraping,
        ingen AI-kald og ingen betalte opslag i den automatiske del.
      </p>

      <div className="card">
        <h2>Automatiske kilder</h2>
        <table>
          <thead>
            <tr>
              <th>Kilde</th>
              <th>Tilstand</th>
              <th>Leverandør</th>
              <th>Kræver</th>
            </tr>
          </thead>
          <tbody>
            {KILDER.map((k) => {
              const real = process.env[k.env] === "real";
              return (
                <tr key={k.env}>
                  <td>
                    <strong>{k.navn}</strong>
                    <div className="small muted">{k.fil}</div>
                  </td>
                  <td>
                    <span className={`badge ${real ? "klar" : "indhentning"}`}>
                      {real ? "Rigtig API" : "Mock"}
                    </span>
                  </td>
                  <td>{k.leverandoer}</td>
                  <td className="small">{k.kraever}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Manuel indhentning (kan ikke automatiseres)</h2>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Hvorfor manuel</th>
            </tr>
          </thead>
          <tbody>
            {MANUELLE.map((m) => (
              <tr key={m.navn}>
                <td>
                  <strong>{m.navn}</strong>
                </td>
                <td>{m.hvorfor}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="small muted">
          De manuelle punkter registreres pr. deal - tjeklisten på dealsiden viser, hvad der
          mangler, før dealen er klar til sourcing.
        </p>
      </div>
    </>
  );
}
