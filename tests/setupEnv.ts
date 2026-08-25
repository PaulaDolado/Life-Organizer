import dotenv from "dotenv";
import path from "path";

// Se ejecuta antes de cargar cualquier módulo de la app (ver jest.config.js `setupFiles`).
// Carga .env.test explícitamente en vez de dejar que cada módulo llame a su propio
// `dotenv.config()` (que por defecto lee `.env` — la base de datos de desarrollo real).
// dotenv no sobreescribe variables ya presentes en process.env, así que esto "gana" frente
// al dotenv.config() que hace src/config/environment.ts al importarse.
dotenv.config({ path: path.resolve(__dirname, "../.env.test") });

// Red de seguridad: los tests de integración hacen `deleteMany` sin piedad (ver beforeEach en
// tests/integration/*.test.ts). Si por lo que sea DATABASE_URL no apunta a una base de datos
// de test, es preferible reventar aquí a borrar datos reales otra vez.
if (!/test/i.test(process.env.DATABASE_URL ?? "")) {
  throw new Error(
    `DATABASE_URL no parece una base de datos de test ("${process.env.DATABASE_URL}"). ` +
      "Abortando para no borrar datos reales — revisa .env.test."
  );
}
