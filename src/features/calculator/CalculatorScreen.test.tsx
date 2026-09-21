import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { CalculatorScreen } from "./CalculatorScreen";
import { defaultCalculatorState, encodeCalculatorState } from "./model";
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
    for (const key of "60000") fireEvent.keyDown(input, { key });
    fireEvent.keyDown(input, { key: "Enter" });

    const remainingCard = screen.getByText("Remaining").parentElement;
    if (!remainingCard) throw new Error("Remaining card was not rendered.");
    expect(within(remainingCard).getByText("10:00")).toBeInTheDocument();
    expect(localStorage.getItem("ct:v1:calculator")).toContain('"centiseconds":60000');
    await waitFor(() =>
      expect(window.location.href).not.toBe(""),
    );
  });

  it("shows an upper bound when a DNF has no elapsed time", () => {
    renderCalculator();
    fireEvent.keyDown(screen.getByLabelText("Attempt 1"), { key: "d" });
    expect(screen.getByText(/1 DNF is missing elapsed time/i)).toBeInTheDocument();
    expect(screen.getAllByText("≤ 20:00")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Stopped at the limit" })).toBeDisabled();
  });

  it("keeps the saved setup when the common-limit selector only blurs", () => {
    renderCalculator();
    const limit = screen.getByLabelText("Common cumulative limit");
    fireEvent.focus(limit);
    fireEvent.blur(limit);
    expect(useCalculatorStore.getState().calculator.presetId).toBe("333bf-bo3-20");
  });

  it("changes the calculator to a common minute limit", async () => {
    const user = userEvent.setup();
    renderCalculator();
    await user.click(screen.getByLabelText("Common cumulative limit"));
    await user.click(screen.getByRole("option", { name: "60:00" }));
    expect(useCalculatorStore.getState().calculator.limitCentiseconds).toBe(360_000);
  });

  it("confirms stop-at-limit before recording the DNF", async () => {
    const user = userEvent.setup();
    renderCalculator();
    await user.click(screen.getByRole("button", { name: "Stopped at the limit" }));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Attempt 1 will be recorded as DNF at exactly 20:00.",
    );
    expect(screen.getByRole("button", { name: "Record DNF" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
  });

  it("encodes the current state for a shareable URL", async () => {
    renderCalculator();
    const encoded = encodeCalculatorState(defaultCalculatorState);
    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(`?state=${encoded}`);
    });
  });
});
