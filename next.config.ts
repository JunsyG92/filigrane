import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Export 100 % statique : aucun code serveur, l'application peut être servie par
  // n'importe quel hébergement de fichiers.
  output: "export",
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
