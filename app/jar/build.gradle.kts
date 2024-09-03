plugins {
    id("java")
}

group = "mja.cors_proxy"
version = "1.0-SNAPSHOT"

sourceSets.getByName("main") {
    java.srcDir("../src/main/java_jar")
    java.srcDir("../src/main/java_shared")
    resources.srcDirs("../src/main/assets")
}

repositories {
    mavenCentral()
}

tasks.build{

}