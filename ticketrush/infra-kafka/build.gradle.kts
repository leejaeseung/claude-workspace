plugins {
    kotlin("jvm")
    kotlin("plugin.spring")
}

dependencies {
    implementation(project(":event-contract"))
    implementation("org.springframework.kafka:spring-kafka:3.3.1")
    implementation("org.jetbrains.kotlin:kotlin-reflect")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin:2.18.2")
    // Consumer lag 메트릭 노출용 (MicrometerConsumerListener)
    compileOnly("io.micrometer:micrometer-core")
}
