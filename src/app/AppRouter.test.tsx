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
});
