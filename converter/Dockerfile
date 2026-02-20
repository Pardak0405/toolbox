FROM node:20-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
  libreoffice \
  libreoffice-impress \
  fonts-noto-cjk \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY . .

ENV NODE_ENV=production
EXPOSE 8080
CMD ["npm", "start"]
