import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAPER_CASH_RP,
  createDefaultPaperPortfolio,
  evaluatePaperPortfolio,
  executePaperBuy,
  executePaperSell,
} from "../paper-trading";

describe("paper-trading IDX virtual portfolio engine", () => {
  it("executes buy with 0.15% IDX broker fee and computes weighted average price", () => {
    const init = createDefaultPaperPortfolio();
    const buy1 = executePaperBuy(init, { ticker: "BBCA", price: 6000, lots: 10 });
    expect(buy1.ok).toBe(true);
    // Gross Rp 6.000.000 + 0.15% fee (Rp 9.000) = Rp 6.009.000
    expect(buy1.state.cashRp).toBe(DEFAULT_PAPER_CASH_RP - 6_009_000);
    expect(buy1.state.positions.BBCA.lots).toBe(10);
    expect(buy1.state.positions.BBCA.avgPrice).toBe(6000);

    const buy2 = executePaperBuy(buy1.state, { ticker: "BBCA", price: 6600, lots: 10 });
    expect(buy2.ok).toBe(true);
    expect(buy2.state.positions.BBCA.lots).toBe(20);
    expect(buy2.state.positions.BBCA.avgPrice).toBe(6300);
  });

  it("rejects buy exceeding virtual cash balance", () => {
    const init = createDefaultPaperPortfolio();
    const res = executePaperBuy(init, { ticker: "BBCA", price: 6000, lots: 200 });
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
  });

  it("executes sell with 0.25% IDX fee, tracks realized P/L, and evaluates floating P/L", () => {
    const init = createDefaultPaperPortfolio();
    const bought = executePaperBuy(init, { ticker: "BMRI", price: 4000, lots: 10 }).state;
    // Sell half (5 lots) at 4400 -> gross 2.200.000, fee 0.25% = 5.500, net = 2.194.500, cost = 2.000.000 -> realized +194.500
    const sold = executePaperSell(bought, { ticker: "BMRI", price: 4400, lots: 5 });
    expect(sold.ok).toBe(true);
    expect(sold.state.positions.BMRI.lots).toBe(5);
    expect(sold.state.realizedPnlRp).toBe(194_500);

    // Remaining 5 lots (500 lbr @ avg 4000) evaluated at live price 4600 -> unrealized +300.000
    const summary = evaluatePaperPortfolio(sold.state, { BMRI: 4600 });
    expect(summary.holdingsValueRp).toBe(2_300_000);
    expect(summary.unrealizedPnlRp).toBe(300_000);
    expect(summary.positions).toHaveLength(1);
    expect(summary.positions[0].unrealizedPnlPct).toBeCloseTo(15, 2);
  });
});
