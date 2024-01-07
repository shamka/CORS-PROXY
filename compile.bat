@echo off
cls
title CORS PROXY compiler
cd "%~dp0"
@rmdir /S /Q build
@mkdir build
echo javac --release 8 -g:none -d build -s src\ src\cors_proxy\*.java
javac --release 8 -g:none -d build -s src\ src\cors_proxy\*.java
xcopy res build\res\ /S
echo jar cfe cors_proxy.jar cors_proxy.Main -C build/ .
jar cfe cors_proxy.jar cors_proxy.JarMain -C build/ .
echo Done.
