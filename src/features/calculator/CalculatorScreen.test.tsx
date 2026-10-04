import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { CalculatorScreen } from "./CalculatorScreen";
import { defaultCalculatorState } from "./model";
import { useCalculatorStore } from "./store";

function renderCalculator() {
  return render(
    <MemoryRouter initialEntries={["/calculator"]}>
      <CalculatorScreen />
      <LocationProbe />
    </MemoryRouter>,
  );
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

describe("CalculatorScreen", () => {
  beforeEach(() => {
    localStorage.clear();
    useCalculatorStore.getState().replaceCalculator(defaultCalculatorState);
  });

  it("updates remaining time from attempt entry and persists it", async () => {
    renderCalculator();
    const input = screen.getByLabelText("Attempt 1");
    for (const key of "100000") fireEvent.keyDown(input, { key });
    fireEvent.keyDown(input, { key: "Enter" });

    const remainingCard = screen.getByText("Remaining").parentElement;
    if (!remainingCard) throw new Error("Remaining card was not rendered.");
    expect(within(remainingCard).getByText("10:00.00")).toBeInTheDocument();
    expect(localStorage.getItem("ct:v1:calculator")).toBeNull();
    await waitFor(() =>
      expect(window.location.href).not.toBe(""),
    );
  });

  it("offers DNS the rest once any attempt is entered", () => {
    renderCalculator();
    const dnsRest = screen.getByRole("button", { name: "DNS the rest" });
    expect(dnsRest).toBeDisabled();
    const input = screen.getByLabelText("Attempt 1");
    for (const key of "30000") fireEvent.keyDown(input, { key });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(dnsRest).toBeEnabled();
  });

  it("shows an upper bound when a DNF has no elapsed time", () => {
    renderCalculator();
    fireEvent.keyDown(screen.getByLabelText("Attempt 1"), { key: "d" });
    expect(screen.getByText(/1 DNF is missing elapsed time/i)).toBeInTheDocument();
    expect(screen.getByText("≤ 20:00.00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stopped at the limit" })).toBeDisabled();
  });

  it("keeps the saved setup when the common-limit selector only blurs", () => {
    renderCalculator();
    const limit = screen.getByLabelText("Cumulative limit");
    fireEvent.focus(limit);
    fireEvent.blur(limit);
    expect(useCalculatorStore.getState().calculator.presetId).toBe("333bf-bo3-20");
  });

  it("changes the calculator to a common minute limit", async () => {
    const user = userEvent.setup();
    renderCalculator();
    await user.click(screen.getByLabelText("Cumulative limit"));
    await user.click(screen.getByRole("option", { name: "1:00:00.00" }));
    expect(useCalculatorStore.getState().calculator.limitCentiseconds).toBe(360_000);
  });

  it("accepts a custom number of attempts", async () => {
    const user = userEvent.setup();
    renderCalculator();
    await user.click(screen.getByLabelText("Attempts"));
    await user.click(screen.getByRole("option", { name: "Custom" }));
    const custom = screen.getByLabelText("Custom attempts");
    await user.clear(custom);
    await user.type(custom, "12");
    await user.keyboard("{Enter}");
    expect(useCalculatorStore.getState().calculator.attempts).toHaveLength(12);
  });

  it("confirms stop-at-limit before recording the DNF", async () => {
    const user = userEvent.setup();
    renderCalculator();
    await user.click(screen.getByRole("button", { name: "Stopped at the limit" }));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Attempt 1 will be recorded as DNF at exactly 20:00.00, and the attempts after it as DNS.",
    );
    expect(screen.getByRole("button", { name: "Record DNF" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
  });

  it("resets entered attempts after confirmation and keeps the setup", async () => {
    const user = userEvent.setup();
    renderCalculator();
    const reset = screen.getByRole("button", { name: "Reset" });
    expect(reset).toBeDisabled();

    await user.click(screen.getByLabelText("Cumulative limit"));
    await user.click(screen.getByRole("option", { name: "1:00:00.00" }));
    const input = screen.getByLabelText("Attempt 1");
    for (const key of "60000") fireEvent.keyDown(input, { key });
    fireEvent.keyDown(input, { key: "Enter" });

    await user.click(reset);
    expect(screen.getByRole("dialog")).toHaveTextContent("This clears 1 entered attempt.");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Reset" }));

    const { calculator } = useCalculatorStore.getState();
    expect(calculator.attempts.every(({ outcome }) => outcome === "skipped")).toBe(true);
    expect(calculator.attempts).toHaveLength(3);
    expect(calculator.limitCentiseconds).toBe(360_000);
    expect(screen.getByLabelText("Attempt 1")).toHaveValue("");
  });
});
