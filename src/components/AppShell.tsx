"use client";

import dynamic from "next/dynamic";
import { Spinner } from "./icons";

// L'application dépend d'API navigateur (canvas, workers, localStorage) : rendu client uniquement.
const WatermarkApp = dynamic(() => import("./WatermarkApp"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center gap-3 p-10 text-slate-500">
      <Spinner /> Chargement de l’application…
    </div>
  ),
});

export default function AppShell() {
  return <WatermarkApp />;
}
