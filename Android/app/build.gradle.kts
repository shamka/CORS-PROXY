plugins {
    id("com.android.application")
}

android {
    signingConfigs {
        create("release") {
            storeFile = file("C:\\Android\\keys.jks")
            storePassword = "7"
            keyAlias = "release"
            keyPassword = "7"
        }
    }
    namespace = "mja.cors_proxy"
    compileSdk = 35

    defaultConfig {
        applicationId = "mja.cors_proxy"
        minSdk = 26
        targetSdk = 35
        versionCode = 4
        versionName = "1.1.2"

    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.getByName("release")
        }
        debug {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
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

