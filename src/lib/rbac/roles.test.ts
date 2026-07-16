import { describe, it, expect } from "vitest";
import { DEFAULT_ROLE_PAGES, ROLE_LABELS, isFederal, PAGES } from "./roles";

describe("RBAC roles", () => {
  it("todos os roles têm label", () => {
    expect(Object.keys(ROLE_LABELS).sort()).toEqual(["admin", "analista", "gestor", "operador"]);
  });
  it("páginas por role são um subconjunto do catálogo PAGES", () => {
    for (const pages of Object.values(DEFAULT_ROLE_PAGES)) {
      for (const p of pages) expect(PAGES).toContain(p);
    }
  });
  it("admin vê todas as páginas", () => {
    expect(DEFAULT_ROLE_PAGES.admin.length).toBe(PAGES.length);
  });
  it("operador não acessa área Federal", () => {
    expect(DEFAULT_ROLE_PAGES.operador).not.toContain("boletos-recebidos");
    expect(DEFAULT_ROLE_PAGES.operador).not.toContain("logs");
  });
  it("isFederal identifica admin/gestor/analista", () => {
    expect(isFederal("admin")).toBe(true);
    expect(isFederal("gestor")).toBe(true);
    expect(isFederal("analista")).toBe(true);
    expect(isFederal("operador")).toBe(false);
    expect(isFederal(null)).toBe(false);
  });
});