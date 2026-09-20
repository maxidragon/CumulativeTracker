import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("AppRouter", () => {
  it("renders the home screen", () => {
    window.location.hash = "#/";
    render(<App />);

    expect(
      screen.getByRole("heading", { name: /know exactly how much time is left/i }),
    ).toBeInTheDocument();
  });

  it("loads the settings route", async () => {
    window.location.hash = "#/settings";
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: /preferences and stored data/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: /color theme/i })).toBeInTheDocument();
  });
});
