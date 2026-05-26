"use client";

import {
  type ChangeEvent,
  useId,
} from "react";

type Props = {
  label: string;
  buttonLabel: string;
  emptyLabel: string;
  selectedFileNames: string[];
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

function getRiepilogoFile(
  selectedFileNames: string[],
  emptyLabel: string
) {
  if (selectedFileNames.length === 0) {
    return emptyLabel;
  }

  if (selectedFileNames.length === 1) {
    return selectedFileNames[0];
  }

  const [primoFile, ...altriFile] = selectedFileNames;

  return `${primoFile} +${altriFile.length}`;
}

export function FileInputPicker({
  label,
  buttonLabel,
  emptyLabel,
  selectedFileNames,
  accept,
  multiple = false,
  disabled = false,
  onChange,
}: Props) {
  const inputId = useId();
  const riepilogoFile = getRiepilogoFile(
    selectedFileNames,
    emptyLabel
  );

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-industrial-muted">
        {label}
      </span>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <label
          htmlFor={inputId}
          className={`inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-industrial-border bg-industrial-control px-4 py-3 text-sm font-semibold text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white ${disabled ? "pointer-events-none cursor-not-allowed border-industrial-border-soft bg-industrial-surface-strong text-industrial-muted-strong opacity-70 hover:border-industrial-border-soft hover:text-industrial-muted-strong" : ""}`}
        >
          {buttonLabel}
        </label>

        <div className="min-w-0 flex-1 rounded-xl border border-industrial-border-soft bg-industrial-surface-strong px-4 py-3 text-sm text-industrial-muted">
          <p className="break-words leading-5">
            {riepilogoFile}
          </p>
        </div>
      </div>

      <input
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={onChange}
        className="sr-only"
      />
    </div>
  );
}
