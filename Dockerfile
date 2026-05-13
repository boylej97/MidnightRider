FROM eclipse-temurin:21-jdk-jammy AS build
WORKDIR /app
COPY Server.java .
RUN javac Server.java

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
COPY --from=build /app/*.class ./
COPY web ./web
EXPOSE 8080
CMD ["java", "Server"]
