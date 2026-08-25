FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 3000

# Aplica las migraciones pendientes contra la base de datos del contenedor antes de arrancar.
# `migrate deploy` (a diferencia de `migrate dev`) no pide confirmación ni genera migraciones
# nuevas — solo aplica las que ya existen en prisma/migrations, así que es seguro ejecutarlo
# en cada arranque: si ya están aplicadas, no hace nada.
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
