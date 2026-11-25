import { describe, expect, it } from "vitest";
import {
  formatNumber,
  formatDesimal,
  formatMultiple,
  formatPersen,
  formatRupiah,
  parseFormattedNumber,
  calculateAnnualizedIRR,
} from "@/lib/format";

describe("format utilities (id-ID)", () => {
  it("formats whole numbers and Rupiah with dot thousand separators", () => {
    expect(formatNumber(5800)).toBe("5.800");
    expect(formatNumber(1250000)).toBe("1.250.000");
    expect(formatRupiah(10450)).toBe("Rp 10.450");
    expect(formatRupiah(10450, false)).toBe("10.450");
  });

  it("formats decimals, multiples, and percentages with commas", () => {
    expect(formatDesimal(14.5, 1)).toBe("14,5");
    expect(formatDesimal(2.51, 2, true)).toBe("+2,51");
    expect(formatMultiple(23.4, 1)).toBe("23,4x");
    expect(formatPersen(6.57, 1)).toBe("6,6%");
    expect(formatPersen(6.57, 1, true)).toBe("+6,6%");
    expect(formatPersen(-0.49, 2, true)).toBe("-0,49%");
  });

  it("parses formatted Indonesian numbers cleanly", () => {
    expect(parseFormattedNumber("3.000.000")).toBe(3000000);
    expect(parseFormattedNumber("Rp 15.250")).toBe(15250);
    expect(parseFormattedNumber("")).toBe(0);
  });
});

describe("calculateAnnualizedIRR", () => {
  it("computes exact annualized return for simple 1-year quarterly cash flows", () => {
    // Setor Rp 100 di t=0, tidak ada setoran di t=1..3, terima Rp 110 di t=4 (1 tahun -> +10%/th)
    const irr = calculateAnnualizedIRR([-100, 0, 0, 0, 110]);
    expect(irr).not.toBeNull();
    expect(irr!).toBeCloseTo(10.0, 2);
  });

  it("computes annualized IRR for regular quarterly DCA deposits", () => {
    // 4x setor -100 (total 400), terima 440 pada akhir kuartal ke-4
    const irr = calculateAnnualizedIRR([-100, -100, -100, -100, 440]);
    expect(irr).not.toBeNull();
    expect(irr!).toBeGreaterThan(10);
    expect(irr!).toBeLessThan(25);
  });

  it("returns null for degenerate cash flows without both inflows and outflows", () => {
    expect(calculateAnnualizedIRR([])).toBeNull();
    expect(calculateAnnualizedIRR([-100])).toBeNull();
    expect(calculateAnnualizedIRR([-100, -200])).toBeNull();
    expect(calculateAnnualizedIRR([100, 200])).toBeNull();
  });
});
