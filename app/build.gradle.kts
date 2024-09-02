plugins {
    alias(libs.plugins.android.application)
}

android {
    namespace = "mja.cors_proxy"
    compileSdk = 34

    sourceSets.getByName("main") {
        java.srcDir("src/main/java")
        java.srcDir("src/main/java_shared")
        res.srcDirs("src/main/res")
        res.srcDirs("src/main/res_shared")
    }

    defaultConfig {
        applicationId = "mja.cors_proxy"
        minSdk = 26
        targetSdk = 34
        versionCode = 4
        versionName = "1.6"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
}
dependencies {
    implementation(fileTree("libs") { include("*.jar") })
}