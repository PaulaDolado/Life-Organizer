import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../../../src/utils/jwt";

describe("jwt utils", () => {
  const payload = { userId: 1, email: "test@example.com" };

  it("debería firmar y verificar un access token válido", () => {
    const token = signAccessToken(payload);
    const decoded = verifyAccessToken(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.email).toBe(payload.email);
  });

  it("debería firmar y verificar un refresh token válido", () => {
    const token = signRefreshToken(payload);
    const decoded = verifyRefreshToken(token);
    expect(decoded.userId).toBe(payload.userId);
  });

  it("verifyAccessToken debería lanzar con un token con firma inválida", () => {
    const token = signAccessToken(payload);
    const tampered = token.slice(0, -2) + "xx";
    expect(() => verifyAccessToken(tampered)).toThrow();
  });

  it("un refresh token no debería ser válido como access token (secretos distintos)", () => {
    const refreshToken = signRefreshToken(payload);
    expect(() => verifyAccessToken(refreshToken)).toThrow();
  });

  it("un access token no debería ser válido como refresh token (secretos distintos)", () => {
    const accessToken = signAccessToken(payload);
    expect(() => verifyRefreshToken(accessToken)).toThrow();
  });

  it("debería lanzar con un string que no es un JWT", () => {
    expect(() => verifyAccessToken("no-es-un-token")).toThrow();
  });
});
