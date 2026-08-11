import { readFileSync, writeFileSync } from "node:fs";

const inputPath =
  "C:/Users/Acer/Documents/MathsRush3D/assignment_work/walter_batches.json";
const outputPath =
  "C:/Users/Acer/Documents/MathsRush3D/assignment_work/walter_results.json";

export function loadBatches() {
  return JSON.parse(readFileSync(inputPath, "utf8"));
}

export function saveResults(results) {
  writeFileSync(outputPath, JSON.stringify(results, null, 2), "utf8");
  return outputPath;
}
