import { describe, expect, it, vi } from "vitest";
import { AdministrarSugerencias } from "../src/community/application/administrar-sugerencias.js";

const id = "be6a4090-7221-4340-aacc-27715417dd1c";
function fixture() {
  const repository = { listar: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }), cambiarMeGusta: vi.fn(), eliminar: vi.fn() };
  return { repository, service: new AdministrarSugerencias(repository) };
}
describe("HU-C03 administración privada de sugerencias", () => {
  it("consulta la primera página y todas las sugerencias sin filtro implícito", async () => {
    const { repository, service } = fixture();
    await expect(service.listar({})).resolves.toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
    expect(repository.listar).toHaveBeenCalledExactlyOnceWith({ page: 1, pageSize: 20, soloMeGusta: false });
  });
  it.each(["true", 1, null, undefined])("no convierte meGusta no booleano en una asignación: %s", async meGusta => {
    const { repository, service } = fixture();
    await expect(service.cambiarMeGusta(id, { meGusta })).rejects.toMatchObject({ httpStatus: 400 });
    expect(repository.cambiarMeGusta).not.toHaveBeenCalled();
  });
  it("pagina y filtra explícitamente, sin coercionar false como verdadero", async () => {
    const { repository, service } = fixture();
    await service.listar({ page: "3", pageSize: "7", soloMeGusta: "true" });
    expect(repository.listar).toHaveBeenLastCalledWith({ page: 3, pageSize: 7, soloMeGusta: true });
    await service.listar({ soloMeGusta: "false" });
    expect(repository.listar).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, soloMeGusta: false });
  });
  it.each([{ page: "0" }, { pageSize: "101" }, { page: "1.5" }, { soloMeGusta: "1" }, { soloMeGusta: true }, { autor: id }])("rechaza query inválida: %j", async query => {
    const { repository, service } = fixture();
    await expect(service.listar(query)).rejects.toMatchObject({ httpStatus: 400 });
    expect(repository.listar).not.toHaveBeenCalled();
  });
  it.each([true, false])("asigna el valor %s sin un toggle dependiente de estado", async meGusta => {
    const { repository, service } = fixture();
    await service.cambiarMeGusta(id, { meGusta });
    expect(repository.cambiarMeGusta).toHaveBeenCalledExactlyOnceWith(id, meGusta);
  });
  it.each([null, {}, { meGusta: true, usuarioId: id }])("rechaza cuerpos incompletos o campos extra: %j", async body => {
    const { repository, service } = fixture();
    await expect(service.cambiarMeGusta(id, body)).rejects.toMatchObject({ httpStatus: 400 });
    expect(repository.cambiarMeGusta).not.toHaveBeenCalled();
  });
  it.each(["invalid", "", undefined])("rechaza identificadores inválidos antes de escribir: %s", async invalid => {
    const { repository, service } = fixture();
    await expect(service.cambiarMeGusta(invalid, { meGusta: true })).rejects.toMatchObject({ httpStatus: 400 });
    await expect(service.eliminar(invalid)).rejects.toMatchObject({ httpStatus: 400 });
    expect(repository.eliminar).not.toHaveBeenCalled();
    expect(repository.cambiarMeGusta).not.toHaveBeenCalled();
  });
  it("delega una baja y propaga errores sin afirmar éxito", async () => {
    const { repository, service } = fixture(); const failure = new Error("unavailable");
    repository.eliminar.mockRejectedValueOnce(failure);
    await expect(service.eliminar(id)).rejects.toBe(failure);
    expect(repository.eliminar).toHaveBeenCalledExactlyOnceWith(id);
  });
});
