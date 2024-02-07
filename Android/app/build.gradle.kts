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
    namespace = "mtm.cors_proxy"
    compileSdk = 34

    defaultConfig {
        applicationId = "mtm.cors_proxy"
        minSdk = 23
        targetSdk = 34
        versionCode = 2
        versionName = "1.0.2"

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

