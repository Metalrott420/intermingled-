$ErrorActionPreference = "Stop"

$start = Get-Date
Write-Host "[ship] Starting ship readiness gate..."

if (-not $env:PORT) {
	$env:PORT = "4173"
}

if (-not $env:BASE_PATH) {
	$env:BASE_PATH = "/"
}

pnpm --filter @workspace/api-spec run codegen
pnpm run typecheck
pnpm --filter @workspace/api-server run test:critical
pnpm --filter @workspace/api-server run test:integration
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/speed-date run build

$elapsed = (Get-Date) - $start
Write-Host "[ship] Ship readiness gate passed in $($elapsed.ToString())"
