@echo off
cd /d "%~dp0"
call npm.cmd run db:seed
