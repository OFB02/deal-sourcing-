import AdresseSoegning from "./AdresseSoegning";

export default function NyDeal() {
  return (
    <>
      <h1>Ny deal</h1>
      <p className="muted">
        Søg adressen frem. Når dealen oprettes, hentes registerdata automatisk: BBR
        (bygning og enheder), offentlig ejendomsvurdering, ejerforhold/CVR, plangrundlag
        og markedsdata for området.
      </p>
      <div className="card">
        <AdresseSoegning />
      </div>
      <p className="small muted">
        Kører du med mock-datakilder (standard), kan du prøve fx <em>Vesterbrogade</em>,{" "}
        <em>Søndergade</em> eller <em>Danmarksgade</em> - eller skrive en vilkårlig adresse
        som “Hovedgaden 4, 4600”.
      </p>
    </>
  );
}
