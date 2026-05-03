import {
  StatoLavoratore,
  Timbratura,
} from "@/types/timbrature";

type Props = {
  stato: StatoLavoratore;
  ultimaTimbratura: Timbratura | null;
};

export function StatoBadge({
  stato,
  ultimaTimbratura,
}: Props) {
  return (
    <div className="mb-6 rounded-lg bg-gray-100 p-4">
      <div className="text-sm text-gray-500">
        Stato attuale
      </div>

      <div className="text-2xl font-bold">
        {stato}
      </div>

      <div className="mt-2 text-sm text-gray-500">
        Ultima timbratura:
        {" "}
        {ultimaTimbratura?.tipo ||
          "NESSUNA"}
      </div>
    </div>
  );
}