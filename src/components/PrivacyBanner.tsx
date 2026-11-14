import { LockIcon } from "./icons";

export default function PrivacyBanner() {
  return (
    <div
      role="note"
      data-testid="privacy-banner"
      className="sticky top-0 z-30 bg-emerald-900 px-4 py-2 text-center text-sm text-emerald-50 shadow-sm"
    >
      <p className="mx-auto flex max-w-5xl items-center justify-center gap-2">
        <LockIcon className="shrink-0" />
        <span>
          <strong className="font-semibold">Traitement 100 % local</strong> — vos documents ne quittent jamais ce
          navigateur : aucun envoi, aucun serveur, aucun stockage distant.
        </span>
      </p>
    </div>
  );
}
