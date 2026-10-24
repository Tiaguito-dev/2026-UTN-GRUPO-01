// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useAllPages } from "../src/hooks/useAllPages";
import { listarMaterias } from "../src/services/materias";

const { requests } = vi.hoisted(() => ({ requests: [] as string[] }));
// Keep the hook and service real: only the authenticated HTTP transport is simulated.
// Respond according to its actual query so a page-size regression cannot be hidden.
vi.mock("../src/services/auth", () => ({
  getAuthService: () => ({
    protectedGet: async (path: string) => {
      requests.push(path);
      const url = new URL(path, "http://test");
      const page = Number(url.searchParams.get("page"));
      const pageSize = Number(url.searchParams.get("pageSize"));
      const all = Array.from({ length: 181 }, (_, index) => ({ id: String(index + 1), nombre: `Materia ${index + 1}` }));
      return { items: all.slice((page - 1) * pageSize, page * pageSize), total: all.length, page, pageSize };
    },
  }),
}));

beforeEach(() => { requests.length = 0; });
afterEach(cleanup);
it("el selector administrativo recupera las 181 materias, incluida la última", async () => {
  const { result } = renderHook(() => useAllPages("materias", page => listarMaterias({ page, pageSize: 100 })));
  await waitFor(() => expect(result.current.state.status).toBe("ready"));
  const { state } = result.current;
  const items = state.status === "ready" ? state.data : [];
  expect(items).toHaveLength(181);
  expect(items.at(-1)?.id).toBe("181");
  expect(requests).toEqual(["/materias?page=1&pageSize=100", "/materias?page=2&pageSize=100"]);
});
