// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { TurnstileWidget } from "./Turnstile";

type Opts = { callback: (t: string) => void };

describe("TurnstileWidget", () => {
  const renderMock = vi.fn();
  const removeMock = vi.fn();
  let opts: Opts | null = null;

  beforeEach(() => {
    opts = null;
    renderMock.mockReset().mockImplementation((_el: HTMLElement, o: Opts) => {
      opts = o;
      return "widget-1";
    });
    removeMock.mockReset();
    window.turnstile = { render: renderMock, remove: removeMock, reset: vi.fn() };
  });

  afterEach(() => {
    cleanup();
    delete window.turnstile;
  });

  it("üst bileşen yeni callback verip yeniden render olunca widget sıfırlanmaz", () => {
    const { rerender } = render(<TurnstileWidget onSuccess={() => {}} />);
    // Gate her tuş vuruşunda yeni bir fonksiyon verir
    rerender(<TurnstileWidget onSuccess={() => {}} />);
    rerender(<TurnstileWidget onSuccess={() => {}} onError={() => {}} />);

    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(removeMock).not.toHaveBeenCalled();
  });

  it("token geldiğinde en güncel onSuccess çağrılır", () => {
    const eski = vi.fn();
    const yeni = vi.fn();
    const { rerender } = render(<TurnstileWidget onSuccess={eski} />);
    rerender(<TurnstileWidget onSuccess={yeni} />);

    opts!.callback("tok-123");

    expect(yeni).toHaveBeenCalledWith("tok-123");
    expect(eski).not.toHaveBeenCalled();
  });

  it("bileşen kaldırılınca widget temizlenir", () => {
    const { unmount } = render(<TurnstileWidget onSuccess={() => {}} />);
    unmount();
    expect(removeMock).toHaveBeenCalledWith("widget-1");
  });
});
