@echo on
@cls
@set BJ=build_jar
@set BR=src\main

@title CORS PROXY compiler
@cd /d "%~dp0app"
@rmdir /S /Q %BJ%
@mkdir %BJ%

javac --release 10 -Xlint:deprecation -g:none -d %BJ% -s %BJ%\generated\ %BR%\java_shared\cors_proxy\*.java %BR%\java_jar\cors_proxy\*.java %BR%\java_jar\android\annotation\*.java

@xcopy src\main\res_jar %BJ%\res\ /H /Y /C /R /S
@xcopy src\main\res_shared %BJ%\res\ /H /Y /C /R /S
@xcopy META-INF %BJ%\META-INF\ /H /Y /C /R /S

@jar -c --no-manifest -f ..\cors_proxy_cmd.jar -C %BJ%\ .

@rmdir /S /Q %BJ%
@echo Done.

@goto :eof