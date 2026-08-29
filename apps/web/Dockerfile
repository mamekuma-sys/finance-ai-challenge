FROM node:22-alpine

WORKDIR /app

ARG NEXT_PUBLIC_API_BASE_URL=/backend-api
ARG BACKEND_API_BASE_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV BACKEND_API_BASE_URL=${BACKEND_API_BASE_URL}

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start", "--", "-H", "0.0.0.0"]
