// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createSampleProject } from "@agentic-galgame/vn-core";
import { PlayerApp } from "./PlayerApp";

describe("PlayerApp", () => {
  beforeEach(() => {
    const storage = createMemoryStorage();
    Object.defineProperty(window, "localStorage", {
      value: storage,
      configurable: true
    });
    Object.defineProperty(globalThis, "localStorage", {
      value: storage,
      configurable: true
    });
    window.history.replaceState(null, "", "/");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("loads a VNProject and plays it without Studio UI", async () => {
    const project = createSampleProject();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(project), {
      status: 200,
      headers: { "content-type": "application/json" }
    })));

    render(<PlayerApp />);

    await waitFor(() => expect(screen.getByText("1 / 3")).toBeInTheDocument());
    expect(screen.queryByText("Generate VN Project")).not.toBeInTheDocument();
    expect(document.querySelector(".vn-line")?.textContent).toBe("实验室里只剩下显示器的蓝光。");

    expect(screen.getByRole("button", { name: "全屏" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "下一段" }));

    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(document.querySelector(".vn-speaker")?.textContent).toBe("林雪");
    expect(document.querySelector(".vn-line")?.textContent).toBe("「你听见了吗？」");
  });

  it("supports player save and load", async () => {
    const project = createSampleProject();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(project), {
      status: 200,
      headers: { "content-type": "application/json" }
    })));

    render(<PlayerApp />);

    await waitFor(() => expect(screen.getByText("1 / 3")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "下一段" }));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "存档" }));
    fireEvent.click(screen.getByRole("button", { name: "下一段" }));
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "读档" }));

    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(screen.getByText("已读档")).toBeInTheDocument();
  });

  it("loads a projectUrl query parameter", async () => {
    window.history.replaceState(null, "", "/?projectUrl=https%3A%2F%2Fcdn.example.com%2Fvn%2Fproject.vn.json");
    const project = createSampleProject();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(project), {
      status: 200,
      headers: { "content-type": "application/json" }
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<PlayerApp />);

    await waitFor(() => expect(screen.getByText("1 / 3")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("https://cdn.example.com/vn/project.vn.json");
  });
});

function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(data.keys())[index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    }
  };
}
