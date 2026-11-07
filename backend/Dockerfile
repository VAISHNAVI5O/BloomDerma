# Stage 1: build the jar with Maven. Stage 2: run it on a slim JRE.
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q dependency:go-offline
COPY src ./src
RUN mvn -q clean package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/bloomderma-api-1.0.0.jar app.jar
EXPOSE 8080
# The clinic works in India time: the video-call day check and 1-hour join window use the server clock.
ENV TZ=Asia/Kolkata
ENTRYPOINT ["java", "-Duser.timezone=Asia/Kolkata", "-jar", "app.jar"]
