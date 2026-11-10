# One-Command Windows Launcher for Audit-X Assistant (FastAPI + React Web Chat)
$ErrorActionPreference = "Stop"

$PyExe = "python"
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    $FallbackPy = "$env:LOCALAPPDATA\Programs\Python\Python314\python.exe"
    if (Test-Path $FallbackPy) { $PyExe = $FallbackPy }
}

Write-Host "[1/4] Verifying Audit-X ER database schema & synthetic seed..." -ForegroundColor Cyan
if (-not (Test-Path "data\auditx.db")) {
    & $PyExe data\seed_db.py
}

Write-Host "[2/4] Indexing knowledge base via Hybrid RAG (Vector + BM25)..." -ForegroundColor Cyan
& $PyExe -m rag.ingest

Write-Host "[3/4] Installing frontend packages if needed..." -ForegroundColor Cyan
if (-not (Test-Path "app\web-chat\node_modules")) {
    npm.cmd install --prefix app\web-chat
}

Write-Host "[4/4] Starting FastAPI (:8000) and React Vite Chat UI (:5173)..." -ForegroundColor Green
$BackendJob = Start-Process -FilePath $PyExe -ArgumentList "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000" -PassThru
Start-Sleep -Seconds 2
Write-Host "  Backend API : http://localhost:8000/docs" -ForegroundColor Yellow
Write-Host "  Web Chat UI : http://localhost:5173" -ForegroundColor Yellow

try {
    npm.cmd run dev --prefix app\web-chat
} finally {
    if ($BackendJob -and -not $BackendJob.HasExited) {
        Stop-Process -Id $BackendJob.Id -Force -ErrorAction SilentlyContinue
    }
}

