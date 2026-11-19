import { BenchmarkCatalog } from "../core/catalog/BenchmarkCatalog";
import { rawBenchmarkCsv } from "./rawCsv";

/**
 * Pre-instantiated catalog containing all benchmark records from the CSV dataset.
 */
export const defaultCatalog = BenchmarkCatalog.parseCSV(rawBenchmarkCsv);
