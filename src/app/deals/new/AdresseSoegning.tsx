"use client";

/**
 * Adressesøgning med autocomplete mod /api/adresse (DAWA-klienten).
 * Valgt adresse sendes til opretDealAction, som opretter dealen og
 * kører den automatiske indhentning.
 */
import { useEffect, useRef, useState } from "react";
import type { AdresseMatch } from "@/integrations/types";
import { opretDealAction } from "@/lib/actions";

export default function AdresseSoegning() {
  const [query, setQuery] = useState("");
  const [resultater, setResultater] = useState<AdresseMatch[]>([]);
  const [soeger, setSoeger] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);
  const [opretterId, setOpretterId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.trim().length < 2) {
      setResultater([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setSoeger(true);
      setFejl(null);
      try {
        const res = await fetch(`/api/adresse?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.fejl ?? `HTTP ${res.status}`);
        setResultater(data);
      } catch (e) {
        setFejl(e instanceof Error ? e.message : "Søgningen fejlede");
        setResultater([]);
      } finally {
        setSoeger(false);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  return (
    <div>
      <label htmlFor="adresse-soeg">Søg efter adresse</label>
      <input
        id="adresse-soeg"
        type="text"
        placeholder="Fx Vesterbrogade 142 eller Søndergade 12, 8000"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
        autoComplete="off"
      />
      {soeger && <p className="small muted">Søger…</p>}
      {fejl && <div className="fejlboks">{fejl}</div>}

      <div className="adresse-resultater">
        {resultater.map((a) => (
          <form
            key={a.id}
            action={opretDealAction}
            className="adresse-resultat"
            onSubmit={() => setOpretterId(a.id)}
          >
            <div>
              <strong>{a.betegnelse}</strong>
              <div className="small muted">
                Matr.nr. {a.matrikelnr}, {a.ejerlav} · BFE {a.bfeNummer}
              </div>
            </div>
            <input type="hidden" name="adresse" value={JSON.stringify(a)} />
            <button type="submit" disabled={opretterId !== null}>
              {opretterId === a.id ? "Henter registerdata…" : "Opret deal"}
            </button>
          </form>
        ))}
        {!soeger && query.trim().length >= 2 && resultater.length === 0 && !fejl && (
          <p className="small muted">Ingen adresser fundet.</p>
        )}
      </div>
    </div>
  );
}
