FROM mcr.microsoft.com/playwright:v1.47.1-jammy
WORKDIR /app
RUN mkdir -p /app && yarn add @playwright/test dockerode dockerode-compose