plugins {
    kotlin("jvm")
    kotlin("plugin.spring")
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-data-redis:3.4.1")
    implementation("io.lettuce:lettuce-core:6.5.1.RELEASE")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.9.0")
    implementation("org.jetbrains.kotlin:kotlin-reflect")
}
