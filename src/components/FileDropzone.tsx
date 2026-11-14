"use client";

import { useRef, useState, type DragEvent } from "react";
import { ACCEPTED_INPUT } from "@/lib/file-import";
import { MAX_FILE_SIZE } from "@/lib/errors";
import { UploadIcon } from "./icons";

interface FileDropzoneProps {
  onFiles: (files: File[]) => void;
}

export default function FileDropzone({ onFiles }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) onFiles(files);
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
        dragging ? "border-teal-600 bg-teal-50" : "border-slate-300 bg-white hover:border-slate-400"
      }`}
    >
      <UploadIcon className="mx-auto mb-2 text-slate-500" width={28} height={28} />
      <p className="text-sm font-medium text-slate-800">Glissez vos documents ici</p>
      <p className="mt-1 text-xs text-slate-500">
        PDF, JPG ou PNG · {MAX_FILE_SIZE / 1024 / 1024} Mo max. par fichier
      </p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-teal-600"
      >
        Choisir des fichiers
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_INPUT}
        className="sr-only"
        data-testid="file-input"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length > 0) onFiles(files);
        }}
      />
    </div>
  );
}
