@echo off
rem Lance le studio au demarrage de Windows (fenetre reduite, journal dans data\studio.log).
rem Installation : Win+R, shell:startup, puis cree un raccourci vers ce fichier dans le dossier qui s'ouvre.
setlocal
cd /d "%~dp0.."

rem Deja lance (port 4321 occupe) : rien a faire.
netstat -ano | findstr /r /c:":4321 .*LISTENING" >nul && exit /b 0

if not exist data mkdir data
start "Studio" /min cmd /c "npm start >> data\studio.log 2>&1"
