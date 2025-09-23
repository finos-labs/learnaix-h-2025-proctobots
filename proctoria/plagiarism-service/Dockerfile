FROM openjdk:17-jdk-slim

# Set working directory
WORKDIR /app

# Install system dependencies and Maven
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    maven \
    && rm -rf /var/lib/apt/lists/*

# Copy pom.xml first for better caching
COPY pom.xml ./

# Download dependencies using Maven directly
RUN mvn dependency:go-offline -B

# Copy source code
COPY src ./src

# Build the application using Maven directly
RUN mvn clean package -DskipTests -B

# Create necessary directories
RUN mkdir -p /app/temp /app/reports /app/logs

# Set environment variables
ENV JAVA_OPTS="-Xmx2g -Xms512m"
ENV SPRING_PROFILES_ACTIVE=production

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/actuator/health || exit 1

# Run the application
CMD ["java", "-jar", "target/plagiarism-service-1.0.0.jar"]