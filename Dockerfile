# =========================
# Build stage
# =========================
FROM maven:3.9.6-eclipse-temurin-17 AS builder

WORKDIR /app

# Copy pom.xml first to cache dependencies
COPY pom.xml .
RUN mvn dependency:go-offline

# Copy source code
COPY src ./src

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
