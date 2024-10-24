@echo off
cls
title Build Apk and Jar
cd /d "%~dp0"
echo build apk...
call gradlew.bat :app:clean
call gradlew.bat :app:assembleReleaseBoth
echo build jar...
cd desktop
call gradlew.bat :clean
call gradlew.bat :customJar
cd ../
echo copy files
rmdir /s /q git
mkdir git
copy app\build\outputs\apk\release\app-release.apk git\
copy app\build\outputs\bundle\release\app-release.aab git\
copy desktop\build\libs\app-release.jar git\
echo DONE.
pause
got :eof