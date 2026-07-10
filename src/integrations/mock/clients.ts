/**
 * Mock-implementeringer af alle datakilde-klienter.
 *
 * Bruges når DATASOURCE_<KILDE>=mock (standard). Data er deterministisk
 * ud fra adressen, så samme ejendom altid ser ens ud.
 */
import type {
  AdresseMatch,
  BbrClient,
  BbrData,
  DawaClient,
  EjerClient,
  EjerInfo,
  MarkedsData,
  MarkedsDataClient,
  PlanData,
  PlanDataClient,
  Vurdering,
  VurderingClient,
} from "../types";
import { MOCK_ADRESSER, EJERLAV, basisKvmPris, hash, pick, seeded } from "./data";

function tilAdresseMatch(a: (typeof MOCK_ADRESSER)[number]): AdresseMatch {
  const seed = `${a.vejnavn} ${a.husnr}, ${a.postnr}`;
  return {
    id: `mock-${hash(seed).toString(16)}`,
    betegnelse: `${a.vejnavn} ${a.husnr}, ${a.postnr} ${a.postnrnavn}`,
    vejnavn: a.vejnavn,
    husnr: a.husnr,
    postnr: a.postnr,
    postnrnavn: a.postnrnavn,
    kommunekode: a.kommunekode,
    matrikelnr: `${seeded(seed, "matr", 100, 4999)}${pick(seed, "litra", ["a", "b", "c", "d", "e", ""])}`,
    ejerlav: pick(seed, "ejerlav", EJERLAV),
    bfeNummer: String(seeded(seed, "bfe", 1000000, 9999999)),
  };
}

export class MockDawaClient implements DawaClient {
  async soegAdresse(query: string): Promise<AdresseMatch[]> {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const hits = MOCK_ADRESSER.filter((a) =>
      `${a.vejnavn} ${a.husnr} ${a.postnr} ${a.postnrnavn}`.toLowerCase().includes(q)
    );
    // Matcher intet af testdataen? Lav en syntetisk adresse ud fra søgningen,
    // så man kan oprette deals på vilkårlige adresser i mock-tilstand.
    if (hits.length === 0 && q.length >= 5) {
      const m = query.trim().match(/^(.*?)\s+(\d+\w?)\s*,?\s*(\d{4})?/);
      if (m) {
        return [
          tilAdresseMatch({
            vejnavn: m[1].replace(/\b\w/g, (c) => c.toUpperCase()),
            husnr: m[2],
            postnr: m[3] ?? "2000",
            postnrnavn: m[3] ? "Danmark" : "Frederiksberg",
            kommunekode: "0147",
          }),
        ];
      }
    }
    return hits.map(tilAdresseMatch);
  }

  async hentAdresse(id: string): Promise<AdresseMatch | null> {
    const alle = MOCK_ADRESSER.map(tilAdresseMatch);
    return alle.find((a) => a.id === id) ?? null;
  }
}

export class MockBbrClient implements BbrClient {
  async hentBygningsdata(adresse: AdresseMatch): Promise<BbrData> {
    const s = adresse.betegnelse;
    const byggeaar = seeded(s, "byggeaar", 1885, 1975);
    const renoveret = seeded(s, "renprob", 0, 100) > 55;
    const antalBolig = seeded(s, "boligenheder", 6, 24);
    const antalErhverv = seeded(s, "erhvervprob", 0, 100) > 60 ? seeded(s, "erhvervenheder", 1, 3) : 0;
    const boligareal = antalBolig * seeded(s, "gnsareal", 55, 95);
    const erhvervsareal = antalErhverv * seeded(s, "erhvervareal", 80, 220);

    const enheder = [];
    for (let i = 0; i < antalBolig; i++) {
      enheder.push({
        adresse: `${adresse.vejnavn} ${adresse.husnr}, ${Math.floor(i / 2) + 1}. ${i % 2 === 0 ? "tv" : "th"}`,
        anvendelse: "Bolig",
        areal: seeded(s, `areal${i}`, 48, 110),
        vaerelser: seeded(s, `vaer${i}`, 1, 4),
        erhverv: false,
      });
    }
    for (let i = 0; i < antalErhverv; i++) {
      enheder.push({
        adresse: `${adresse.vejnavn} ${adresse.husnr}, st. ${i === 0 ? "tv" : "th"}`,
        anvendelse: pick(s, `erhtype${i}`, ["Butik", "Kontor", "Restaurant", "Klinik"]),
        areal: seeded(s, `erhareal${i}`, 80, 220),
        vaerelser: null,
        erhverv: true,
      });
    }

    return {
      byggeaar,
      omTilbygningsaar: renoveret ? seeded(s, "renaar", 1995, 2020) : null,
      anvendelseskode: antalErhverv > 0 ? "150" : "140",
      anvendelseTekst:
        antalErhverv > 0
          ? "Blandet bolig og erhverv (etageejendom)"
          : "Etagebolig-bygning, flerfamiliehus",
      samletBoligareal: boligareal,
      samletErhvervsareal: erhvervsareal,
      antalBoligenheder: antalBolig,
      antalErhvervsenheder: antalErhverv,
      antalEtager: seeded(s, "etager", 3, 6),
      tagmateriale: pick(s, "tag", ["Tegl", "Tagpap", "Skifer", "Fibercement"]),
      ydervaegsmateriale: pick(s, "vaeg", ["Mursten", "Pudset mur", "Bindingsværk"]),
      varmeinstallation: pick(s, "varme", ["Fjernvarme", "Centralvarme (gas)", "Fjernvarme"]),
      enheder,
    };
  }
}

export class MockVurderingClient implements VurderingClient {
  async hentVurdering(adresse: AdresseMatch): Promise<Vurdering> {
    const s = adresse.betegnelse;
    const basis = basisKvmPris(adresse.postnr);
    // Offentlig vurdering ligger typisk under markedsniveau
    const areal = seeded(s, "boligenheder", 6, 24) * seeded(s, "gnsareal", 55, 95);
    const ejendomsvaerdi = Math.round((areal * basis * seeded(s, "vurdfaktor", 55, 80)) / 100 / 100000) * 100000;
    const grundvaerdi = Math.round(ejendomsvaerdi * seeded(s, "grundandel", 18, 32) / 100 / 100000) * 100000;
    return {
      vurderingsaar: 2024,
      ejendomsvaerdi,
      grundvaerdi,
      historik: [
        { aar: 2020, ejendomsvaerdi: Math.round(ejendomsvaerdi * 0.78) },
        { aar: 2022, ejendomsvaerdi: Math.round(ejendomsvaerdi * 0.9) },
        { aar: 2024, ejendomsvaerdi },
      ],
    };
  }
}

export class MockEjerClient implements EjerClient {
  async hentEjerInfo(adresse: AdresseMatch): Promise<EjerInfo> {
    const s = adresse.betegnelse;
    const type = pick(s, "ejertype", [
      "selskab",
      "selskab",
      "privatperson",
      "privatperson",
      "doedsbo",
    ] as const);

    if (type !== "selskab") {
      return {
        ejertype: type,
        navn: type === "doedsbo" ? "Boet efter " + pick(s, "navn", ["K. Hansen", "E. Jørgensen", "B. Nielsen"]) : pick(s, "navn", ["Karsten Hansen", "Eva Jørgensen", "Bent Nielsen", "Ulla Madsen"]),
        cvrNummer: null,
        selskab: null,
      };
    }

    const cvr = String(seeded(s, "cvr", 10000000, 99999999));
    const navn = pick(s, "selskabsnavn", [
      "Ejendomsselskabet Havnen ApS",
      "KBH Boliginvest A/S",
      "Brdr. Larsen Ejendomme ApS",
      "Provinsens Ejendomme A/S",
      "Vestergade Holding ApS",
    ]);
    const resultatBasis = seeded(s, "resultat", -400, 2500) * 1000;
    return {
      ejertype: "selskab",
      navn,
      cvrNummer: cvr,
      selskab: {
        cvrNummer: cvr,
        navn,
        virksomhedsform: navn.includes("A/S") ? "Aktieselskab" : "Anpartsselskab",
        stiftelsesdato: `${seeded(s, "stiftaar", 1988, 2018)}-0${seeded(s, "stiftmdr", 1, 9)}-15`,
        status: "Normal",
        branche: "682040 Udlejning af erhvervsejendomme",
        regnskaber: [
          { aar: 2024, resultat: resultatBasis, egenkapital: resultatBasis * 6 },
          { aar: 2023, resultat: Math.round(resultatBasis * 0.85), egenkapital: resultatBasis * 5 },
          { aar: 2022, resultat: Math.round(resultatBasis * 0.7), egenkapital: Math.round(resultatBasis * 4.2) },
        ],
        reelleEjere: [pick(s, "reelejer", ["Michael Larsen", "Søren Vestergaard", "Anne Holm", "Peter Krogh"])],
      },
    };
  }
}

export class MockPlanDataClient implements PlanDataClient {
  async hentPlanData(adresse: AdresseMatch): Promise<PlanData> {
    const s = adresse.betegnelse;
    const harForslag = seeded(s, "planforslag", 0, 100) > 70;
    const lokalplaner: PlanData["lokalplaner"] = [
      {
        planId: `LP-${seeded(s, "lpnr", 100, 899)}`,
        navn: `Lokalplan for karréen ved ${adresse.vejnavn}`,
        status: "vedtaget",
        dato: `${seeded(s, "lpaar", 1995, 2018)}-06-01`,
        link: null,
      },
    ];
    if (harForslag) {
      lokalplaner.push({
        planId: `LP-${seeded(s, "lpnr2", 900, 1200)}`,
        navn: pick(s, "lpnavn", [
          "Fortætning og byudvikling ved stationen",
          "Nyt byområde med blandet bolig og erhverv",
          "Omdannelse af erhvervsområde til boliger",
        ]),
        status: "forslag",
        dato: "2025-11-01",
        link: null,
      });
    }
    return {
      kommuneplanramme: `${adresse.kommunekode}-B${seeded(s, "ramme", 10, 99)}`,
      anvendelseGenerel: "Boligområde - etagebolig",
      maksBebyggelsesprocent: pick(s, "bebygpct", [110, 150, 185, 210]),
      maksEtager: seeded(s, "maksetager", 4, 6),
      lokalplaner,
    };
  }
}

export class MockMarkedsDataClient implements MarkedsDataClient {
  async hentMarkedsData(postnr: string): Promise<MarkedsData> {
    const basis = basisKvmPris(postnr);
    const s = "marked-" + postnr;
    return {
      postnr,
      kvmPrisSeneste: basis + seeded(s, "just", -1500, 1500),
      kvmPrisUdvikling1Aar: seeded(s, "u1", -20, 80) / 10,
      kvmPrisUdvikling5Aar: seeded(s, "u5", 50, 350) / 10,
      antalHandlerSenesteAar: seeded(s, "handler", 4, 60),
      typiskAfkastkravPct: seeded(s, "afkast", 35, 60) / 10,
    };
  }
}
