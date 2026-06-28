plugins {
    kotlin("jvm") version "2.1.20"
    id("org.jetbrains.compose") version "1.8.0"
    id("org.jetbrains.kotlin.plugin.compose") version "2.1.20"
    kotlin("plugin.serialization") version "2.1.20"
}

group = "com.jasoncompany"
version = "1.0.0"

repositories {
    mavenCentral()
    google()
    maven("https://maven.pkg.jetbrains.space/public/p/compose/dev")
}

dependencies {
    // Compose Desktop
    implementation(compose.desktop.currentOs)
    implementation(compose.materialIconsExtended)

    // OpenSearch Java Client (official)
    implementation("org.opensearch.client:opensearch-java:3.8.0")
    // OpenSearch Java Client requires a transport; apache-http-client5 is the recommended one
    implementation("org.apache.httpcomponents.client5:httpclient5:5.3.1")
    // OpenSearch Java Client needs a JSON mapper for (de)serialization
    implementation("com.fasterxml.jackson.core:jackson-databind:2.17.2")
    implementation("com.fasterxml.jackson.datatype:jackson-datatype-jsr310:2.17.2")

    // Arrow-kt for functional error handling
    // NOTE: Arrow 2.2.0 was built against Kotlin 2.2. Pin to 2.1.0 for Kotlin 2.1.20 compatibility.
    implementation("io.arrow-kt:arrow-core:2.1.0")

    // kotlinx.serialization for JSON (ConnectionProfile persistence)
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.0")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.10.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-swing:1.10.1")

    // SLF4J + Logback (OpenSearch client requires it)
    implementation("ch.qos.logback:logback-classic:1.5.13")
}

compose.desktop {
    application {
        mainClass = "com.jasoncompany.opensearchclient.MainKt"

        // Korean (CJK) IME on Linux/WSL2 note:
        // Compose Desktop does not have a single JVM system property to enable Korean input.
        // The correct approach is to configure the OS-level input method (IBus or Fcitx5)
        // and export the required environment variables before launching the app:
        //
        //   export GTK_IM_MODULE=ibus   (or fcitx)
        //   export QT_IM_MODULE=ibus
        //   export XMODIFIERS=@im=ibus
        //
        // For WSL2, install ibus-hangul:  sudo apt install ibus ibus-hangul
        // then run:  ibus-daemon -drx
        //
        // No jvmArgs are needed; the fix lives at the OS/shell level.

        nativeDistributions {
            // Produce a distributable folder via: ./gradlew createDistributable
            // Output: build/compose/binaries/main/app/
            // The folder contains <AppName>.exe + bundled JRE — no installer required.
            // targetFormats is intentionally omitted here; createDistributable runs regardless.
            packageName = "OpenSearch Client"
            packageVersion = "1.0.0"
            description = "Jason Company OpenSearch Query Client"
            vendor = "Jason Company"

            windows {
                // No msi/exe installer — distributable folder contains the .exe launcher directly
                dirChooser = false
                perUserInstall = false
                upgradeUuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
            }
        }
    }
}

kotlin {
    jvmToolchain(21)
    compilerOptions {
        freeCompilerArgs.add("-Xcontext-receivers")
    }
}
