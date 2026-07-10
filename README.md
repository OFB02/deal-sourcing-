# Deal Sourcing - danske udlejningsejendomme

Platform der automatiserer den del af deal sourcing-arbejdet, der kan hentes
fra **gratis, offentlige registre**, og strukturerer resten som manuel
indhentning pr. deal.

**Principper:**

- **Kun gratis kilder** - ingen scraping, ingen AI-kald, ingen betalte
  opslag i den automatiske del. Det giver en stabil og hurtig pipeline uden
  løbende omkostninger.
- **Adapter-lag pr. datakilde** - alle kilder kører som mock, indtil de
  rigtige API'er kobles på (én ad gangen, via `.env`).
- **Scoring adskilt fra ingestion** - distress-modellen kan justeres uden
  at røre dataindhentningen.
- **Prioritering, ikke beslutning** - screeningen reducerer fx 500
  ejendomme til de 10-20, der er værd at ringe på.

## Kom i gang

```bash
npm install
npm run dev        # http://localhost:3000
```

Databasen (SQLite) og upload-mappen oprettes automatisk i `./data/`
(git-ignoreret). Ingen API-nøgler er nødvendige i mock-tilstand.

**Prøv det:** Gå til **Screening**, vælg fx postnr. 2200 (Nørrebro) og kør -
du får kvarterets udlejningsejendomme rangeret efter distress-score og kan
oprette deals direkte fra listen.

## Arbejdsgangen

1. **Områdescreening** (`/screening`) - vælg postnummer og lejemåls-kriterier
   (standard 4-15 lejemål, BBR-anvendelse 140/150). Alle adresser i området
   hentes (DAWA), filtreres på BBR og scores. Anbefaling: start med ét
   kvarter og valider scoringen manuelt på 20-30 ejendomme.
2. **Distress-scoring** - hvert emne scores 0-100 ud fra:
   - **Selskabsstatus** (25): under konkurs/tvangsopløsning, manglende regnskab
   - **Dødsbo** (20): ejertype og/eller proklama i Statstidende
   - **Ejertid** (15): lang ejertid = lav bogført værdi, ofte salgsvilje
   - **Bygningsefterslæb** (15): gammel bygning uden registreret ombygning
   - **Værdigab** (15): offentlig vurdering pr. m² langt under områdets kvm-pris
   - **Økonomisk pres** (10): negativt resultat/faldende egenkapital i ejerselskabet

   Vægtene ligger samlet i `src/lib/distress.ts` og kan justeres frit.
3. **Deal-arbejde** - opret deals på de bedste emner (registerdata hentes
   automatisk). Kontaktlog, lejeliste (kan forudfyldes fra BBR), 2-3 års
   driftsregnskab (NOI beregnes), stand, pris/finansiering, juridisk og
   dokumentupload. Tjeklisten viser, hvad der mangler, før dealen er
   **klar til sourcing**.
4. **CRM** - kontaktlog pr. deal (hvem, hvornår, næste skridt) og
   investorliste (`/investorer`) med matches pr. deal, så kapitalen er klar,
   når en deal er kvalificeret.
5. **Deal-præsentation** - print-venlig one-pager pr. deal (print til PDF).

## Arkitektur

```
src/
├── integrations/          ← ingestion-laget (det du udskifter senere)
│   ├── types.ts           ← domænetyper + klient-interfaces (kontrakten)
│   ├── index.ts           ← fabrik: vælger mock/real pr. kilde ud fra .env
│   ├── mock/              ← deterministisk testdata (aktiv som standard)
│   └── real/clients.ts    ← skeletter til de rigtige API'er (TODO'er + docs)
├── lib/
│   ├── model.ts           ← deal-modellen + CRM-typer
│   ├── db.ts              ← SQLite-datalag (./data/deals.db)
│   ├── actions.ts         ← server actions (alle mutationer)
│   ├── distress.ts        ← distress-scoring (justerbare vægte)
│   ├── screening.ts       ← områdescreening (find + filtrér + scor)
│   ├── noegletal.ts       ← NOI, afkast, kvm-pris, flags
│   └── tjekliste.ts       ← "klar til sourcing"-tjeklisten
└── app/                   ← sider: pipeline, screening, investorer, deal, præsentation
```

Lagene svarer til: ingestion → database → scoring → dashboard → CRM.
SQLite kan udskiftes med PostgreSQL ved kun at ændre `src/lib/db.ts` -
resten af appen kender ikke databasen.

## Datakilder (alle gratis)

| Miljøvariabel | Kilde | Adgang |
|---|---|---|
| `DATASOURCE_DAWA` | Adresser/matrikel (Dataforsyningen) | Åben - **implementeret og live-testet** (inkl. BFE-opslag via jordstykke) |
| `DATASOURCE_BBR` | BBR via Datafordeler.dk | Gratis tjenestebruger |
| `DATASOURCE_VURDERING` | Ejendomsvurdering via Datafordeler | Samme tjenestebruger |
| `DATASOURCE_CVR` | Ejerfortegnelsen + CVR (Virk) | Gratis system-til-system-aftale |
| `DATASOURCE_PLANDATA` | Plandata.dk | Åben |
| `DATASOURCE_MARKED` | Finans Danmarks boligmarkedsstatistik | Åben, aggregeret |
| `DATASOURCE_STATSTIDENDE` | Statstidende (dødsbo/konkurs/tvangsopløsning) | Gratis API, opdateres dagligt |
| `DATASOURCE_EJENDOMSSOEGNING` | Områdesøgning: DAWA-adresser + BBR-filter | Åben |

Fremgangsmåde pr. kilde:

1. Implementér klassen i `src/integrations/real/clients.ts` (hver har en
   TODO-beskrivelse af endpoint og mapping).
2. Map API-svaret til domænetypen i `src/integrations/types.ts`.
3. Sæt `DATASOURCE_<KILDE>=real` i `.env` og genstart.

Fejler en kilde, samles fejlen pr. deal, og de øvrige kilder hentes stadig.
Siden **/datakilder** viser live, hvad der kører mock vs. rigtig API.

**Ved rigtig drift af screeningen:** et postnr har tusindvis af adresser.
Kør adresse+BBR-indhentningen som batch-job (cron) med lokal cache, og lad
screeningen læse fra cachen - det holder API-kaldene nede og gør
screeningen hurtig og stabil.

### Bevidst manuelt (ingen gratis kilde findes)

- **Lejeliste/lejekontrakter og driftsregnskaber**: kun via sælger/mægler.
  Er ejeren et selskab, giver CVR-årsregnskaberne et gratis førstehåndsindtryk.
- **Tingbogsattest**: tinglysning.dk kræver MitID + betaling pr. opslag -
  indhentes kun for de få emner, der er nået langt i pipelinen.
- **Enkelthandler (Boliga m.fl.)**: ingen åben API, scraping er imod
  vilkårene - derfor bruges Finans Danmarks aggregerede statistik.

## Anbefalet rækkefølge mod produktion

1. **DAWA + BBR + CVR** kobles på rigtige API'er (teknisk ligetil, gratis)
2. **Statstidende**-API for dødsbo/opløsningssignaler
3. Batch-job + cache til områdescreeningen
4. **Manuel validering**: screen ét kvarter, kontakt de øverste 10-15 emner,
   og justér vægtene i `distress.ts` efter, hvilke signaler der faktisk
   holder
5. Først derefter: skalér geografisk eller til flere ejendomstyper

## Røgtest

```bash
npm run build && npm start   # i ét vindue
node scripts/smoke-test.mjs  # i et andet (kræver Playwright + Chromium)
```
