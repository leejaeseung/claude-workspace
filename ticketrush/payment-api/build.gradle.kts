plugins {
    kotlin("jvm")
    kotlin("plugin.spring")
    id("org.springframework.boot")
    id("io.spring.dependency-management")
}

dependencies {
    implementation(project(":core-domain"))
    implementation(project(":event-contract"))
    implementation(project(":infra-jpa"))
    implementation(project(":infra-kafka"))
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:2.6.0")
    implementation("org.jetbrains.kotlin:kotlin-reflect")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
    implementation("io.arrow-kt:arrow-core:1.2.4")
    implementation("io.arrow-kt:arrow-fx-coroutines:1.2.4")
    implementation("io.micrometer:micrometer-registry-prometheus")
    // Resilience4j — Circuit Breaker + Retry
    // AOP 포함: 나중에 @CircuitBreaker / @Retry 어노테이션 방식으로 전환 시 build.gradle 변경 불필요
    implementation("io.github.resilience4j:resilience4j-spring-boot3:2.2.0")
    implementation("org.springframework.boot:spring-boot-starter-aop")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("io.kotest:kotest-runner-junit5:5.9.1")
    testImplementation("io.kotest:kotest-assertions-core:5.9.1")
    testImplementation("org.mockito.kotlin:mockito-kotlin:5.3.1")
    testImplementation("io.github.resilience4j:resilience4j-core:2.2.0")
}
