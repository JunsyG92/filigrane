import assert from "node:assert/strict";
import { test } from "node:test";
import { layoutWatermark, placementToPage } from "./layout.ts";

const base = {
  pageWidth: 595,
  pageHeight: 842,
  lines: ["Dossier de location"],
  lineWidths: [180],
  fontSize: 18,
  density: 5,
  angleDeg: 45,
};

function coverage(placements: ReturnType<typeof layoutWatermark>, angle: number) {
  const points = placements.map((p) => placementToPage(p, 0, 0, angle));
  return {
    minX: Math.min(...points.map((p) => p.x)),
    maxX: Math.max(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxY: Math.max(...points.map((p) => p.y)),
  };
}

test("la mosaïque couvre toute la page, quel que soit l'angle", () => {
  for (const angle of [-90, -45, 0, 30, 45, 90]) {
    const placements = layoutWatermark({ ...base, angleDeg: angle });
    assert.ok(placements.length > 4, `angle ${angle}: trop peu de tuiles`);
    const box = coverage(placements, angle);
    assert.ok(box.minX < -base.pageWidth / 2 + 60 && box.maxX > base.pageWidth / 2 - 60, `angle ${angle}: largeur`);
    assert.ok(box.minY < -base.pageHeight / 2 + 60 && box.maxY > base.pageHeight / 2 - 60, `angle ${angle}: hauteur`);
  }
});

test("la densité augmente le nombre de répétitions", () => {
  const sparse = layoutWatermark({ ...base, density: 1 }).length;
  const dense = layoutWatermark({ ...base, density: 10 }).length;
  assert.ok(dense > sparse * 3, `${dense} vs ${sparse}`);
});

test("chaque tuile contient toutes les lignes, dans l'ordre, de haut en bas", () => {
  const placements = layoutWatermark({ ...base, angleDeg: 0, lines: ["A", "B"], lineWidths: [10, 20] });
  assert.equal(placements.length % 2, 0);
  for (let i = 0; i < placements.length; i += 2) {
    assert.equal(placements[i].text, "A");
    assert.equal(placements[i + 1].text, "B");
    assert.ok(placements[i].v > placements[i + 1].v);
  }
});

test("aucun placement sans texte ou page invalide", () => {
  assert.deepEqual(layoutWatermark({ ...base, lines: [], lineWidths: [] }), []);
  assert.deepEqual(layoutWatermark({ ...base, pageWidth: 0 }), []);
});
