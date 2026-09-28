# =========================
# Front-end stage: minify and obfuscate the static site
# =========================
FROM node:20-alpine AS frontend

WORKDIR /fe

COPY frontend-build/package.json frontend-build/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY frontend-build/build.mjs ./
COPY src/main/resources/static ./static
RUN node build.mjs ./static ./dist


# =========================
# Build stage
# =========================
FROM maven:3.9.6-eclipse-temurin-17 AS builder

WORKDIR /app

# Copy pom.xml first to cache dependencies
COPY pom.xml .
RUN mvn dependency:go-offline

# Copy source code, then replace the static files with the processed ones
COPY src ./src
COPY --from=frontend /fe/dist ./src/main/resources/static

# Build Spring Boot fat jar
RUN mvn clean package -DskipTests


# =========================
# Runtime stage
# =========================
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Copy the built jar from build stage
COPY --from=builder /app/target/*.jar app.jar

# Informational port (Render injects PORT)
EXPOSE 8080

# Start Spring Boot application
CMD ["java", "-jar", "app.jar"]
