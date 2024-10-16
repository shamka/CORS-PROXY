import javassist.ClassPool
import javassist.CtClass
import java.security.MessageDigest
import java.util.Base64


fun File.hash(algorithm: String = "SHA-256"): String {
    val digest = MessageDigest.getInstance(algorithm)
    val bytes = digest.digest(this.readBytes())
    return Base64.getEncoder().encodeToString(bytes)
}
val calculateAssetsHash = tasks.register("calculateAssetsHash") {
    //dependsOn(modifyAGPClasses)
    val assetsDir = file("$projectDir/../shared/src/main/assets")
    outputs.upToDateWhen { false }
    doLast {
        if (assetsDir.exists() && assetsDir.isDirectory) {
            val allFiles = assetsDir.walkTopDown().filter { it.isFile }.toList()

            val combinedHash = allFiles
                .sortedBy { it.name }
                .map { it.hash() }
                .joinToString("") { it }

            val finalHash = MessageDigest.getInstance("SHA-256")
                .digest(combinedHash.toByteArray())
                .let { Base64.getEncoder().encodeToString(it) }

            val outputDir = File("${layout.buildDirectory.get()}/generated/assets")
            if (!outputDir.exists())
                outputDir.mkdirs()
            val file = File(outputDir, "assets.hash")
            file.writeText(finalHash)
        }
    }
}

buildscript {
    dependencies {
        classpath(libs.javassist)
    }
}

val modifyAGPClasses = tasks.register("modifyAGPClasses") {
    doLast {
        // Получаем ClassLoader Android Gradle Plugin
        val classPool = ClassPool.getDefault()

        // Добавляем ClassLoader AGP в classpath для Javassist
        classPool.appendClassPath((gradle.gradleHomeDir?.absolutePath ?: "") + "/caches")
        // Модифицируем класс IncrementalPackager
        try {
            val ctClass: CtClass = classPool.get("com.android.builder.internal.packaging.IncrementalPackager")
            if (ctClass.isFrozen) {
                ctClass.defrost()
            }

            ctClass.declaredFields.forEach {
                if(it.name!="APP_METADATA_ENTRY_PATH")return@forEach
                println(it.name)
                it.modifiers=9
                println(it.constantValue)
            }

            // Применяем изменения
            ctClass.toClass()
            ctClass.freeze()
            println("Modified IncrementalPackager")
        } catch (e: Exception) {
            println("Failed to modify IncrementalPackager: ${e.message}")
        }
    }
}

plugins {
    alias(libs.plugins.android.application)
}

android {
    namespace = "mja.cors_proxy"
    compileSdk = 35

    defaultConfig {
        applicationId = "mja.cors_proxy"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }

    signingConfigs {
        create("release") {
            keyAlias = "mja.cors_proxy"
            keyPassword = "7"
            storeFile = file("C:/Android/keys.jks")
            storePassword = "7"
        }
    }
    sourceSets.getByName("main") {
        java.srcDir("src/main/java")
        java.srcDir("../shared/src/main/java")
        res.srcDirs("src/main/res")
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
//    if (name.contains("clean")) {
//        dependsOn(modifyAGPClasses)
//    }
    if (name.contains("generate")) {
        dependsOn(calculateAssetsHash)
    }
    if(name.contains("Test"))
        tasks[name].enabled=false

//    if(name=="packageDebug"){
//        tasks[name].doFirst {
//            //print("RUN ".plus(name))
//            arrayOf("app_metadata","version_control_info_file").forEach { dd ->
//                fileTree("${layout.buildDirectory.get()}/intermediates/$dd").forEach {
//                    println("FIND FIRST ".plus(it))
//                    //it.delete()
//                }
//            }
//
//        }
//    }
}
tasks.register("assembleReleaseBoth") {
    dependsOn("build","assembleRelease", "bundleRelease")
}