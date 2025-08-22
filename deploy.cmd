@echo off
setlocal ENABLEDELAYEDEXPANSION

REM ====== Valida mensagem ======
set "MSG=%~1"
if "%MSG%"=="" set "MSG=Auto-commit via VS Code Task"

echo ------------------------------------
echo Commit: %MSG%
echo ------------------------------------

REM ====== Garante que estamos na main ======
git rev-parse --abbrev-ref HEAD > _branch.tmp
set /p BRANCH=< _branch.tmp
del _branch.tmp >nul 2>&1
if /I not "%BRANCH%"=="main" (
  echo [INFO] Mudando para 'main'...
  git checkout main
)

REM ====== Add / Commit / Pull --rebase / Push ======
git add -A
git commit -m "%MSG%" || echo [INFO] Nada para commitar.

git remote -v 1>nul 2>nul || (
  echo [ERRO] Sem remoto configurado. Ajuste o origin no Git.
  exit /b 1
)

git pull --rebase origin main || (
  echo [ERRO] Falha no pull --rebase. Resolva conflitos e rode novamente.
  exit /b 1
)

git push -u origin main || (
  echo [ERRO] Falha no push.
  exit /b 1
)

echo [OK] Deploy concluido!
endlocal
