import java.security.MessageDigest
import java.util.*
plugins {
    alias(libs.plugins.android.application)
}

buildscript {
    dependencies {

    }
}

fun File.hash(algorithm: String = "SHA-256"): String {
    val digest = MessageDigest.getInstance(algorithm)
    val bytes = digest.digest(this.readBytes())
    return Base64.getEncoder().encodeToString(bytes)
}
val calculateAssetsHash = tasks.register("calculateAssetsHash") {
    val assetsDir = file("$projectDir/../shared/src/main/assets")
    outputs.upToDateWhen { false }
    doLast {
        if (assetsDir.exists() && assetsDir.isDirectory) {
            val allFiles = assetsDir.walkTopDown().filter { it.isFile }.toList()

            val combinedHash = allFiles
                .sortedBy { it.name }
                .map { it.hash() }
                .joinToString("\n") { it }

            val finalHash = MessageDigest.getInstance("SHA-256")
                .digest(combinedHash.toByteArray())
                .let { Base64.getEncoder().encodeToString(it) }

            val outputDir = File("${layout.buildDirectory.get()}/generated/assets")
            if (!outputDir.exists())
                outputDir.mkdirs()
            val file = File(outputDir, "assets.hash")
            file.writeText(finalHash)
            println("Assets Hash: $finalHash")
        }
    }
}


android {
    namespace = "mja.cors_proxy"
    compileSdk = 35

    defaultConfig {
        applicationId = "mja.cors_proxy"
        minSdk = 26
        targetSdk = 35
        versionCode = libs.versions.code.get().toInt()
        versionName = libs.versions.apk.get()
    }

    // SECURITY FIX: Removed hardcoded credentials
    // Use environment variables or gradle.properties (not committed to git)
    signingConfigs {
        create("release") {
            keyAlias = System.getenv("SIGNING_KEY_ALIAS") ?: project.findProperty("signing.key.alias") as String?
            keyPassword = System.getenv("SIGNING_KEY_PASSWORD") ?: project.findProperty("signing.key.password") as String?
            storeFile = file(System.getenv("SIGNING_KEYSTORE_FILE") ?: project.findProperty("signing.keystore.file") as String? ?: "release.keystore")
            storePassword = System.getenv("SIGNING_KEYSTORE_PASSWORD") ?: project.findProperty("signing.keystore.password") as String?
        }
    }
    sourceSets.getByName("main") {
        java.srcDir("src/main/java")
        res.srcDirs("src/main/res")

        java.srcDir("../shared/src/main/java")
        assets.srcDirs("../shared/src/main/assets")
        assets.srcDirs("${layout.buildDirectory.get()}/generated/assets")
    }
    buildTypes {
        release {
            isMinifyEnabled = true
            signingConfig = signingConfigs.getByName("release")
        }
        debug {
            isDebuggable = true
        }
    }
    buildFeatures {
        buildConfig = true
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
}

dependencies {
    implementation(fileTree("libs") { include("*.jar") })
}

tasks.whenTaskAdded {
    if (name.contains("generate")) {
        dependsOn(calculateAssetsHash)
    }
}
tasks.register("assembleReleaseBoth") {
    dependsOn("build","assembleRelease", "bundleRelease")
}