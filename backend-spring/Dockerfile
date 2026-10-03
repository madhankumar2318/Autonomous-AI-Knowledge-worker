# ── Stage 1: Build JAR with Maven & OpenJDK 17 ──
FROM maven:3.9.6-eclipse-temurin-17-alpine AS build
WORKDIR /app

# Cache Maven dependencies
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy source and package jar
COPY src ./src
RUN mvn clean package -DskipTests

# ── Stage 2: Minimal Production JRE Runtime ──
FROM eclipse-temurin:17-jre-alpine

# Security: Create non-root system group and user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Ensure uploads and app directories exist with correct permissions
RUN mkdir -p /app/uploads && chown -R appuser:appgroup /app

# Copy the built jar with appuser ownership
COPY --from=build --chown=appuser:appgroup /app/target/*.jar app.jar

# Switch to non-root user
USER appuser

# Set dynamic port (Render sets $PORT dynamically)
ENV PORT=8080
EXPOSE 8080

# Run Spring Boot with container-aware memory limits (optimized for Render 512MB free tier)
ENTRYPOINT ["sh", "-c", "java -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -jar app.jar --server.port=${PORT}"]
