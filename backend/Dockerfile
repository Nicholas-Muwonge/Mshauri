FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Cloud Run injects PORT automatically; default to 8080 for local runs.
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
