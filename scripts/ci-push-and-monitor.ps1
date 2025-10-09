param(
  [string]$Branch,
  [string]$CommitMessage,
  [string]$Tag,
  [string]$TagPrefix = 'v',
  [int]$WaitSeconds = 600,
  [int]$PollIntervalSeconds = 10
)

$ErrorActionPreference = 'Stop'

function Get-Timestamp { (Get-Date -Format 'HH:mm:ss') }
function Write-Info($msg) { $ts = Get-Timestamp; Write-Host "[INFO $ts] $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { $ts = Get-Timestamp; Write-Host "[OK   $ts] $msg" -ForegroundColor Green }
function Write-Warn($msg) { $ts = Get-Timestamp; Write-Host "[WARN $ts] $msg" -ForegroundColor Yellow }
function Write-Err($msg) { $ts = Get-Timestamp; Write-Host "[ERR  $ts] $msg" -ForegroundColor Red }

function Ensure-RepoRoot {
  $dir = $null
  try { $dir = $PSScriptRoot } catch {}
  if (-not $dir -and $MyInvocation -and $MyInvocation.MyCommand -and $MyInvocation.MyCommand.Path) {
    $dir = Split-Path -Parent $MyInvocation.MyCommand.Path
  }
  if ($dir) {
    $root = Split-Path -Parent $dir
    if ($root) { Set-Location $root }
  }
}

function Get-OwnerRepo {
  $remoteUrl = ''
  try { $remoteUrl = (& git remote get-url origin).Trim() } catch {}
  if (-not $remoteUrl) { try { $remoteUrl = (& git config --get remote.origin.url).Trim() } catch {} }
  if (-not $remoteUrl) { throw 'Failed to get remote origin URL. Configure git remote.' }
  if ($remoteUrl -match 'github\.com[:/]+([^/]+)/([^/.]+)') {
    $owner = $Matches[1]
    $repo = $Matches[2]
    return @{ owner = $owner; repo = $repo }
  }
  throw ("Failed to parse GitHub repo from remote URL: " + $remoteUrl)
}

function Get-Branch {
  if ($Branch) { return $Branch }
  $b = (& git rev-parse --abbrev-ref HEAD).Trim()
  if ($b -eq 'HEAD' -or -not $b) { return 'main' }
  return $b
}

function Has-Changes {
  $s = (& git status --porcelain)
  return [bool]$s
}

function Auto-Tag {
  param([string]$TagPrefix)
  $gradlePath = 'android/app/build.gradle'
  $versionName = '0.0.0'
  if (Test-Path $gradlePath) {
    $gradle = Get-Content $gradlePath -Raw
    $m = [regex]::Match($gradle, 'versionName\s+"([^"]+)"')
    if ($m.Success) { $versionName = $m.Groups[1].Value }
  }
  $base = ($TagPrefix + $versionName)
  $existing = & git tag --list ($base + '-ci*')
  $max = 0
  foreach ($t in $existing) {
    $m2 = [regex]::Match($t, '^'+[regex]::Escape($base)+'-ci(\d+)$')
    if ($m2.Success) { $n = [int]$m2.Groups[1].Value; if ($n -gt $max) { $max = $n } }
  }
  $next = $max + 1
  return ($base + '-ci' + $next)
}

function Get-GitHubToken {
  if ($env:GITHUB_TOKEN) { return $env:GITHUB_TOKEN }
  try {
    $cmd = Get-Command gh -ErrorAction SilentlyContinue
    if ($cmd) {
      $tok = (& gh auth token 2>$null)
      if ($tok) { return $tok.Trim() }
    }
  } catch {}
  return $null
}

function Get-Run-ByHeadSha {
  param([string]$Owner, [string]$Repo, [string]$Sha, [string]$Token)
  $headers = @{ 'Accept' = 'application/vnd.github+json' }
  if ($Token) { $headers['Authorization'] = ('Bearer ' + $Token); $headers['X-GitHub-Api-Version'] = '2022-11-28' }
  $url = ('https://api.github.com/repos/' + $Owner + '/' + $Repo + '/actions/runs?head_sha=' + $Sha + '&per_page=50')
  try {
    $resp = Invoke-RestMethod -Uri $url -Headers $headers -Method GET
    return $resp.workflow_runs
  } catch {
    Write-Warn ("Failed to fetch workflow runs: " + $_.Exception.Message)
    return $null
  }
}

function Get-RunJobs {
  param([string]$Owner, [string]$Repo, [int]$RunId, [string]$Token)
  $headers = @{ 'Accept' = 'application/vnd.github+json' }
  if ($Token) { $headers['Authorization'] = ('Bearer ' + $Token); $headers['X-GitHub-Api-Version'] = '2022-11-28' }
  $url = ('https://api.github.com/repos/' + $Owner + '/' + $Repo + '/actions/runs/' + $RunId + '/jobs?per_page=50')
  try {
    $resp = Invoke-RestMethod -Uri $url -Headers $headers -Method GET
    return $resp.jobs
  } catch {
    Write-Warn ("Failed to fetch jobs: " + $_.Exception.Message)
    return $null
  }
}

# Fallback: use gh CLI to list recent push runs and filter by head_sha
function Find-Run-Fallback {
  param([string]$Owner, [string]$Repo, [string]$Sha)
  try {
    $json = (& gh api ("repos/"+$Owner+"/"+$Repo+"/actions/runs?event=push&per_page=50") 2>$null)
    if ($json) {
      $obj = $json | ConvertFrom-Json
      $runs = $obj.workflow_runs | Where-Object { $_.head_sha -eq $Sha }
      return $runs
    }
  } catch {}
  return $null
}

function Save-SummaryJson {
  param($obj)
  $outPath = 'scripts/.ci-last-run.json'
  try {
    $json = $obj | ConvertTo-Json -Depth 6
    Set-Content -Path $outPath -Value $json -Encoding UTF8
    Write-Ok ("Saved run summary: " + $outPath)
  } catch {
    Write-Warn ("Failed to save summary: " + $_.Exception.Message)
  }
}

try {
  Ensure-RepoRoot
  $br = Get-Branch
  Write-Info ("Target branch: " + $br)

  if (Has-Changes) {
    Write-Info 'Uncommitted changes detected, preparing commit'
    & git add -A
    $msg = if ($CommitMessage) { $CommitMessage } else { 'chore(ci): trigger Android CI run' }
    & git commit -m "$msg"
    Write-Ok 'Commit done'
  } else {
    Write-Info 'No changes to commit, skipping'
  }

  Write-Info 'Pushing branch to origin'
  & git push origin $br
  Write-Ok 'Branch push done'

  $tagName = if ($Tag) { $Tag } else { Auto-Tag -TagPrefix $TagPrefix }
  Write-Info ("Using tag: " + $tagName)

  $exists = (& git tag --list $tagName)
  if ($exists) {
    Write-Warn ("Tag already exists; updating to current HEAD: " + $tagName)
    & git tag -f $tagName
  } else {
    $tagMsg = if ($CommitMessage) { $CommitMessage } else { "CI trigger $tagName" }
    & git tag -a $tagName -m $tagMsg
  }

  Write-Info 'Pushing tag to origin'
  & git push origin $tagName --force
  Write-Ok 'Tag push done (CI should be triggered)'

  $sha = (& git rev-parse "$tagName^{commit}").Trim()
  Write-Info ("Tag commit: " + $sha)

  $ownerRepo = Get-OwnerRepo
  $owner = $ownerRepo.owner
  $repo = $ownerRepo.repo
  $token = Get-GitHubToken
  if (-not $token) {
    Write-Warn 'No GITHUB_TOKEN or gh login found; will provide generic Actions URL'
  }

  $deadline = (Get-Date).AddSeconds($WaitSeconds)
  $run = $null
  while ((Get-Date) -lt $deadline) {
    $runs = Get-Run-ByHeadSha -Owner $owner -Repo $repo -Sha $sha -Token $token
    if ($runs -and $runs.Count -gt 0) {
      $run = $runs[0]
      Write-Info ("Found run: run_id=" + $run.id + ", status=" + $run.status)
      break
    }
    # Fallback with gh CLI (in case REST indexing or filter fails)
    $runsGh = Find-Run-Fallback -Owner $owner -Repo $repo -Sha $sha
    if ($runsGh -and $runsGh.Count -gt 0) {
      $run = $runsGh[0]
      Write-Info ("Found run via gh: run_id=" + $run.id + ", status=" + $run.status)
      break
    }
    Write-Info 'Run not indexed yet; waiting...'
    Start-Sleep -Seconds $PollIntervalSeconds
  }

  if (-not $run) {
    $actionsUrl = "https://github.com/$owner/$repo/actions?query=event%3Apush"
    Write-Warn ("No run indexed within " + $WaitSeconds + " seconds. See: " + $actionsUrl)
    Save-SummaryJson @{ ok = $false; reason = 'run_not_found'; actions_url = $actionsUrl; tag = $tagName; branch = $br }
    exit 0
  }

  while ($run.status -ne 'completed' -and (Get-Date) -lt $deadline) {
    Write-Info ("Status: " + $run.status + ", waiting to complete...")
    Start-Sleep -Seconds $PollIntervalSeconds
    $runs = Get-Run-ByHeadSha -Owner $owner -Repo $repo -Sha $sha -Token $token
    $run = $runs | Where-Object { $_.id -eq $run.id } | Select-Object -First 1
    if (-not $run) { break }
  }

  $jobs = $null
  if ($run -and $run.id) { $jobs = Get-RunJobs -Owner $owner -Repo $repo -RunId $run.id -Token $token }

  $summary = [ordered]@{
    ok = $true
    tag = $tagName
    branch = $br
    head_sha = $sha
    run_id = $run.id
    run_number = $run.run_number
    status = $run.status
    conclusion = $run.conclusion
    html_url = $run.html_url
    workflow_name = $run.name
    workflow_path = $run.path
    jobs = $jobs | ForEach-Object { @{ name = $_.name; status = $_.status; conclusion = $_.conclusion } }
  }

  Save-SummaryJson $summary
  if ($summary.html_url) {
    Write-Ok ("Run URL: " + $summary.html_url)
  }
  Write-Ok ("Final: " + $summary.status + " / " + $summary.conclusion)
  if ($jobs) {
    foreach ($j in $jobs) { Write-Info ("Job: " + $j.name + " => " + $j.conclusion) }
  }
}
catch {
  Write-Err $_.Exception.Message
  exit 1
}