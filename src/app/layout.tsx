import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Filigrane — protégez vos pièces de dossier",
  description:
    "Ajoutez un filigrane à vos documents sensibles (avis d'imposition, fiches de paie, pièce d'identité…) directement dans votre navigateur. Aucun fichier n'est envoyé.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const viewport: Viewport = { themeColor: "#064e3b" };

const isDev = process.env.NODE_ENV !== "production";

/**
 * Politique de sécurité : le navigateur refuse toute connexion vers un autre domaine.
 * Même en cas de bug ou de dépendance compromise, aucun document ne peut être exfiltré.
 * (En développement, Next.js a besoin d'eval et du websocket de rechargement à chaud.)
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ");

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <head>
        <meta httpEquiv="Content-Security-Policy" content={csp} />
      </head>
      <body className="flex min-h-full flex-col bg-slate-100 text-slate-900">{children}</body>
    </html>
  );
}
