import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TrackedAttempt } from "../../lib/attempt";
import { AttemptInput } from "./AttemptInput";

const skippedAttempt: TrackedAttempt = {
  roundId: "333bf-r1",
  attemptNumber: 2,
  outcome: "skipped",
  centiseconds: null,
  estimated: false,
  order: 2,
  enteredAt: "2026-01-01T00:00:00.000Z",
};

describe("AttemptInput", () => {
  it("fills numeric keys right to left and commits on Enter", () => {
    const onCommit = vi.fn();
    const onMove = vi.fn();
    render(<AttemptInput attempt={skippedAttempt} onCommit={onCommit} onMove={onMove} />);
    const input = screen.getByLabelText("Attempt 2");

    for (const key of "25000") fireEvent.keyDown(input, { key });
    expect(input).toHaveValue("2:50.00");

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCommit).toHaveBeenLastCalledWith(
      expect.objectContaining({ outcome: "ok", centiseconds: 17_000 }),
    );
    expect(onMove).toHaveBeenCalledWith("next", "enter");
  });

  it("keeps explicit zero centiseconds in an entered time", () => {
    render(
      <AttemptInput
        attempt={{ ...skippedAttempt, outcome: "ok", centiseconds: 1_200 }}
        onCommit={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Attempt 2")).toHaveValue("12.00");
  });

  it.each(["d", "D", "/", "#"])("toggles DNF with the %s key", (key) => {
    const onCommit = vi.fn();
    render(<AttemptInput attempt={skippedAttempt} onCommit={onCommit} />);
    fireEvent.keyDown(screen.getByLabelText("Attempt 2"), { key });
    expect(onCommit).toHaveBeenLastCalledWith(
      expect.objectContaining({ outcome: "dnf", centiseconds: null }),
    );
    expect(screen.getByText("Elapsed time not recorded")).toBeInTheDocument();
  });

  it.each(["s", "S", "*"])("toggles DNS with the %s key", (key) => {
    const onCommit = vi.fn();
    render(<AttemptInput attempt={skippedAttempt} onCommit={onCommit} />);
    const input = screen.getByLabelText("Attempt 2");
    fireEvent.keyDown(input, { key });
    expect(input).toBeDisabled();
    expect(onCommit).toHaveBeenLastCalledWith(
      expect.objectContaining({ outcome: "dns", centiseconds: null }),
    );
  });

  it("keeps elapsed time when DNF is toggled", () => {
    const onCommit = vi.fn();
    render(<AttemptInput attempt={skippedAttempt} onCommit={onCommit} />);
    const input = screen.getByLabelText("Attempt 2");
    for (const key of "100000") fireEvent.keyDown(input, { key });
    fireEvent.keyDown(input, { key: "d" });

    expect(onCommit).toHaveBeenLastCalledWith(
      expect.objectContaining({ outcome: "dnf", centiseconds: 60_000 }),
    );
    expect(input).not.toBeDisabled();
  });

  it("truncates ten-minute results on blur", () => {
    const onCommit = vi.fn();
    render(<AttemptInput attempt={skippedAttempt} onCommit={onCommit} />);
    const input = screen.getByLabelText("Attempt 2");
    for (const key of "100047") fireEvent.keyDown(input, { key });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenLastCalledWith(
      expect.objectContaining({ outcome: "ok", centiseconds: 60_000 }),
    );
  });

  it("removes the last typed digit with Backspace", () => {
    render(<AttemptInput attempt={skippedAttempt} onCommit={vi.fn()} />);
    const input = screen.getByLabelText("Attempt 2");
    for (const key of "25000") fireEvent.keyDown(input, { key });
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(input).toHaveValue("25.00");
  });

  it("commits an overflowing slot as its real time", () => {
    const onCommit = vi.fn();
    render(<AttemptInput attempt={skippedAttempt} onCommit={onCommit} />);
    const input = screen.getByLabelText("Attempt 2");
    for (const key of "9999") fireEvent.keyDown(input, { key });
    expect(input).toHaveValue("99.99");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCommit).toHaveBeenLastCalledWith(
      expect.objectContaining({ outcome: "ok", centiseconds: 9_999 }),
    );
    expect(input).toHaveValue("1:39.99");
  });

  it("reverts a draft with Escape and moves backwards with Shift+Enter", () => {
    const onCommit = vi.fn();
    const onMove = vi.fn();
    render(<AttemptInput attempt={skippedAttempt} onCommit={onCommit} onMove={onMove} />);
    const input = screen.getByLabelText("Attempt 2");
    fireEvent.keyDown(input, { key: "1" });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveValue("");
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(onMove).toHaveBeenCalledWith("previous", "enter");
  });

  it("moves with the arrow keys without recommitting an unchanged attempt", () => {
    const onCommit = vi.fn();
    const onMove = vi.fn();
    render(
      <AttemptInput
        attempt={{ ...skippedAttempt, outcome: "ok", centiseconds: 6_000 }}
        onCommit={onCommit}
        onMove={onMove}
      />,
    );
    const input = screen.getByLabelText("Attempt 2");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(onMove).toHaveBeenLastCalledWith("next", "arrow");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(onMove).toHaveBeenLastCalledWith("previous", "arrow");
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("reorders with Alt+arrows", () => {
    const onCommit = vi.fn();
    const onReorder = vi.fn();
    render(
      <AttemptInput attempt={skippedAttempt} onCommit={onCommit} onReorder={onReorder} />,
    );
    const input = screen.getByLabelText("Attempt 2");
    fireEvent.keyDown(input, { key: "ArrowUp", altKey: true });
    expect(onReorder).toHaveBeenCalledWith("earlier");
    fireEvent.keyDown(input, { key: "ArrowDown", altKey: true });
    expect(onReorder).toHaveBeenLastCalledWith("later");
  });

  it("leaves the field with Escape once there is nothing to revert", () => {
    const onExit = vi.fn();
    render(<AttemptInput attempt={skippedAttempt} onCommit={vi.fn()} onExit={onExit} />);
    const input = screen.getByLabelText("Attempt 2");
    fireEvent.keyDown(input, { key: "1" });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onExit).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onExit).toHaveBeenCalledOnce();
  });

  it("keeps the DNF and DNS toggles out of the tab order so Tab goes field to field", () => {
    render(<AttemptInput attempt={skippedAttempt} onCommit={vi.fn()} />);
    for (const name of ["DNF", "DNS"]) {
      expect(screen.getByRole("button", { name })).toHaveAttribute("tabindex", "-1");
    }
  });

  it("warns without blocking a time over the cap", () => {
    render(
      <AttemptInput
        attempt={{ ...skippedAttempt, outcome: "ok", centiseconds: 20_000 }}
        capCentiseconds={15_000}
        onCommit={vi.fn()}
      />,
    );
    expect(screen.getByText(/over the 2:30.00 cap/i)).toBeInTheDocument();
  });
});
