# Deal Sourcing - danske udlejningsejendomme

Udkast til en platform, der automatiserer den del af deal sourcing-arbejdet,
der kan hentes fra offentlige registre, og strukturerer resten som manuel
indhentning pr. deal. Alle datakilder kører som **mock** indtil de rigtige
API'er kobles på - appen er fuldt funktionel med testdata fra dag ét.

## Kom i gang

```bash
npm install
npm run dev        # http://localhost:3000
```

Databasen (SQLite) og upload-mappen oprettes automatisk i `./data/`
(git-ignoreret). Ingen API-nøgler er nødvendige i mock-tilstand.

**Prøv det:** Klik "+ Ny deal", søg fx *Vesterbrogade*, *Søndergade* eller en
vilkårlig adresse som "Hovedgaden 4, 4600", og opret dealen - registerdata
hentes automatisk (mock).

## Arbejdsgangen

1. **Opret deal** - søg adressen frem (DAWA). Ved oprettelse hentes automatisk:
   - **BBR**: byggeår, anvendelseskode, arealer, enheder/lejemål, tag/varme
   - **Offentlig ejendomsvurdering** inkl. historik (sanity check mod prisen)
   - **Ejerforhold**: privatperson/selskab/dødsbo; ved selskab CVR-data og
     seneste årsregnskaber
   - **Plandata**: kommuneplanramme og lokalplaner (inkl. forslag)
   - **Markedsdata**: kvm-priser og typisk afkastkrav for området
2. **Screening** - nøgletal og automatiske opmærksomhedspunkter (kvm-pris vs.
   marked, afkast vs. afkastkrav, dødsbo, lokalplanforslag, byggeår m.m.)
   hjælper med at filtrere ned til de interessante emner.
3. **Manuel indhentning** - det, der ikke findes i registre, registreres pr.
   deal med formularer og dokumentupload:
   - Lejeforhold: lejeregulering, lejeliste pr. lejemål (kan forudfyldes fra
     BBR-enhederne), tomgang, huslejenævnssager
   - Driftsøkonomi: 2-3 års regnskab (NOI beregnes automatisk), planlagte
     forbedringer og PBL-varslinger
   - Stand: karakter 1-5 for tag, facade, VVS, el, vinduer + renoveringsbudget
   - Pris/finansiering: udbudspris, belåning til overtagelse, sælgers motivation
   - Juridisk: tingbogsattest, hæftelser, servitutter, verserende sager
4. **Tjeklisten** viser løbende, hvilke krævede punkter der mangler. Når alle
   er opfyldt, er dealen **klar til sourcing**.
5. **Deal-præsentation** - print-venlig one-pager pr. deal (print til PDF).

## Arkitektur

```
src/
├── integrations/          ← datakilde-laget (det du udskifter senere)
│   ├── types.ts           ← domænetyper + klient-interfaces (kontrakten)
│   ├── index.ts           ← fabrik: vælger mock/real pr. kilde ud fra .env
│   ├── mock/clients.ts    ← deterministisk testdata (aktiv som standard)
│   └── real/clients.ts    ← skeletter til de rigtige API'er (TODO'er + docs)
├── lib/
│   ├── model.ts           ← deal-modellen (manuelle sektioner)
│   ├── db.ts              ← SQLite-datalag (better-sqlite3, ./data/deals.db)
│   ├── actions.ts         ← server actions (alle mutationer)
│   ├── noegletal.ts       ← NOI, afkast, kvm-pris, flags
│   └── tjekliste.ts       ← "klar til sourcing"-tjeklisten
└── app/                   ← Next.js-sider (pipeline, ny deal, deal, præsentation)
```

## Sådan kobler du de rigtige API'er på

Hver kilde styres uafhængigt via `.env` (kopiér `.env.example` til `.env`):

| Miljøvariabel | Kilde | Adgang |
|---|---|---|
| `DATASOURCE_DAWA` | Adresser/matrikel (Dataforsyningen) | Åben, gratis - **klienten er allerede implementeret** |
| `DATASOURCE_BBR` | BBR via Datafordeler.dk | Gratis tjenestebruger |
| `DATASOURCE_VURDERING` | Ejendomsvurdering via Datafordeler | Samme tjenestebruger |
| `DATASOURCE_CVR` | Ejerfortegnelsen + CVR (Virk) | Datafordeler + CVR-aftale |
| `DATASOURCE_PLANDATA` | Plandata.dk | Åben |
| `DATASOURCE_MARKED` | Finans Danmarks boligmarkedsstatistik | Åben, aggregeret |

Fremgangsmåde pr. kilde:

1. Implementér den tilhørende klasse i `src/integrations/real/clients.ts`
   (hver klasse har en TODO-beskrivelse af endpoint og mapping).
2. Map API-svaret til domænetypen i `src/integrations/types.ts` - resten af
   appen rører du ikke.
3. Sæt `DATASOURCE_<KILDE>=real` i `.env` og genstart.

Kilder kan omstilles én ad gangen; fejler en kilde, samles fejlen pr. deal og
de øvrige kilder hentes stadig. Siden **/datakilder** i appen viser live,
hvilke kilder der kører mock vs. rigtig API.

### Bevidst manuelt (ingen API findes)

- **Lejeliste/lejekontrakter og driftsregnskaber**: findes ikke i offentlige
  registre - indhentes fra sælger/mægler.
- **Tingbogsattest**: tinglysning.dk kræver MitID-login og betaling pr.
  opslag; ingen åben bulk-API til kommerciel brug.
- **Sammenlignelige enkelthandler**: Boliga m.fl. har ikke åbne API'er, og
  systematisk scraping er imod deres vilkår - derfor bruges Finans Danmarks
  aggregerede statistik som lovligt alternativ.

## Status og videre arbejde

Dette er et udkast. Oplagte næste skridt:

- [ ] Implementér `RealBbrClient` m.fl. efterhånden som API-adgang opnås
- [ ] Bruger-login hvis flere skal arbejde i samme pipeline
- [ ] Automatisk overvågning: kør screening på nye ejendomme i et område (kræver kilde til udbudte ejendomme)
- [ ] Følsomhedsberegning (renoveringsbudget/lejepotentiale → afkast)
- [ ] Eksport af deal-præsentation direkte til PDF
