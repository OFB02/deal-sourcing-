"use server";

/**
 * Server actions - alle mutationer fra UI'et samles her.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getDawaClient, koerAutoIndhentning } from "@/integrations";
import type { AdresseMatch } from "@/integrations/types";
import * as db from "./db";
import {
  DealStatus,
  Lejemaal,
  STATUS_RAEKKEFOELGE,
  tomLejeforhold,
} from "./model";

function num(fd: FormData, navn: string): number | null {
  const raw = String(fd.get(navn) ?? "").replace(/\./g, "").replace(",", ".").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function txt(fd: FormData, navn: string): string {
  return String(fd.get(navn) ?? "").trim();
}

/* ---------- Oprettelse og status ---------- */

export async function opretDealAction(formData: FormData) {
  const adresse: AdresseMatch = JSON.parse(String(formData.get("adresse")));
  const id = db.opretDeal(adresse);

  // Kør den automatiske indhentning med det samme, så screeningen
  // starter med alle tilgængelige registerdata.
  const auto = await koerAutoIndhentning(adresse);
  db.gemAuto(id, auto);

  revalidatePath("/");
  redirect(`/deals/${id}`);
}

export async function genindhentAutoAction(formData: FormData) {
  const id = Number(formData.get("dealId"));
  const deal = db.hentDeal(id);
  if (!deal) return;
  const auto = await koerAutoIndhentning(deal.adresse);
  db.gemAuto(id, auto);
  revalidatePath(`/deals/${id}`);
}

export async function saetStatusAction(formData: FormData) {
  const id = Number(formData.get("dealId"));
  const status = String(formData.get("status")) as DealStatus;
  if (STATUS_RAEKKEFOELGE.includes(status)) {
    db.saetStatus(id, status);
  }
  revalidatePath(`/deals/${id}`);
  revalidatePath("/");
}

export async function sletDealAction(formData: FormData) {
  const id = Number(formData.get("dealId"));
  db.sletDeal(id);
  revalidatePath("/");
  redirect("/");
}

/* ---------- Lejeforhold ---------- */

export async function gemLejeforholdAction(formData: FormData) {
  const id = Number(formData.get("dealId"));
  const deal = db.hentDeal(id);
  if (!deal) return;
  const lf = deal.lejeforhold ?? tomLejeforhold();
  lf.lejeregulering = String(formData.get("lejeregulering")) as typeof lf.lejeregulering;
  lf.verserendeHuslejenaevnssager = txt(formData, "verserendeHuslejenaevnssager");
  lf.note = txt(formData, "note");
  db.gemLejeforhold(id, lf);
  revalidatePath(`/deals/${id}`);
}

export async function tilfoejLejemaalAction(formData: FormData) {
  const id = Number(formData.get("dealId"));
  const deal = db.hentDeal(id);
  if (!deal) return;
  const nyt: Lejemaal = {
    id: crypto.randomUUID(),
    betegnelse: txt(formData, "betegnelse"),
    type: String(formData.get("type")) === "erhverv" ? "erhverv" : "bolig",
    areal: num(formData, "areal"),
    maanedsleje: num(formData, "maanedsleje"),
    tomgang: formData.get("tomgang") === "on",
    tomgangSiden: txt(formData, "tomgangSiden") || null,
    lejemaalStart: txt(formData, "lejemaalStart") || null,
    opsigelsesvarsel: txt(formData, "opsigelsesvarsel") || null,
    huslejenaevnssag: formData.get("huslejenaevnssag") === "on",
    note: txt(formData, "note"),
  };
  deal.lejeforhold.lejemaal.push(nyt);
  db.gemLejeforhold(id, deal.lejeforhold);
  revalidatePath(`/deals/${id}`);
}

export async function sletLejemaalAction(formData: FormData) {
  const id = Number(formData.get("dealId"));
  const lejemaalId = String(formData.get("lejemaalId"));
  const deal = db.hentDeal(id);
  if (!deal) return;
  deal.lejeforhold.lejemaal = deal.lejeforhold.lejemaal.filter((l) => l.id !== lejemaalId);
  db.gemLejeforhold(id, deal.lejeforhold);
  revalidatePath(`/deals/${id}`);
}

/** Genvej: opret lejeliste-skelet ud fra BBR-enhederne, så man slipper for at taste alle lejemål */
export async function opretLejelisteFraBbrAction(formData: FormData) {
  const id = Number(formData.get("dealId"));
  const deal = db.hentDeal(id);
  if (!deal?.auto?.bbr) return;
  if (deal.lejeforhold.lejemaal.length > 0) return; // overskriv ikke eksisterende
  deal.lejeforhold.lejemaal = deal.auto.bbr.enheder.map((e) => ({
    id: crypto.randomUUID(),
    betegnelse: e.adresse,
    type: e.erhverv ? "erhverv" : "bolig",
    areal: e.areal,
    maanedsleje: null,
    tomgang: false,
    tomgangSiden: null,
    lejemaalStart: null,
    opsigelsesvarsel: null,
    huslejenaevnssag: false,
    note: "",
  }));
  db.gemLejeforhold(id, deal.lejeforhold);
  revalidatePath(`/deals/${id}`);
}

export async function opdaterLejemaalAction(formData: FormData) {
  const id = Number(formData.get("dealId"));
  const lejemaalId = String(formData.get("lejemaalId"));
  const deal = db.hentDeal(id);
  if (!deal) return;
  const l = deal.lejeforhold.lejemaal.find((x) => x.id === lejemaalId);
  if (!l) return;
  l.maanedsleje = num(formData, "maanedsleje");
  l.tomgang = formData.get("tomgang") === "on";
  l.huslejenaevnssag = formData.get("huslejenaevnssag") === "on";
  db.gemLejeforhold(id, deal.lejeforhold);
  revalidatePath(`/deals/${id}`);
}

/* ---------- Økonomi ---------- */

export async function gemDriftsAarAction(formData: FormData) {
  const id = Number(formData.get("dealId"));
  const deal = db.hentDeal(id);
  if (!deal) return;
  const aar = Number(formData.get("aar"));
  if (!aar) return;
  const nyt = {
    aar,
    bruttolejeindtaegt: num(formData, "bruttolejeindtaegt"),
    ejendomsskat: num(formData, "ejendomsskat"),
    forsikring: num(formData, "forsikring"),
    vedligehold: num(formData, "vedligehold"),
    administration: num(formData, "administration"),
    renovation: num(formData, "renovation"),
    oevrigeUdgifter: num(formData, "oevrigeUdgifter"),
  };
  deal.oekonomi.driftsaar = [
    ...deal.oekonomi.driftsaar.filter((d) => d.aar !== aar),
    nyt,
  ].sort((a, b) => b.aar - a.aar);
  db.gemOekonomi(id, deal.oekonomi);
  revalidatePath(`/deals/${id}`);
}

export async function sletDriftsAarAction(formData: FormData) {
  const id = Number(formData.get("dealId"));
  const aar = Number(formData.get("aar"));
  const deal = db.hentDeal(id);
  if (!deal) return;
  deal.oekonomi.driftsaar = deal.oekonomi.driftsaar.filter((d) => d.aar !== aar);
  db.gemOekonomi(id, deal.oekonomi);
  revalidatePath(`/deals/${id}`);
}

export async function gemOekonomiNoterAction(formData: FormData) {
  const id = Number(formData.get("dealId"));
  const deal = db.hentDeal(id);
  if (!deal) return;
  deal.oekonomi.planlagteForbedringer = txt(formData, "planlagteForbedringer");
  deal.oekonomi.pblVarsling = txt(formData, "pblVarsling");
  db.gemOekonomi(id, deal.oekonomi);
  revalidatePath(`/deals/${id}`);
}

/* ---------- Stand ---------- */

export async function gemStandAction(formData: FormData) {
  const id = Number(formData.get("dealId"));
  const deal = db.hentDeal(id);
  if (!deal) return;
  const karakter = (navn: string) => {
    const v = Number(formData.get(navn));
    return v >= 1 && v <= 5 ? (v as 1 | 2 | 3 | 4 | 5) : null;
  };
  db.gemStand(id, {
    tag: karakter("tag"),
    facade: karakter("facade"),
    vvs: karakter("vvs"),
    el: karakter("el"),
    vinduer: karakter("vinduer"),
    renoveringsbudget: num(formData, "renoveringsbudget"),
    note: txt(formData, "note"),
  });
  revalidatePath(`/deals/${id}`);
}

/* ---------- Pris og finansiering ---------- */

export async function gemPrisAction(formData: FormData) {
  const id = Number(formData.get("dealId"));
  const deal = db.hentDeal(id);
  if (!deal) return;
  db.gemPris(id, {
    udbudspris: num(formData, "udbudspris"),
    forventetKoebspris: num(formData, "forventetKoebspris"),
    eksisterendeBelaaning: num(formData, "eksisterendeBelaaning"),
    belaaningKanOvertages: formData.get("belaaningKanOvertages") === "on",
    belaaningRentePct: num(formData, "belaaningRentePct"),
    saelgersMotivation: txt(formData, "saelgersMotivation"),
    tidshorisont: txt(formData, "tidshorisont"),
  });
  revalidatePath(`/deals/${id}`);
}

/* ---------- Juridisk ---------- */

export async function gemJuridiskAction(formData: FormData) {
  const id = Number(formData.get("dealId"));
  const deal = db.hentDeal(id);
  if (!deal) return;
  db.gemJuridisk(id, {
    tingbogsattestIndhentet: formData.get("tingbogsattestIndhentet") === "on",
    haeftelser: txt(formData, "haeftelser"),
    servitutter: txt(formData, "servitutter"),
    verserendeSager: txt(formData, "verserendeSager"),
    note: txt(formData, "note"),
  });
  revalidatePath(`/deals/${id}`);
}

/* ---------- Noter ---------- */

export async function gemNoterAction(formData: FormData) {
  const id = Number(formData.get("dealId"));
  db.gemNoter(id, txt(formData, "noter"));
  revalidatePath(`/deals/${id}`);
}

/* ---------- Dokumenter ---------- */

export async function uploadDokumentAction(formData: FormData) {
  const id = Number(formData.get("dealId"));
  const kategori = txt(formData, "kategori") || "Andet";
  const fil = formData.get("fil");
  if (!(fil instanceof File) || fil.size === 0) return;

  const sikkertNavn = fil.name.replace(/[^\w.æøåÆØÅ() -]/g, "_");
  const filnavn = `${Date.now()}-${sikkertNavn}`;
  const dealDir = path.join(db.UPLOAD_DIR, String(id));
  fs.mkdirSync(dealDir, { recursive: true });
  const sti = path.join(dealDir, filnavn);
  fs.writeFileSync(sti, Buffer.from(await fil.arrayBuffer()));

  db.tilfoejDokument(id, kategori, sikkertNavn, sti);
  revalidatePath(`/deals/${id}`);
}

export async function sletDokumentAction(formData: FormData) {
  const dealId = Number(formData.get("dealId"));
  const dokId = Number(formData.get("dokumentId"));
  db.sletDokument(dokId);
  revalidatePath(`/deals/${dealId}`);
}
