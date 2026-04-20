/**
 * Datos fiscales de la empresa emisora de los presupuestos.
 *
 * ⚠️ PROVISIONAL — Edita este archivo cuando tengas los datos definitivos.
 */

export const EMPRESA = {
  razonSocial: "Mobiliario Turiaval S.L.",
  nombreComercial: "Lacados Turia",
  cif: "B-98807597",

  direccion: "CC/ Canal Xúquer-Turia, 11",
  codigoPostal: "46930",
  ciudad: "Quart de Poblet",
  provincia: "Valencia",
  pais: "España",

  telefono: "+34 627 487 050",
  email: "info@turiaval.es",
  web: "www.turiaval.es",

  regimenFiscal: "Régimen general",

  condiciones: [
    "Los precios indicados no incluyen IVA.",
    "Validez de la oferta: según fecha indicada en el presupuesto.",
    "Forma de pago: 50% a la aceptación, 50% a la entrega.",
    "Plazo de entrega a confirmar una vez aceptado el presupuesto.",
    "Los trabajos no incluidos expresamente en el presupuesto se facturarán aparte.",
  ],

  iban: "",

  logoUrl: "",
} as const
