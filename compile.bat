@echo off
cls
title CORS PROXY compiler
cd "%~dp0"
@rmdir /S /Q build
@mkdir build
echo javac -target 8 -g:none -d build -s src\ src\cors_proxy\Main.java
javac -target 8 -g:none -d build -s src\ src\cors_proxy\Main.java
xcopy res build\res\ /S
echo jar cfe cors_proxy.jar cors_proxy.Main -C build/ .
jar cfe cors_proxy.jar cors_proxy.Main -C build/ .
echo Done.
