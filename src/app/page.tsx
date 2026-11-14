import AppShell from "@/components/AppShell";
import { ShieldIcon } from "@/components/icons";
import PrivacyBanner from "@/components/PrivacyBanner";

export default function Home() {
  return (
    <>
      <PrivacyBanner />
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
          <ShieldIcon className="text-teal-700" width={26} height={26} />
          <h1 className="text-lg font-semibold tracking-tight">Filigrane</h1>
          <p className="text-sm text-slate-500">
            Protégez vos pièces justificatives avant de les envoyer à un bailleur.
          </p>
        </div>
      </header>
      <AppShell />
      <footer className="px-4 pb-4 text-center text-xs text-slate-500">
        Aucun cookie, aucune mesure d’audience. Les documents restent en mémoire le temps de la session et
        disparaissent à la fermeture de l’onglet.
      </footer>
    </>
  );
}
