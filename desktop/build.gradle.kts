import java.security.MessageDigest
import java.util.*

plugins {
    java
    application
}
group = "mja.cors_proxy"
version = "2.5.0"
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

            val outputDir = File("${layout.buildDirectory.get()}/resources/main/assets/")
            if (!outputDir.exists())
                outputDir.mkdirs()
            val file = File(outputDir, "assets.hash")
            file.writeText(finalHash)
            println("Assets Hash: $finalHash")
        }
    }
}

application {
    mainClass.set("mja.cors_proxy.App")
}

sourceSets.getByName("main") {
    java.srcDir("src/main/java")
    java.srcDir("../shared/src/main/java")
    resources.srcDirs("${layout.buildDirectory.get()}/generated/assets")
}

tasks.register<Jar>("customJar") {
    archiveFileName.set("app-release.jar")
    from(sourceSets.main.get().output)
    dependsOn(configurations.runtimeClasspath)

    from({
        configurations.runtimeClasspath.get().filter { it.name.endsWith("jar") }.map { zipTree(it) }
    })

    manifest {
        attributes["Main-Class"] = "mja.cors_proxy.App"
    }
}
tasks.named<ProcessResources>("processResources") {
    dependsOn(calculateAssetsHash)
    from("../shared/src/main/assets") {
        into("assets")
    }
}