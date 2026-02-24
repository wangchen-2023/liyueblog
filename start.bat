@echo off
chcp 65001 >nul
echo ====================
echo 🏠 博客项目启动脚本
echo ====================
echo.
echo 🔍 检查依赖目录...
if not exist "node_modules" (
    echo ⚠️  依赖目录不存在，正在安装...
    echo.
    pnpm install
    if %errorlevel% neq 0 (
        echo ❌ 依赖安装失败，请检查网络连接和pnpm配置
        pause
        exit /b %errorlevel%
    )
    echo ✅ 依赖安装完成
    echo.
) else (
    echo ✅ 依赖目录已存在
    echo.
)
echo 🚀 启动预览服务器...
echo.
pnpm preview
if %errorlevel% neq 0 (
    echo ❌ 服务器启动失败
    pause
    exit /b %errorlevel%
)