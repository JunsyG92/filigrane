import assert from "node:assert/strict";
import { test } from "node:test";
import { formatFrenchDate, missingVariables, resolveTemplate, todayIso, watermarkLines } from "./template.ts";

const vars = { destinataire: "M. Martin", objet: "location T2", date: "2026-09-14" };

test("remplace les variables, insensible à la casse et aux espaces", () => {
  assert.equal(
    resolveTemplate("Transmis à {destinataire} le { DATE } — usage limité à {Objet}", vars),
    "Transmis à M. Martin le 14/09/2026 — usage limité à location T2",
  );
});

test("les variables vides deviennent « … » et sont signalées", () => {
  const empty = { destinataire: " ", objet: "", date: "2026-01-02" };
  assert.equal(resolveTemplate("À {destinataire} pour {objet}", empty), "À … pour …");
  assert.deepEqual(missingVariables("À {destinataire} pour {objet} le {date}", empty), ["destinataire", "objet"]);
});

test("découpe en lignes et ignore les lignes vides", () => {
  assert.deepEqual(watermarkLines("Ligne 1\r\n\n  Ligne   2  \n", vars), ["Ligne 1", "Ligne 2"]);
});

test("formats de date", () => {
  assert.equal(formatFrenchDate("2026-09-14"), "14/09/2026");
  assert.equal(formatFrenchDate("demain"), "demain");
  assert.equal(todayIso(new Date(2026, 0, 5)), "2026-01-05");
});
