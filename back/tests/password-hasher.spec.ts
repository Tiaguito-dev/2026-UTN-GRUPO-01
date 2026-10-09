import { describe, expect, it } from "vitest";
import { Argon2PasswordHasher } from "../src/auth/infrastructure/argon2-password-hasher.js";

describe("Argon2PasswordHasher", () => {
  it("genera Argon2id con la política definida y conserva espacios de la contraseña", async () => {
    const hasher = new Argon2PasswordHasher();
    const password = " contraseña larga con espacios ";
    const first = await hasher.hash(password);
    const second = await hasher.hash(password);
    const [, algorithm, version, parameters, salt, digest] = first.split("$");
    expect(algorithm).toBe("argon2id");
    expect(version).toBe("v=19");
    expect(parameters.split(",").sort()).toEqual(["m=19456", "p=1", "t=2"]);
    expect(Buffer.from(salt, "base64").length).toBeGreaterThanOrEqual(16);
    expect(Buffer.from(digest, "base64").length).toBe(32);
    expect(first).not.toEqual(second);
    expect(first).not.toContain(password);
    await expect(hasher.verify(first, password)).resolves.toBe(true);
    await expect(hasher.verify(first, password.trim())).resolves.toBe(false);
    await expect(hasher.verify(first, "Una contraseña diferente")).resolves.toBe(false);
  });
});
