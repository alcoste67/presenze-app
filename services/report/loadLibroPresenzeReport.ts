import { ATTIVITA } from "@/constants/attivita";
import {
  REPORT_LIBRO_PRESENZE_LIMITI,
  REPORT_LIBRO_PRESENZE_TESTI,
  REPORT_LIBRO_PRESENZE_TIME_ZONE,
} from "@/constants/reportLibroPresenze";
import {
  LABEL_ATTIVITA_REPORT,
} from "@/constants/reportPresenze";
import { TIMBRATURE } from "@/constants/stati";
import { TIPO_CONTEGGIO_ORE } from "@/constants/tipoConteggioOre";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calcolaOreLavorate } from "@/services/timbrature/calcolaOreLavorate";
import type { TipoAttivita } from "@/types/attivita";
import type { TipoConteggioOre } from "@/types/dipendenti";
import type {
  LibroPresenzeReportFiltri,
  LibroPresenzeReportRiga,
  LibroPresenzeReportRisposta,
} from "@/types/reportLibroPresenze";
import type { TipoTimbratura } from "@/types/timbrature";

const SELECT_TIMBRATURA_REPORT =
  "id, user_id, cantiere_id, attivita_tipo, tipo, created_at";

const SELECT_DIPENDENTE_REPORT =
  "id, nome, cognome, email, auth_user_id, tipo_conteggio_ore";

const SELECT_CANTIERE_REPORT = "id, nome";

const DATA_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})$/;

const TIPI_TIMBRATURA = Object.values(
  TIMBRATURE
) as readonly TipoTimbratura[];

const TIPI_ATTIVITA = Object.values(
  ATTIVITA
) as readonly TipoAttivita[];

const TIPI_CONTEGGIO_ORE = Object.values(
  TIPO_CONTEGGIO_ORE
) as readonly TipoConteggioOre[];

const formattaGiornoReport =
  new Intl.DateTimeFormat("it-IT", {
    timeZone: REPORT_LIBRO_PRESENZE_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const formattaOraReport =
  new Intl.DateTimeFormat("it-IT", {
    timeZone: REPORT_LIBRO_PRESENZE_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });

const formattaGiornoIsoParts =
  new Intl.DateTimeFormat("en-US", {
    timeZone: REPORT_LIBRO_PRESENZE_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

type TimbraturaReportRow = {
  id: string;
  user_id: string;
  cantiere_id: string | null;
  attivita_tipo: string | null;
  tipo: string;
  created_at: string;
};

type TimbraturaAggregata = {
  id: string;
  user_id: string;
  cantiere_id: string | null;
  attivita_tipo: TipoAttivita | null;
  tipo: TipoTimbratura;
  created_at: string;
};

type DipendenteReportRow = {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  auth_user_id: string | null;
  tipo_conteggio_ore: string;
};

type DipendenteReport = Omit<
  DipendenteReportRow,
  "tipo_conteggio_ore"
> & {
  tipo_conteggio_ore: TipoConteggioOre;
};

type CantiereReportRow = {
  id: string;
  nome: string;
};

type DataParts = {
  year: number;
  month: number;
  day: number;
};

type GruppoGiornaliero = {
  id: string;
  giornoIso: string;
  giorno: string;
  userId: string;
  timbrature: TimbraturaAggregata[];
};

function parseDataInput(data: string): DataParts {
  const match = DATA_PATTERN.exec(data);

  if (!match) {
    throw new Error(
      REPORT_LIBRO_PRESENZE_TESTI.ERRORI
        .FILTRI_NON_VALIDI
    );
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function formattaDataInput(
  data: Date
): string {
  const year = data.getUTCFullYear();
  const month = String(
    data.getUTCMonth() + 1
  ).padStart(2, "0");
  const day = String(
    data.getUTCDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDataSuccessiva(data: string) {
  const parts = parseDataInput(data);
  const dataUtc = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day
    )
  );

  dataUtc.setUTCDate(
    dataUtc.getUTCDate() + 1
  );

  return formattaDataInput(dataUtc);
}

function getDateTimePart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes
): number {
  const value = parts.find(
    (part) => part.type === type
  )?.value;

  if (!value) {
    throw new Error(
      REPORT_LIBRO_PRESENZE_TESTI.ERRORI
        .FILTRI_NON_VALIDI
    );
  }

  return Number(value);
}

function getTimeZoneOffsetMs(
  data: Date
): number {
  const parts = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone:
        REPORT_LIBRO_PRESENZE_TIME_ZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }
  ).formatToParts(data);

  const localeAsUtc = Date.UTC(
    getDateTimePart(parts, "year"),
    getDateTimePart(parts, "month") - 1,
    getDateTimePart(parts, "day"),
    getDateTimePart(parts, "hour"),
    getDateTimePart(parts, "minute"),
    getDateTimePart(parts, "second")
  );

  return localeAsUtc - data.getTime();
}

function getUtcDaDataLocale(
  data: string
): Date {
  const parts = parseDataInput(data);
  let utcTime = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day
  );
  const offset = getTimeZoneOffsetMs(
    new Date(utcTime)
  );

  utcTime -= offset;

  const offsetCorretto =
    getTimeZoneOffsetMs(new Date(utcTime));

  if (offsetCorretto !== offset) {
    utcTime -= offsetCorretto - offset;
  }

  return new Date(utcTime);
}

function getGiornoIsoLocale(
  data: Date
): string {
  const parts =
    formattaGiornoIsoParts.formatToParts(
      data
    );
  const year = String(
    getDateTimePart(parts, "year")
  );
  const month = String(
    getDateTimePart(parts, "month")
  ).padStart(2, "0");
  const day = String(
    getDateTimePart(parts, "day")
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getValoriUnici(
  valori: Array<string | null>
): string[] {
  return Array.from(
    new Set(
      valori.filter(
        (value): value is string =>
          Boolean(value)
      )
    )
  );
}

function getTipoTimbratura(
  value: string
): TipoTimbratura {
  if (
    TIPI_TIMBRATURA.includes(
      value as TipoTimbratura
    )
  ) {
    return value as TipoTimbratura;
  }

  throw new Error(
    REPORT_LIBRO_PRESENZE_TESTI.ERRORI
      .GENERICO
  );
}

function getAttivitaTipo(
  value: string | null
): TipoAttivita | null {
  if (!value) {
    return null;
  }

  if (
    TIPI_ATTIVITA.includes(
      value as TipoAttivita
    )
  ) {
    return value as TipoAttivita;
  }

  throw new Error(
    REPORT_LIBRO_PRESENZE_TESTI.ERRORI
      .GENERICO
  );
}

function getTipoConteggioOre(
  value: string
): TipoConteggioOre {
  if (
    TIPI_CONTEGGIO_ORE.includes(
      value as TipoConteggioOre
    )
  ) {
    return value as TipoConteggioOre;
  }

  return TIPO_CONTEGGIO_ORE.REALE;
}

function formattaDipendente(
  dipendente: DipendenteReport | undefined
) {
  if (!dipendente) {
    return REPORT_LIBRO_PRESENZE_TESTI
      .DIPENDENTE_NON_DISPONIBILE;
  }

  return `${dipendente.cognome} ${dipendente.nome}`.trim();
}

function formattaMinuti(minutiTotali: number) {
  const ore = Math.floor(minutiTotali / 60);
  const minuti = minutiTotali % 60;

  return `${ore}h ${minuti}m`;
}

function formattaOra(
  timbratura: TimbraturaAggregata | undefined
) {
  if (!timbratura) {
    return "";
  }

  return formattaOraReport.format(
    new Date(timbratura.created_at)
  );
}

function getKeyGruppo({
  giornoIso,
  userId,
}: {
  giornoIso: string;
  userId: string;
}) {
  return `${giornoIso}:${userId}`;
}

function getDestinazioneTimbratura({
  timbratura,
  cantieriById,
}: {
  timbratura: TimbraturaAggregata;
  cantieriById: Map<string, CantiereReportRow>;
}) {
  if (timbratura.cantiere_id) {
    return (
      cantieriById.get(
        timbratura.cantiere_id
      )?.nome ||
      REPORT_LIBRO_PRESENZE_TESTI
        .CANTIERE_NON_DISPONIBILE
    );
  }

  if (timbratura.attivita_tipo) {
    return LABEL_ATTIVITA_REPORT[
      timbratura.attivita_tipo
    ];
  }

  return REPORT_LIBRO_PRESENZE_TESTI
    .DESTINAZIONE_NON_DISPONIBILE;
}

function getDestinazioniUniche({
  timbrature,
  cantieriById,
}: {
  timbrature: TimbraturaAggregata[];
  cantieriById: Map<string, CantiereReportRow>;
}) {
  return Array.from(
    new Set(
      timbrature
        .map((timbratura) =>
          getDestinazioneTimbratura({
            timbratura,
            cantieriById,
          })
        )
        .filter(Boolean)
    )
  );
}

function getNote({
  giornataAperta,
  sequenzaIncompleta,
}: {
  giornataAperta: boolean;
  sequenzaIncompleta: boolean;
}) {
  const note: string[] = [];

  if (giornataAperta) {
    note.push(
      REPORT_LIBRO_PRESENZE_TESTI
        .NOTE_GIORNATA_APERTA
    );
  }

  if (sequenzaIncompleta) {
    note.push(
      REPORT_LIBRO_PRESENZE_TESTI
        .NOTE_SEQUENZA_INCOMPLETA
    );
  }

  return Array.from(new Set(note)).join(", ");
}

function creaGruppiGiornalieri(
  timbrature: TimbraturaReportRow[]
) {
  const gruppi = new Map<
    string,
    GruppoGiornaliero
  >();

  for (const timbratura of timbrature) {
    const dataTimbratura = new Date(
      timbratura.created_at
    );
    const giornoIso =
      getGiornoIsoLocale(dataTimbratura);
    const key = getKeyGruppo({
      giornoIso,
      userId: timbratura.user_id,
    });
    const gruppo =
      gruppi.get(key) || {
        id: key,
        giornoIso,
        giorno:
          formattaGiornoReport.format(
            dataTimbratura
          ),
        userId: timbratura.user_id,
        timbrature: [],
      };

    gruppo.timbrature.push({
      id: timbratura.id,
      user_id: timbratura.user_id,
      cantiere_id: timbratura.cantiere_id,
      attivita_tipo: getAttivitaTipo(
        timbratura.attivita_tipo
      ),
      tipo: getTipoTimbratura(
        timbratura.tipo
      ),
      created_at: timbratura.created_at,
    });

    gruppi.set(key, gruppo);
  }

  return Array.from(gruppi.values());
}

function includeCantiere(
  gruppo: GruppoGiornaliero,
  cantiereId: string | null
) {
  if (!cantiereId) {
    return true;
  }

  return gruppo.timbrature.some(
    (timbratura) =>
      timbratura.cantiere_id === cantiereId
  );
}

function creaRigaReport({
  gruppo,
  dipendentiByAuthUserId,
  cantieriById,
}: {
  gruppo: GruppoGiornaliero;
  dipendentiByAuthUserId: Map<
    string,
    DipendenteReport
  >;
  cantieriById: Map<string, CantiereReportRow>;
}): LibroPresenzeReportRiga {
  const dipendente =
    dipendentiByAuthUserId.get(
      gruppo.userId
    );
  const entrata = gruppo.timbrature.find(
    (timbratura) =>
      timbratura.tipo === TIMBRATURE.ENTRATA
  );
  const uscita = [
    ...gruppo.timbrature,
  ]
    .reverse()
    .find(
      (timbratura) =>
        timbratura.tipo === TIMBRATURE.USCITA
    );
  const oreReali = calcolaOreLavorate(
    gruppo.timbrature
  );
  const presenzaValida =
    oreReali.totaleMinuti > 0;
  const minutiPaghe =
    dipendente?.tipo_conteggio_ore ===
      TIPO_CONTEGGIO_ORE
        .GIORNATA_FORFAIT_8H &&
    presenzaValida
      ? 8 * 60
      : oreReali.totaleMinuti;
  const destinazioni =
    getDestinazioniUniche({
      timbrature: gruppo.timbrature,
      cantieriById,
    });

  return {
    id: gruppo.id,
    giorno: gruppo.giorno,
    giornoIso: gruppo.giornoIso,
    dipendente:
      formattaDipendente(dipendente),
    email:
      dipendente?.email ||
      REPORT_LIBRO_PRESENZE_TESTI
        .EMAIL_NON_DISPONIBILE,
    entrata: formattaOra(entrata),
    uscita: formattaOra(uscita),
    totaleMinutiReali:
      oreReali.totaleMinuti,
    totaleOreReali: formattaMinuti(
      oreReali.totaleMinuti
    ),
    minutiPaghe,
    orePaghe: formattaMinuti(minutiPaghe),
    cantiereAttivita:
      destinazioni.join(", "),
    note: getNote({
      giornataAperta:
        oreReali.giornataAperta,
      sequenzaIncompleta:
        oreReali.sequenzaIncompleta,
    }),
  };
}

async function loadDipendente(
  dipendenteId: string
): Promise<DipendenteReport | null> {
  const { data, error } = await supabaseAdmin
    .from("dipendenti")
    .select(SELECT_DIPENDENTE_REPORT)
    .eq("id", dipendenteId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const dipendente =
    data as DipendenteReportRow | null;

  if (!dipendente) {
    return null;
  }

  return {
    ...dipendente,
    tipo_conteggio_ore:
      getTipoConteggioOre(
        dipendente.tipo_conteggio_ore
      ),
  };
}

async function loadDipendentiByAuthUserIds(
  authUserIds: string[]
): Promise<Map<string, DipendenteReport>> {
  if (authUserIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabaseAdmin
    .from("dipendenti")
    .select(SELECT_DIPENDENTE_REPORT)
    .in("auth_user_id", authUserIds);

  if (error) {
    throw error;
  }

  const dipendenti =
    (data || []) as DipendenteReportRow[];

  return new Map(
    dipendenti
      .filter(
        (dipendente) =>
          dipendente.auth_user_id !== null
      )
      .map((dipendente) => [
        dipendente.auth_user_id as string,
        {
          ...dipendente,
          tipo_conteggio_ore:
            getTipoConteggioOre(
              dipendente.tipo_conteggio_ore
            ),
        },
      ])
  );
}

async function loadCantieriByIds(
  cantiereIds: string[]
): Promise<Map<string, CantiereReportRow>> {
  if (cantiereIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabaseAdmin
    .from("cantieri")
    .select(SELECT_CANTIERE_REPORT)
    .in("id", cantiereIds);

  if (error) {
    throw error;
  }

  const cantieri =
    (data || []) as CantiereReportRow[];

  return new Map(
    cantieri.map((cantiere) => [
      cantiere.id,
      cantiere,
    ])
  );
}

export async function loadLibroPresenzeReport(
  filtri: LibroPresenzeReportFiltri
): Promise<LibroPresenzeReportRisposta> {
  const dipendenteSelezionato =
    filtri.dipendenteId
      ? await loadDipendente(
          filtri.dipendenteId
        )
      : null;

  if (
    filtri.dipendenteId &&
    !dipendenteSelezionato?.auth_user_id
  ) {
    return {
      righe: [],
      limiteRighe:
        REPORT_LIBRO_PRESENZE_LIMITI.MAX_RIGHE,
      limiteRaggiunto: false,
    };
  }

  const dataInizioUtc =
    getUtcDaDataLocale(
      filtri.dataInizio
    ).toISOString();
  const dataFineEsclusivaUtc =
    getUtcDaDataLocale(
      getDataSuccessiva(filtri.dataFine)
    ).toISOString();

  const baseQuery = supabaseAdmin
    .from("timbrature")
    .select(SELECT_TIMBRATURA_REPORT)
    .gte("created_at", dataInizioUtc)
    .lt("created_at", dataFineEsclusivaUtc);

  const queryDipendente =
    dipendenteSelezionato?.auth_user_id
      ? baseQuery.eq(
          "user_id",
          dipendenteSelezionato.auth_user_id
        )
      : baseQuery;

  const { data, error } =
    await queryDipendente
      .order("created_at", {
        ascending: true,
      })
      .limit(
        REPORT_LIBRO_PRESENZE_LIMITI
          .MAX_TIMBRATURE + 1
      );

  if (error) {
    throw error;
  }

  const timbrature =
    (data || []) as TimbraturaReportRow[];
  const limiteTimbratureRaggiunto =
    timbrature.length >
    REPORT_LIBRO_PRESENZE_LIMITI
      .MAX_TIMBRATURE;
  const timbratureLimitate =
    timbrature.slice(
      0,
      REPORT_LIBRO_PRESENZE_LIMITI
        .MAX_TIMBRATURE
    );
  const gruppi = creaGruppiGiornalieri(
    timbratureLimitate
  ).filter((gruppo) =>
    includeCantiere(
      gruppo,
      filtri.cantiereId
    )
  );

  const authUserIds = getValoriUnici(
    gruppi.map((gruppo) => gruppo.userId)
  );
  const cantiereIds = getValoriUnici(
    gruppi.flatMap((gruppo) =>
      gruppo.timbrature.map(
        (timbratura) =>
          timbratura.cantiere_id
      )
    )
  );

  const [
    dipendentiByAuthUserId,
    cantieriById,
  ] = await Promise.all([
    loadDipendentiByAuthUserIds(
      authUserIds
    ),
    loadCantieriByIds(cantiereIds),
  ]);

  const righe = gruppi
    .map((gruppo) =>
      creaRigaReport({
        gruppo,
        dipendentiByAuthUserId,
        cantieriById,
      })
    )
    .sort((a, b) => {
      if (a.giornoIso !== b.giornoIso) {
        return a.giornoIso.localeCompare(
          b.giornoIso
        );
      }

      return a.dipendente.localeCompare(
        b.dipendente
      );
    });

  const limiteRigheRaggiunto =
    righe.length >
    REPORT_LIBRO_PRESENZE_LIMITI.MAX_RIGHE;

  return {
    righe: righe.slice(
      0,
      REPORT_LIBRO_PRESENZE_LIMITI.MAX_RIGHE
    ),
    limiteRighe:
      REPORT_LIBRO_PRESENZE_LIMITI.MAX_RIGHE,
    limiteRaggiunto:
      limiteTimbratureRaggiunto ||
      limiteRigheRaggiunto,
  };
}
