@echo off
title Landfall
cd /d "%~dp0"
echo Starting Landfall...
start "" http://localhost:8796
node server.mjs
