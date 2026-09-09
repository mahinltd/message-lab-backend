@echo off
setlocal EnableDelayedExpansion
title Messages Lab Backend Setup
set PROJECT_NAME=message-lab-backend

echo ==================================================
echo Messages Lab Backend Setup
echo Root folder: %PROJECT_NAME%
echo ==================================================

if exist "%PROJECT_NAME%" (
    echo Folder "%PROJECT_NAME%" already exists. Continuing inside existing folder...
) else (
    echo Creating root folder "%PROJECT_NAME%"...
    mkdir "%PROJECT_NAME%"
)

cd /d "%PROJECT_NAME%" || exit /b 1

echo Creating folder structure...
for %%D in (
    src
    src\config
    src\routes
    src\controllers
    src\services
    src\models
    src\middleware
    src\utils
    src\types
    src\validators
    src\emails
    src\emails\templates
    src\jobs
    src\lib
    logs
) do (
    if not exist "%%D" mkdir "%%D"
)

echo Creating .gitkeep files...
for %%F in (
    src\routes\.gitkeep
    src\controllers\.gitkeep
    src\services\.gitkeep
    src\models\.gitkeep
    src\middleware\.gitkeep
    src\utils\.gitkeep
    src\types\.gitkeep
    src\validators\.gitkeep
    src\emails\.gitkeep
    src\emails\templates\.gitkeep
    src\jobs\.gitkeep
    src\lib\.gitkeep
    logs\.gitkeep
) do (
    if not exist "%%F" type nul > "%%F"
)

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js is not installed or not in PATH.
    echo Please install Node.js LTS and run this file again.
    pause
    exit /b 1
)

if not exist package.json (
    echo Initializing npm project...
    call npm init -y
    if errorlevel 1 (
        echo npm init failed.
        pause
        exit /b 1
    )
) else (
    echo package.json already exists. Skipping npm init.
)

echo Configuring package.json...
call npm pkg set "name=%PROJECT_NAME%"
call npm pkg set "version=1.0.0"
call npm pkg set "description=Messages Lab backend"
call npm pkg set "main=dist/server.js"
call npm pkg set "private=true"
call npm pkg set "license=UNLICENSED"
call npm pkg set "type=commonjs"
call npm pkg set "scripts.dev=tsx watch src/server.ts"
call npm pkg set "scripts.build=tsc"
call npm pkg set "scripts.start=node dist/server.js"
call npm pkg set "scripts.typecheck=tsc --noEmit"

echo Installing runtime dependencies...
call npm install express cors helmet morgan dotenv mongoose @upstash/redis resend cloudinary zod bcryptjs cookie-parser express-rate-limit
if errorlevel 1 (
    echo Runtime dependency installation failed.
    pause
    exit /b 1
)

echo Installing development dependencies...
call npm install -D typescript tsx @types/node @types/express @types/cors @types/morgan @types/cookie-parser @types/bcryptjs
if errorlevel 1 (
    echo Development dependency installation failed.
    pause
    exit /b 1
)

if not exist tsconfig.json call :create_tsconfig
if not exist .env.example call :create_env_example
if not exist .gitignore call :create_gitignore
if not exist README.md call :create_readme
if not exist .env copy .env.example .env >nul

if not exist src\server.ts call :create_server_ts
if not exist src\config\env.ts call :create_env_ts

echo Creating placeholder module files...
if not exist src\routes\index.ts call :create_placeholder "src\routes\index.ts" "Messages Lab API routes will be defined here."
if not exist src\controllers\index.ts call :create_placeholder "src\controllers\index.ts" "Controllers will be defined here."
if not exist src\services\index.ts call :create_placeholder "src\services\index.ts" "Business logic services will be defined here."
if not exist src\models\index.ts call :create_placeholder "src\models\index.ts" "Database models will be exported from here."
if not exist src\middleware\index.ts call :create_placeholder "src\middleware\index.ts" "Middleware modules will be exported from here."
if not exist src\utils\index.ts call :create_placeholder "src\utils\index.ts" "Utility helpers will be defined here."
if not exist src\types\index.ts call :create_placeholder "src\types\index.ts" "Shared TypeScript types will be defined here."
if not exist src\validators\index.ts call :create_placeholder "src\validators\index.ts" "Request validators will be defined here."
if not exist src\emails\index.ts call :create_placeholder "src\emails\index.ts" "Email sending helpers will be defined here."
if not exist src\emails\templates\verification.ts call :create_placeholder "src\emails\templates\verification.ts" "Account verification email template will be implemented here."
if not exist src\emails\templates\passwordReset.ts call :create_placeholder "src\emails\templates\passwordReset.ts" "Password reset email template will be implemented here."
if not exist src\emails\templates\accountUpdate.ts call :create_placeholder "src\emails\templates\accountUpdate.ts" "Account update email template will be implemented here."
if not exist src\jobs\index.ts call :create_placeholder "src\jobs\index.ts" "Background job exports will be defined here."
if not exist src\jobs\smsQueue.ts call :create_placeholder "src\jobs\smsQueue.ts" "SMS queue processing logic will be implemented here."
if not exist src\lib\mongodb.ts call :create_placeholder "src\lib\mongodb.ts" "MongoDB connection logic will be implemented here."
if not exist src\lib\redis.ts call :create_placeholder "src\lib\redis.ts" "Upstash Redis client logic will be implemented here."
if not exist src\lib\cloudinary.ts call :create_placeholder "src\lib\cloudinary.ts" "Cloudinary upload logic will be implemented here."
if not exist src\lib\resend.ts call :create_placeholder "src\lib\resend.ts" "Resend email client logic will be implemented here."
if not exist src\middleware\auth.middleware.ts call :create_placeholder "src\middleware\auth.middleware.ts" "Authentication middleware will be implemented here."
if not exist src\middleware\error.middleware.ts call :create_placeholder "src\middleware\error.middleware.ts" "Error handling middleware will be implemented here."
if not exist src\middleware\rateLimit.middleware.ts call :create_placeholder "src\middleware\rateLimit.middleware.ts" "Rate limiting middleware will be implemented here."
if not exist src\validators\auth.validator.ts call :create_placeholder "src\validators\auth.validator.ts" "Auth request validation will be implemented here."
if not exist src\validators\payment.validator.ts call :create_placeholder "src\validators\payment.validator.ts" "Payment request validation will be implemented here."
if not exist src\validators\sms.validator.ts call :create_placeholder "src\validators\sms.validator.ts" "SMS request validation will be implemented here."
if not exist src\controllers\auth.controller.ts call :create_placeholder "src\controllers\auth.controller.ts" "Auth controller will be implemented here."
if not exist src\controllers\user.controller.ts call :create_placeholder "src\controllers\user.controller.ts" "User controller will be implemented here."
if not exist src\controllers\device.controller.ts call :create_placeholder "src\controllers\device.controller.ts" "Device controller will be implemented here."
if not exist src\controllers\sms.controller.ts call :create_placeholder "src\controllers\sms.controller.ts" "SMS controller will be implemented here."
if not exist src\controllers\payment.controller.ts call :create_placeholder "src\controllers\payment.controller.ts" "Payment controller will be implemented here."
if not exist src\services\auth.service.ts call :create