export type StrengthLevel = 0 | 1 | 2 | 3 | 4;

export interface PasswordStrength {
  level: StrengthLevel;
  label: string;
  hint: string;
}

const LABELS = ["Très faible", "Faible", "Moyen", "Fort", "Très fort"] as const;

const COMMON = [
  "password", "motdepasse", "azerty", "qwerty", "123456", "soleil", "bonjour", "loulou",
  "doudou", "chouchou", "marseille", "paris", "admin", "secret", "iloveyou", "jetaime",
  "dossier", "location", "appartement", "bailleur", "welcome", "letmein", "football",
];

const SEQUENCES = ["abcdefghijklmnopqrstuvwxyz", "0123456789", "azertyuiop", "qwertyuiop", "qsdfghjklm", "asdfghjkl"];

function hasSequence(lower: string): boolean {
  for (const seq of SEQUENCES) {
    for (let i = 0; i + 4 <= seq.length; i++) {
      const chunk = seq.slice(i, i + 4);
      if (lower.includes(chunk) || lower.includes([...chunk].reverse().join(""))) return true;
    }
  }
  return false;
}

export function evaluatePassword(password: string): PasswordStrength {
  if (!password) return { level: 0, label: "Aucun", hint: "Saisissez ou générez un mot de passe." };

  const chars = [...password];
  let pool = 0;
  if (/[a-z]/.test(password)) pool += 26;
  if (/[A-Z]/.test(password)) pool += 26;
  if (/[0-9]/.test(password)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(password)) pool += 33;
  let entropy = chars.length * Math.log2(Math.max(pool, 1));

  const lower = password.toLowerCase();
  const letters = lower.replace(/[^a-zà-ÿ]/g, "");
  const common = COMMON.some((word) => lower.includes(word) && word.length >= letters.length - 2);
  if (common) entropy = Math.min(entropy, 15);
  if (/(.)\1{2,}/.test(password)) entropy -= 10;
  if (hasSequence(lower)) entropy -= 10;
  if (/(19|20)\d{2}/.test(password) && chars.length <= 10) entropy -= 8;
  if (new Set(chars).size <= 3) entropy = Math.min(entropy, 10);

  const level: StrengthLevel = entropy < 28 ? 0 : entropy < 40 ? 1 : entropy < 60 ? 2 : entropy < 80 ? 3 : 4;

  let hint = "Bon mot de passe.";
  if (common) hint = "Évitez les mots de passe courants ou les mots évidents.";
  else if (chars.length < 12) hint = "Utilisez au moins 12 caractères.";
  else if (pool < 60) hint = "Mélangez minuscules, majuscules, chiffres et symboles.";
  else if (level < 3) hint = "Évitez les suites et répétitions (1234, aaaa, azerty).";

  return { level, label: LABELS[level], hint };
}

const GENERATOR_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Mot de passe aléatoire lisible (sans caractères ambigus), ex. « k7Rm-2pXq-9vTz-Lh4w ». */
export function generatePassword(groups = 4, groupSize = 4): string {
  const total = groups * groupSize;
  const values = new Uint32Array(total);
  crypto.getRandomValues(values);
  const chars = [...values].map((v) => GENERATOR_ALPHABET[v % GENERATOR_ALPHABET.length]);
  const parts: string[] = [];
  for (let i = 0; i < total; i += groupSize) parts.push(chars.slice(i, i + groupSize).join(""));
  return parts.join("-");
}
