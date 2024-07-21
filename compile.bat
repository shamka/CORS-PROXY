@echo on
@cls
@title CORS PROXY compiler
@cd "%~dp0"
@rmdir /S /Q build
@mkdir build

javac --release 10 -Xlint:deprecation -g:none -d build -s build\generated\ src\cors_proxy\*.java Android\app\src\main\java\cors_proxy\*.java src\android\annotation\*.java

@xcopy res build\res\ /H /Y /C /R /S

@jar cfe cors_proxy.jar cors_proxy.JarMain -C build/ .

@echo Done.
@pause
@goto :eof