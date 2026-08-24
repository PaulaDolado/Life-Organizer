import { hashPassword, comparePassword } from "../../../src/utils/password";

describe("password utils", () => {
  it("debería generar un hash distinto del texto plano", async () => {
    const hash = await hashPassword("Password123");
    expect(hash).not.toBe("Password123");
    expect(hash.length).toBeGreaterThan(20);
  });

  it("debería generar hashes distintos para el mismo password (salt aleatorio)", async () => {
    const hash1 = await hashPassword("Password123");
    const hash2 = await hashPassword("Password123");
    expect(hash1).not.toBe(hash2);
  });

  it("comparePassword debería retornar true con el password correcto", async () => {
    const hash = await hashPassword("Password123");
    await expect(comparePassword("Password123", hash)).resolves.toBe(true);
  });

  it("comparePassword debería retornar false con el password incorrecto", async () => {
    const hash = await hashPassword("Password123");
    await expect(comparePassword("OtroPassword", hash)).resolves.toBe(false);
  });
});
