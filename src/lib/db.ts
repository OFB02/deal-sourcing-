/**
 * SQLite-datalag (better-sqlite3). Databasen ligger i ./data/deals.db og
 * oprettes automatisk. De strukturerede sektioner gemmes som JSON-kolonner,
 * så modellen kan udvikles uden migreringer i udkast-fasen.
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { AdresseMatch, AutoIndhentning } from "@/integrations/types";
import {
  Deal,
  DealStatus,
  Dokument,
  Juridisk,
  Lejeforhold,
  Oekonomi,
  PrisFinansiering,
  Stand,
  tomJuridisk,
  tomLejeforhold,
  tomOekonomi,
  tomPris,
  tomStand,
} from "./model";

const DATA_DIR = path.join(process.cwd(), "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

let _db: Database.Database | null = null;

function db(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  _db = new Database(path.join(DATA_DIR, "deals.db"));
  _db.pragma("journal_mode = WAL");
  _db.exec(`
    CREATE TABLE IF NOT EXISTS deals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL DEFAULT 'screening',
      oprettet TEXT NOT NULL,
      opdateret TEXT NOT NULL,
      adresse_json TEXT NOT NULL,
      auto_json TEXT,
      lejeforhold_json TEXT NOT NULL,
      oekonomi_json TEXT NOT NULL,
      stand_json TEXT NOT NULL,
      pris_json TEXT NOT NULL,
      juridisk_json TEXT NOT NULL,
      noter TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS dokumenter (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
      kategori TEXT NOT NULL,
      filnavn TEXT NOT NULL,
      sti TEXT NOT NULL,
      uploadet TEXT NOT NULL
    );
  `);
  return _db;
}

function rowTilDeal(row: any): Deal {
  return {
    id: row.id,
    status: row.status as DealStatus,
    oprettet: row.oprettet,
    opdateret: row.opdateret,
    adresse: JSON.parse(row.adresse_json),
    auto: row.auto_json ? JSON.parse(row.auto_json) : null,
    lejeforhold: JSON.parse(row.lejeforhold_json),
    oekonomi: JSON.parse(row.oekonomi_json),
    stand: JSON.parse(row.stand_json),
    pris: JSON.parse(row.pris_json),
    juridisk: JSON.parse(row.juridisk_json),
    noter: row.noter,
  };
}

export function opretDeal(adresse: AdresseMatch): number {
  const nu = new Date().toISOString();
  const res = db()
    .prepare(
      `INSERT INTO deals (status, oprettet, opdateret, adresse_json, lejeforhold_json,
         oekonomi_json, stand_json, pris_json, juridisk_json)
       VALUES ('screening', ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      nu,
      nu,
      JSON.stringify(adresse),
      JSON.stringify(tomLejeforhold()),
      JSON.stringify(tomOekonomi()),
      JSON.stringify(tomStand()),
      JSON.stringify(tomPris()),
      JSON.stringify(tomJuridisk())
    );
  return Number(res.lastInsertRowid);
}

export function hentDeal(id: number): Deal | null {
  const row = db().prepare("SELECT * FROM deals WHERE id = ?").get(id);
  return row ? rowTilDeal(row) : null;
}

export function hentAlleDeals(): Deal[] {
  return db()
    .prepare("SELECT * FROM deals ORDER BY opdateret DESC")
    .all()
    .map(rowTilDeal);
}

function opdaterFelt(id: number, felt: string, vaerdi: string) {
  db()
    .prepare(`UPDATE deals SET ${felt} = ?, opdateret = ? WHERE id = ?`)
    .run(vaerdi, new Date().toISOString(), id);
}

export function gemAuto(id: number, auto: AutoIndhentning) {
  opdaterFelt(id, "auto_json", JSON.stringify(auto));
}
export function gemLejeforhold(id: number, v: Lejeforhold) {
  opdaterFelt(id, "lejeforhold_json", JSON.stringify(v));
}
export function gemOekonomi(id: number, v: Oekonomi) {
  opdaterFelt(id, "oekonomi_json", JSON.stringify(v));
}
export function gemStand(id: number, v: Stand) {
  opdaterFelt(id, "stand_json", JSON.stringify(v));
}
export function gemPris(id: number, v: PrisFinansiering) {
  opdaterFelt(id, "pris_json", JSON.stringify(v));
}
export function gemJuridisk(id: number, v: Juridisk) {
  opdaterFelt(id, "juridisk_json", JSON.stringify(v));
}
export function gemNoter(id: number, noter: string) {
  opdaterFelt(id, "noter", noter);
}
export function saetStatus(id: number, status: DealStatus) {
  opdaterFelt(id, "status", status);
}

export function sletDeal(id: number) {
  db().prepare("DELETE FROM dokumenter WHERE deal_id = ?").run(id);
  db().prepare("DELETE FROM deals WHERE id = ?").run(id);
}

/* ---------- Dokumenter ---------- */

export function tilfoejDokument(dealId: number, kategori: string, filnavn: string, sti: string): number {
  const res = db()
    .prepare("INSERT INTO dokumenter (deal_id, kategori, filnavn, sti, uploadet) VALUES (?, ?, ?, ?, ?)")
    .run(dealId, kategori, filnavn, sti, new Date().toISOString());
  return Number(res.lastInsertRowid);
}

export function hentDokumenter(dealId: number): Dokument[] {
  return db()
    .prepare("SELECT id, deal_id as dealId, kategori, filnavn, sti, uploadet FROM dokumenter WHERE deal_id = ? ORDER BY uploadet DESC")
    .all(dealId) as Dokument[];
}

export function sletDokument(id: number) {
  db().prepare("DELETE FROM dokumenter WHERE id = ?").run(id);
}
