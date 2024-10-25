@echo off
cls
title Build Apk and Jar
cd /d "%~dp0"
rmdir /s /q git
mkdir git
echo build apk...
call gradlew.bat :app:clean
call gradlew.bat :app:assembleReleaseBoth
copy app\build\outputs\apk\release\app-release.apk git\
copy app\build\outputs\bundle\release\app-release.aab git\
echo.
echo.
echo build jar...
cd desktop
call gradlew.bat :clean
call gradlew.bat :customJar
cd ../
copy desktop\build\libs\app-release.jar git\
echo DONE.
pause
got :eof