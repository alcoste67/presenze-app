import { RAPPORTI_INTERVENTO_TESTI } from "@/constants/rapportiIntervento";

const ORE_MINUTI_PATTERN =
  /^(\d+):([0-5]?\d)$/;
const ORE_DECIMALI_PATTERN =
  /^\d+(?:[.,]\d+)?$/;

export function parseOreMinutiInput(
  value: string
): number | null {
  const input = value.trim();

  if (!input) {
    return null;
  }

  const matchOreMinuti =
    ORE_MINUTI_PATTERN.exec(input);

  if (matchOreMinuti) {
    const ore = Number(matchOreMinuti[1]);
    const minuti = Number(matchOreMinuti[2]);

    if (!Number.isInteger(ore)) {
      return null;
    }

    return ore * 60 + minuti;
  }

  if (!ORE_DECIMALI_PATTERN.test(input)) {
    return null;
  }

  const oreDecimali = Number(
    input.replace(",", ".")
  );

  if (
    !Number.isFinite(oreDecimali) ||
    oreDecimali < 0
  ) {
    return null;
  }

  return Math.round(oreDecimali * 60);
}

export function formatMinutiOre(
  minutiTotali: number
) {
  const minutiValidi = Math.max(
    0,
    Math.floor(minutiTotali)
  );
  const ore = Math.floor(minutiValidi / 60);
  const minuti = minutiValidi % 60;

  return `${ore}${RAPPORTI_INTERVENTO_TESTI.UNITA_ORA} ${minuti}${RAPPORTI_INTERVENTO_TESTI.UNITA_MINUTO}`;
}

export function formatMinutiOreInput(
  minutiTotali: number
) {
  const minutiValidi = Math.max(
    0,
    Math.floor(minutiTotali)
  );
  const ore = Math.floor(minutiValidi / 60);
  const minuti = minutiValidi % 60;

  if (minuti === 0) {
    return String(ore);
  }

  return `${ore}:${String(minuti).padStart(2, "0")}`;
}

export function isFormatoOreValido(
  value: string
) {
  return parseOreMinutiInput(value) !== null;
}
