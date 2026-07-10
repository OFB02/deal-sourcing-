/**
 * Tjekliste for deal-komplethed - bygget over spørgerammen til
 * sælger/mægler. Hvert punkt beregnes automatisk ud fra de data,
 * der er hentet eller indtastet, så man altid kan se, hvad der
 * mangler, før en deal er "klar til sourcing".
 */
import type { Deal } from "./model";
import type { Dokument } from "./model";

export interface TjekPunkt {
  tekst: string;
  opfyldt: boolean;
  kilde: "auto" | "manuel";
  /** false = rart at have, tæller ikke med i "klar"-vurderingen */
  kraevet: boolean;
}

export interface TjeklisteGruppe {
  navn: string;
  punkter: TjekPunkt[];
}

export interface Tjekliste {
  grupper: TjeklisteGruppe[];
  antalOpfyldt: number;
  antalKraevet: number;
  antalKraevetOpfyldt: number;
  procent: number;
  klarTilSourcing: boolean;
}

export function beregnTjekliste(deal: Deal, dokumenter: Dokument[]): Tjekliste {
  const a = deal.auto;
  const harDok = (kategori: string) => dokumenter.some((d) => d.kategori === kategori);

  const grupper: TjeklisteGruppe[] = [
    {
      navn: "Ejendomsdata",
      punkter: [
        { tekst: "Adresse og matrikelnummer", opfyldt: !!deal.adresse.matrikelnr, kilde: "auto", kraevet: true },
        { tekst: "Byggeår og evt. renoveringsår (BBR)", opfyldt: !!a?.bbr?.byggeaar, kilde: "auto", kraevet: true },
        { tekst: "Arealer og antal lejemål (BBR)", opfyldt: !!a?.bbr && a.bbr.samletBoligareal + a.bbr.samletErhvervsareal > 0, kilde: "auto", kraevet: true },
        { tekst: "Anvendelseskode (BBR)", opfyldt: !!a?.bbr?.anvendelseskode, kilde: "auto", kraevet: true },
        { tekst: "Standvurdering: tag, facade, VVS, el, vinduer", opfyldt: ([deal.stand.tag, deal.stand.facade, deal.stand.vvs, deal.stand.el, deal.stand.vinduer].filter((s) => s != null).length >= 5), kilde: "manuel", kraevet: true },
        { tekst: "Renoveringsbudget skønnet", opfyldt: deal.stand.renoveringsbudget != null, kilde: "manuel", kraevet: true },
      ],
    },
    {
      navn: "Lejeforhold",
      punkter: [
        { tekst: "Lejeregulering afklaret (omkostningsbestemt/fri leje)", opfyldt: deal.lejeforhold.lejeregulering !== "ukendt", kilde: "manuel", kraevet: true },
        { tekst: "Lejeliste med aktuel leje pr. lejemål", opfyldt: deal.lejeforhold.lejemaal.length > 0 && deal.lejeforhold.lejemaal.every((l) => l.tomgang || l.maanedsleje != null), kilde: "manuel", kraevet: true },
        { tekst: "Tomgang registreret pr. lejemål", opfyldt: deal.lejeforhold.lejemaal.length > 0, kilde: "manuel", kraevet: true },
        { tekst: "Huslejenævnssager afklaret", opfyldt: deal.lejeforhold.lejemaal.length > 0, kilde: "manuel", kraevet: false },
        { tekst: "Kopi af lejekontrakter", opfyldt: harDok("Lejekontrakt"), kilde: "manuel", kraevet: false },
      ],
    },
    {
      navn: "Økonomi",
      punkter: [
        { tekst: "Mindst 2 års driftsregnskab indtastet", opfyldt: deal.oekonomi.driftsaar.filter((d) => d.bruttolejeindtaegt != null).length >= 2, kilde: "manuel", kraevet: true },
        { tekst: "Driftsregnskab uploadet som dokument", opfyldt: harDok("Driftsregnskab"), kilde: "manuel", kraevet: false },
        { tekst: "Planlagte forbedringer/PBL-varslinger noteret", opfyldt: !!(deal.oekonomi.planlagteForbedringer.trim() || deal.oekonomi.pblVarsling.trim()), kilde: "manuel", kraevet: false },
      ],
    },
    {
      navn: "Pris og finansiering",
      punkter: [
        { tekst: "Udbudspris eller forventet købspris", opfyldt: deal.pris.udbudspris != null || deal.pris.forventetKoebspris != null, kilde: "manuel", kraevet: true },
        { tekst: "Offentlig ejendomsvurdering (sanity check)", opfyldt: !!a?.vurdering, kilde: "auto", kraevet: true },
        { tekst: "Eksisterende belåning afdækket", opfyldt: deal.pris.eksisterendeBelaaning != null, kilde: "manuel", kraevet: false },
        { tekst: "Sælgers motivation og tidshorisont", opfyldt: !!deal.pris.saelgersMotivation.trim(), kilde: "manuel", kraevet: true },
      ],
    },
    {
      navn: "Juridisk",
      punkter: [
        { tekst: "Tingbogsattest indhentet (hæftelser og servitutter)", opfyldt: deal.juridisk.tingbogsattestIndhentet || harDok("Tingbogsattest"), kilde: "manuel", kraevet: true },
        { tekst: "Verserende sager afklaret", opfyldt: deal.lejeforhold.lejemaal.length > 0, kilde: "manuel", kraevet: false },
        { tekst: "Ejerforhold afdækket (CVR-tjek ved selskab)", opfyldt: !!a?.ejer, kilde: "auto", kraevet: true },
      ],
    },
    {
      navn: "Markedskontekst",
      punkter: [
        { tekst: "Kvm-priser for området", opfyldt: !!a?.marked, kilde: "auto", kraevet: true },
        { tekst: "Plangrundlag og udviklingsplaner", opfyldt: !!a?.plandata, kilde: "auto", kraevet: true },
      ],
    },
  ];

  const alle = grupper.flatMap((g) => g.punkter);
  const antalOpfyldt = alle.filter((p) => p.opfyldt).length;
  const kraevede = alle.filter((p) => p.kraevet);
  const antalKraevetOpfyldt = kraevede.filter((p) => p.opfyldt).length;

  return {
    grupper,
    antalOpfyldt,
    antalKraevet: kraevede.length,
    antalKraevetOpfyldt,
    procent: Math.round((antalOpfyldt / alle.length) * 100),
    klarTilSourcing: antalKraevetOpfyldt === kraevede.length,
  };
}
