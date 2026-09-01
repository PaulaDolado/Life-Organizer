import swaggerJsdoc from "swagger-jsdoc";
import { env } from "./environment";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Tidely API",
      version: "1.0.0",
      description:
        "API REST de organización personal: Agenda, Metas, Finanzas, Proyectos y Galería.",
    },
    servers: [{ url: `http://localhost:${env.port}`, description: "Local" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./src/routes/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
