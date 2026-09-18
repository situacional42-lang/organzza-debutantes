FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4173 ORGANZZA_DATA_DIR=/app/data
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY *.html *.css *.js *.mjs ./
COPY assets ./assets
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 4173
CMD ["node", "server.mjs"]
