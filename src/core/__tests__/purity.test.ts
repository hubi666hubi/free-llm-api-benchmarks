import { describe, it, expect } from "vitest";

// @ts-ignore import.meta.glob is provided by Vite/Vitest (no vite/client types in tsconfig)
const sources: Record<string, string> = import.meta.glob(["../**/*.ts", "!../__tests__/**"], {
  query: "?raw",
  import: "default",
  eager: true,
});

describe("core purity", () => {
  const rules: [string, RegExp][] = [
    ["import from components/", /from\s+["'][^"']*components\//],
    ["import from react", /from\s+["']react/],
    ["import from adapters/", /from\s+["'][^"']*adapters\//],
    ["global fetch call", /(?<![.\w])fetch\(/],
  ];
  for (const [file, raw] of Object.entries(sources)) {
    it(`${file} has no forbidden dependencies`, () => {
      const code = raw
        .replace(/`[\s\S]*?`/g, "``")
        .split("\n")
        .filter((l: string) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
        .join("\n");
      for (const [name, re] of rules) expect(re.test(code), name).toBe(false);
    });
  }
});
