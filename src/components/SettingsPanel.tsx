"use client";

import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { evaluatePassword, generatePassword } from "@/lib/password-strength";
import { BUILTIN_PRESETS, sameStyle } from "@/lib/presets";
import type { CustomPreset } from "@/lib/storage";
import { missingVariables, TEMPLATE_VARIABLES, type TemplateVariable } from "@/lib/template";
import { DPI_OPTIONS, STYLE_LIMITS, type Dpi, type WatermarkStyle, type WatermarkVariables } from "@/lib/types";
import { AlertIcon, CheckIcon, CopyIcon, EyeIcon, EyeOffIcon, SparkIcon } from "./icons";

export interface OutputSettings {
  flatten: boolean;
  dpi: Dpi;
  passwordEnabled: boolean;
  password: string;
}

interface SettingsPanelProps {
  style: WatermarkStyle;
  onStyleChange: (style: WatermarkStyle) => void;
  vars: WatermarkVariables;
  onVarsChange: (vars: WatermarkVariables) => void;
  output: OutputSettings;
  onOutputChange: (output: OutputSettings) => void;
  customPreset: CustomPreset | null;
  onSaveCustom: () => void;
  onDeleteCustom: () => void;
}

const COLOR_SWATCHES = ["#b91c1c", "#1e3a8a", "#374151", "#0f766e", "#000000"];
const DPI_LABELS: Record<Dpi, string> = { 150: "léger", 200: "équilibré", 300: "haute qualité" };
const STRENGTH_COLORS = ["bg-red-600", "bg-orange-500", "bg-amber-400", "bg-lime-500", "bg-emerald-600"];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

interface SliderProps {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  testId?: string;
}

function Slider({ label, value, display, min, max, step, onChange, testId }: SliderProps) {
  const id = useId();
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <label htmlFor={id} className="text-slate-700">
          {label}
        </label>
        <span className="font-mono text-xs text-slate-500 tabular-nums">{display}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        data-testid={testId}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-teal-700"
      />
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
  testId,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: ReactNode;
  testId?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        data-testid={testId}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 ${
          checked ? "bg-teal-700" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : ""
          }`}
        />
      </button>
      <div>
        <label htmlFor={id} className="cursor-pointer text-sm font-medium text-slate-800">
          {label}
        </label>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 focus:outline-none";

export default function SettingsPanel({
  style,
  onStyleChange,
  vars,
  onVarsChange,
  output,
  onOutputChange,
  customPreset,
  onSaveCustom,
  onDeleteCustom,
}: SettingsPanelProps) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const ids = { text: useId(), dest: useId(), objet: useId(), date: useId(), color: useId(), pwd: useId() };

  const missing = useMemo(() => missingVariables(style.text, vars), [style.text, vars]);
  const strength = useMemo(() => evaluatePassword(output.password), [output.password]);
  const update = (patch: Partial<WatermarkStyle>) => onStyleChange({ ...style, ...patch });

  const insertVariable = (variable: TemplateVariable) => {
    const token = `{${variable}}`;
    const el = textRef.current;
    const start = el?.selectionStart ?? style.text.length;
    const end = el?.selectionEnd ?? style.text.length;
    update({ text: style.text.slice(0, start) + token + style.text.slice(end) });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(output.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const customActive = customPreset !== null && sameStyle(customPreset.style, style);

  return (
    <div className="space-y-4">
      <Section title="Modèles">
        <div className="flex flex-wrap gap-2">
          {BUILTIN_PRESETS.map((preset) => {
            const active = sameStyle(preset.style, style);
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={active}
                onClick={() => onStyleChange(preset.style)}
                className={`rounded-lg border px-2.5 py-1.5 text-left text-sm transition-colors ${
                  active
                    ? "border-teal-700 bg-teal-50 text-teal-900"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
          {customPreset && (
            <button
              type="button"
              aria-pressed={customActive}
              onClick={() => {
                onStyleChange(customPreset.style);
                onOutputChange({ ...output, flatten: customPreset.flatten, dpi: customPreset.dpi });
              }}
              className={`rounded-lg border px-2.5 py-1.5 text-sm transition-colors ${
                customActive
                  ? "border-teal-700 bg-teal-50 text-teal-900"
                  : "border-dashed border-slate-400 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              ★ Mon modèle
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <button type="button" onClick={onSaveCustom} className="font-medium text-teal-800 hover:underline">
            {customPreset ? "Remplacer « Mon modèle » par ces réglages" : "Enregistrer ces réglages comme modèle"}
          </button>
          {customPreset && (
            <button type="button" onClick={onDeleteCustom} className="text-slate-500 hover:text-red-700">
              Supprimer
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500">
          Seuls les réglages sont mémorisés dans ce navigateur — jamais vos documents ni les noms saisis.
        </p>
      </Section>

      <Section title="Texte du filigrane">
        <div>
          <label htmlFor={ids.text} className="sr-only">
            Texte du filigrane
          </label>
          <textarea
            id={ids.text}
            ref={textRef}
            rows={3}
            value={style.text}
            maxLength={500}
            data-testid="watermark-text"
            onChange={(event) => update({ text: event.target.value })}
            className={`${inputClass} resize-y leading-snug`}
          />
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-500">Insérer :</span>
            {TEMPLATE_VARIABLES.map((variable) => (
              <button
                key={variable}
                type="button"
                onClick={() => insertVariable(variable)}
                className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700 hover:bg-slate-200"
              >
                {`{${variable}}`}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <div className="sm:col-span-2 lg:col-span-1 xl:col-span-2">
            <label htmlFor={ids.dest} className="mb-1 block text-xs font-medium text-slate-600">
              Destinataire
            </label>
            <input
              id={ids.dest}
              className={inputClass}
              value={vars.destinataire}
              placeholder="ex. M. et Mme Martin"
              data-testid="var-destinataire"
              autoComplete="off"
              onChange={(event) => onVarsChange({ ...vars, destinataire: event.target.value })}
            />
          </div>
          <div>
            <label htmlFor={ids.objet} className="mb-1 block text-xs font-medium text-slate-600">
              Objet
            </label>
            <input
              id={ids.objet}
              className={inputClass}
              value={vars.objet}
              placeholder="ex. location T2 rue Victor-Hugo"
              data-testid="var-objet"
              autoComplete="off"
              onChange={(event) => onVarsChange({ ...vars, objet: event.target.value })}
            />
          </div>
          <div>
            <label htmlFor={ids.date} className="mb-1 block text-xs font-medium text-slate-600">
              Date
            </label>
            <input
              id={ids.date}
              type="date"
              className={inputClass}
              value={vars.date}
              data-testid="var-date"
              onChange={(event) => onVarsChange({ ...vars, date: event.target.value })}
            />
          </div>
        </div>
        {missing.length > 0 && (
          <p className="flex items-start gap-1.5 text-xs text-amber-800">
            <AlertIcon className="mt-px shrink-0" width={14} height={14} />
            Variable{missing.length > 1 ? "s" : ""} non renseignée{missing.length > 1 ? "s" : ""} :{" "}
            {missing.map((v) => `{${v}}`).join(", ")} — remplacée{missing.length > 1 ? "s" : ""} par « … ».
          </p>
        )}
      </Section>

      <Section title="Apparence">
        <Slider
          label="Angle"
          value={style.angle}
          display={`${style.angle}°`}
          min={STYLE_LIMITS.angle.min}
          max={STYLE_LIMITS.angle.max}
          step={5}
          testId="angle"
          onChange={(angle) => update({ angle })}
        />
        <Slider
          label="Opacité"
          value={Math.round(style.opacity * 100)}
          display={`${Math.round(style.opacity * 100)} %`}
          min={STYLE_LIMITS.opacity.min * 100}
          max={STYLE_LIMITS.opacity.max * 100}
          step={1}
          testId="opacity"
          onChange={(value) => update({ opacity: value / 100 })}
        />
        <Slider
          label="Taille du texte"
          value={style.fontSize}
          display={`${style.fontSize} pt`}
          min={STYLE_LIMITS.fontSize.min}
          max={STYLE_LIMITS.fontSize.max}
          step={1}
          testId="font-size"
          onChange={(fontSize) => update({ fontSize })}
        />
        <Slider
          label="Densité"
          value={style.density}
          display={`${style.density} / 10`}
          min={STYLE_LIMITS.density.min}
          max={STYLE_LIMITS.density.max}
          step={1}
          testId="density"
          onChange={(density) => update({ density })}
        />
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={ids.color} className="text-sm text-slate-700">
            Couleur
          </label>
          <div className="flex items-center gap-1.5">
            {COLOR_SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => update({ color })}
                aria-label={`Couleur ${color}`}
                className={`size-6 rounded-full ring-offset-2 ${
                  style.color.toLowerCase() === color ? "ring-2 ring-teal-700" : "ring-1 ring-slate-300"
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
            <input
              id={ids.color}
              type="color"
              value={style.color}
              onChange={(event) => update({ color: event.target.value })}
              className="h-7 w-9 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
            />
          </div>
        </div>
      </Section>

      <Section title="Fichier de sortie">
        <Toggle
          checked={output.flatten}
          onChange={(flatten) => onOutputChange({ ...output, flatten })}
          label="Aplatir (recommandé)"
          testId="flatten-toggle"
          description={
            output.flatten
              ? "Chaque page devient une image avec le filigrane incrusté : impossible de le retirer avec un éditeur PDF. Le texte n’est plus sélectionnable."
              : "Filigrane ajouté en couche vectorielle : fichier plus léger, texte sélectionnable, mais un éditeur PDF peut le supprimer."
          }
        />
        {output.flatten && (
          <div>
            <p className="mb-1.5 text-sm text-slate-700">Résolution</p>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1" role="radiogroup">
              {DPI_OPTIONS.map((dpi) => (
                <button
                  key={dpi}
                  type="button"
                  role="radio"
                  aria-checked={output.dpi === dpi}
                  data-testid={`dpi-${dpi}`}
                  onClick={() => onOutputChange({ ...output, dpi })}
                  className={`rounded-md px-2 py-1 text-center text-sm transition-colors ${
                    output.dpi === dpi ? "bg-white font-medium text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {dpi} dpi
                  <span className="block text-[10px] text-slate-500">{DPI_LABELS[dpi]}</span>
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-slate-500">Plus la résolution est élevée, plus le fichier est lourd.</p>
          </div>
        )}
        <p className="flex items-start gap-1.5 text-xs text-slate-500">
          <CheckIcon className="mt-px shrink-0 text-emerald-700" width={14} height={14} />
          Métadonnées supprimées (auteur, logiciel, dates de création).
        </p>
      </Section>

      <Section title="Mot de passe">
        <Toggle
          checked={output.passwordEnabled}
          onChange={(passwordEnabled) => onOutputChange({ ...output, passwordEnabled })}
          label="Protéger par mot de passe"
          testId="password-toggle"
          description="Chiffrement AES-256. Le mot de passe sera demandé à l’ouverture."
        />
        {output.passwordEnabled && (
          <>
            <div>
              <label htmlFor={ids.pwd} className="sr-only">
                Mot de passe
              </label>
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <input
                    id={ids.pwd}
                    type={showPassword ? "text" : "password"}
                    value={output.password}
                    autoComplete="new-password"
                    spellCheck={false}
                    placeholder="Mot de passe"
                    data-testid="password-input"
                    onChange={(event) => onOutputChange({ ...output, password: event.target.value })}
                    className={`${inputClass} pr-9 font-mono`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-800"
                  >
                    {showPassword ? <EyeOffIcon width={16} height={16} /> : <EyeIcon width={16} height={16} />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onOutputChange({ ...output, password: generatePassword() });
                    setShowPassword(true);
                  }}
                  title="Générer un mot de passe robuste"
                  aria-label="Générer un mot de passe robuste"
                  className="rounded-lg border border-slate-300 px-2 text-slate-600 hover:bg-slate-50"
                >
                  <SparkIcon width={16} height={16} />
                </button>
                <button
                  type="button"
                  onClick={copyPassword}
                  disabled={!output.password}
                  title="Copier"
                  aria-label="Copier le mot de passe"
                  className="rounded-lg border border-slate-300 px-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  {copied ? <CheckIcon width={16} height={16} /> : <CopyIcon width={16} height={16} />}
                </button>
              </div>
              <div className="mt-2 flex gap-1" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className={`h-1.5 flex-1 rounded-full ${
                      output.password && i <= strength.level ? STRENGTH_COLORS[strength.level] : "bg-slate-200"
                    }`}
                  />
                ))}
              </div>
              <p className="mt-1 text-xs text-slate-600" data-testid="password-strength">
                Robustesse : <strong>{strength.label}</strong>
                {output.password && strength.level < 4 ? ` — ${strength.hint}` : ""}
              </p>
            </div>
            <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs leading-relaxed text-amber-900">
              <AlertIcon className="mt-px shrink-0" width={16} height={16} />
              <p>
                <strong>Transmettez le mot de passe par un autre canal que le document.</strong> Par exemple : PDF par
                e-mail, mot de passe par SMS ou de vive voix. Envoyés ensemble, la protection est inutile.
              </p>
            </div>
          </>
        )}
      </Section>
    </div>
  );
}
