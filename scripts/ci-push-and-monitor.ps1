param(
  [string]$Branch,
  [string]$CommitMessage,
  [string]$Tag,
  [string]$TagPrefix = 'v',
  [int]$WaitSeconds = 600,
  [int]$PollIntervalSeconds = 10,
  [string]$UpdateUrl,
  [switch]$SkipPush
)

$ErrorActionPreference = 'Stop'

# Define logging helpers and time formatting early (used below)
function Get-Timestamp { (Get-Date -Format 'HH:mm:ss') }
function Write-Info($msg) { $ts = Get-Timestamp; Write-Host "[INFO $ts] $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { $ts = Get-Timestamp; Write-Host "[OK   $ts] $msg" -ForegroundColor Green }
function Write-Warn($msg) { $ts = Get-Timestamp; Write-Host "[WARN $ts] $msg" -ForegroundColor Yellow }
function Write-Err($msg) { $ts = Get-Timestamp; Write-Host "[ERR  $ts] $msg" -ForegroundColor Red }

# Format elapsed time since a given start timestamp (MM:SS or HH:MM:SS)
function Get-ElapsedStr([datetime]$start) {
  try {
    $ts = New-TimeSpan -Start $start -End (Get-Date)
    $hours = [int]$ts.TotalHours
    $mins = $ts.Minutes
    $secs = $ts.Seconds
    if ($hours -gt 0) { return ("{0:D2}:{1:D2}:{2:D2}" -f $hours, $mins, $secs) }
    else { return ("{0:D2}:{1:D2}" -f $mins, $secs) }
  }
  catch { return "00:00" }
}

# Default UpdateUrl resolution (R2 base > R2 bucket > local file)
if (-not $UpdateUrl -or $UpdateUrl -eq '') {
  try {
    if ($env:R2_PUBLIC_BASE) {
      $UpdateUrl = ($env:R2_PUBLIC_BASE.TrimEnd('/') + '/releases/updates.json')
    }
    elseif ($env:R2_BUCKET) {
      $UpdateUrl = ('https://' + $env:R2_BUCKET + '.r2.dev/releases/updates.json')
    }
    else {
      # Fallback to local file path; app side has multi-source fallback logic
      $UpdateUrl = 'public/updates.json'
    }
    Write-Info ('Default UpdateUrl: ' + $UpdateUrl)
  }
  catch {
    Write-Warn ('Failed to resolve default UpdateUrl: ' + $_.Exception.Message)
  }
}

function Confirm-RepoRoot {
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

function Test-Changes {
  $s = (& git status --porcelain)
  return [bool]$s
}

function New-AutoTag {
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
    $m2 = [regex]::Match($t, '^' + [regex]::Escape($base) + '-ci(\d+)$')
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
  }
  catch {}
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
  }
  catch {
    Write-Warn ("Failed to fetch workflow runs: " + $_.Exception.Message)
    return $null
  }
}

function Get-RunJobs {
  param([string]$Owner, [string]$Repo, [long]$RunId, [string]$Token)
  $headers = @{ 'Accept' = 'application/vnd.github+json' }
  if ($Token) { $headers['Authorization'] = ('Bearer ' + $Token); $headers['X-GitHub-Api-Version'] = '2022-11-28' }
  $url = ('https://api.github.com/repos/' + $Owner + '/' + $Repo + '/actions/runs/' + $RunId + '/jobs?per_page=50')
  try {
    $resp = Invoke-RestMethod -Uri $url -Headers $headers -Method GET
    return $resp.jobs
  }
  catch {
    Write-Warn ("Failed to fetch jobs: " + $_.Exception.Message)
    return $null
  }
}

# Fallback 2: locate run by workflow name using gh workflow list -> workflow runs
function Find-Run-ByWorkflow {
  param([string]$Owner, [string]$Repo, [string]$Sha)
  try {
    $wfsJson = (& gh workflow list --json id, name 2>$null)
    if (-not $wfsJson) { return $null }
    $wfs = $wfsJson | ConvertFrom-Json
    $wf = $wfs | Where-Object { $_.name -eq 'Build Android APK' } | Select-Object -First 1
    if (-not $wf) { return $null }
    $runsJson = (& gh api ("repos/" + $Owner + "/" + $Repo + "/actions/workflows/" + $wf.id + "/runs?event=push&per_page=50") 2>$null)
    if (-not $runsJson) { return $null }
    $obj = $runsJson | ConvertFrom-Json
    $runs = $obj.workflow_runs | Where-Object { $_.head_sha -eq $Sha }
    return $runs
  }
  catch { return $null }
}

# Refresh run by id using REST to get latest status
function Get-RunById {
  param([string]$Owner, [string]$Repo, [long]$RunId, [string]$Token)
  $headers = @{ 'Accept' = 'application/vnd.github+json' }
  if ($Token) { $headers['Authorization'] = ('Bearer ' + $Token); $headers['X-GitHub-Api-Version'] = '2022-11-28' }
  $url = ('https://api.github.com/repos/' + $Owner + '/' + $Repo + '/actions/runs/' + $RunId)
  try {
    return Invoke-RestMethod -Uri $url -Headers $headers -Method GET
  }
  catch { return $null }
}

# Fallback: use gh CLI to list recent push runs and filter by head_sha
function Find-Run-Fallback {
  param([string]$Owner, [string]$Repo, [string]$Sha)
  try {
    $json = (& gh api ("repos/" + $Owner + "/" + $Repo + "/actions/runs?event=push&per_page=50") 2>$null)
    if ($json) {
      $obj = $json | ConvertFrom-Json
      $runs = $obj.workflow_runs | Where-Object { $_.head_sha -eq $Sha }
      return $runs
    }
  }
  catch {}
  return $null
}

# Fallback 3: use gh run list filtered by commit to get the run reliably
function Find-Run-ByHeadSha {
  param(
    [string]$Owner,
    [string]$Repo,
    [string]$HeadSha,
    [string]$Branch,
    [string]$WorkflowEvent = "push"
  )
  Write-Host "[DEBUG] Find-Run-ByHeadSha: Searching for sha=$HeadSha, branch=$Branch, event=$WorkflowEvent"
  $url = "https://api.github.com/repos/$Owner/$Repo/actions/runs?head_sha=$HeadSha&branch=$Branch&event=$WorkflowEvent&status=in_progress,queued,requested,waiting"
  $runs = Invoke-GhRest -Method GET -Uri $url
  if ($runs -and $runs.total_count -gt 0) {
    # Sort by created_at descending to get the latest run
    $latestRun = $runs.workflow_runs | Sort-Object -Property created_at -Descending | Select-Object -First 1
    Write-Host "[DEBUG] Find-Run-ByHeadSha: Found $($runs.total_count) runs, latest is $($latestRun.id)"
    return $latestRun
  }
  return $null
}

function Find-Run-ByGhCommit {
  param(
    [string]$CommitSha
  )
  Write-Host "[DEBUG] Find-Run-ByGhCommit: Searching for commit=$CommitSha"
  try {
    $runJson = gh run list --commit "$CommitSha" --json "databaseId,headBranch,headSha,status,conclusion,workflowName,displayTitle,url" 2>$null | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($runJson -and $runJson.Count -gt 0) {
      # Filter for "Build Android APK" workflow specifically
      $targetRun = $runJson | Where-Object { $_.workflowName -eq 'Build Android APK' } | Select-Object -First 1
      if ($targetRun) {
        Write-Host "[DEBUG] Find-Run-ByGhCommit: Found Build Android APK run $($targetRun.databaseId) via gh commit list"
        # Convert to a format compatible with REST API response
        return @{
          id         = [long]$targetRun.databaseId
          status     = $targetRun.status
          conclusion = $targetRun.conclusion
          name       = $targetRun.workflowName
          html_url   = $targetRun.url
          head_sha   = $targetRun.headSha
        }
      }
      else {
        Write-Host "[DEBUG] Find-Run-ByGhCommit: No Build Android APK workflow found for commit $CommitSha"
      }
    }
    else {
      Write-Host "[DEBUG] Find-Run-ByGhCommit: No runs found for commit $CommitSha"
    }
  }
  catch {
    Write-Host "[DEBUG] Find-Run-ByGhCommit: Error searching for commit $CommitSha - $($_.Exception.Message)"
  }
  return $null
}


# Main script execution
function Save-SummaryJson {
  param($obj)
  $outPath = 'scripts/.ci-last-run.json'
  try {
    $json = $obj | ConvertTo-Json -Depth 6
    Set-Content -Path $outPath -Value $json -Encoding UTF8
    Write-Ok ("Saved run summary: " + $outPath)
  }
  catch {
    Write-Warn ("Failed to save summary: " + $_.Exception.Message)
  }
}

# Download job logs (zip) via GitHub REST and return extracted text as a single string
function Get-JobLogsText {
  param([string]$Owner, [string]$Repo, [long]$JobId, [string]$Token)
  try {
    $headers = @{}
    if ($Token) { $headers['Authorization'] = ('Bearer ' + $Token); $headers['X-GitHub-Api-Version'] = '2022-11-28' }
    $path = ('repos/' + $Owner + '/' + $Repo + '/actions/jobs/' + $JobId + '/logs')
    $url = ('https://api.github.com/' + $path)
    # First try gh CLI which reliably returns text logs
    $txt = $null
    try {
      $txt = (& gh api $path --silent 2>$null | Out-String)
    } catch { $txt = $null }
    if (-not $txt) {
      # Fallback to REST; this endpoint returns text/plain
      $txt = Invoke-RestMethod -Uri $url -Headers $headers -Method GET
    }
    return [string]$txt
  }
  catch {
    Write-Warn ("Failed to download/parse job logs: " + $_.Exception.Message)
    return $null
  }
}

# Extract Cloudflare R2 public APK URL from logs where update-updates-json.cjs prints command line
function Get-R2Url-FromLogs {
  param([string]$LogsText)
  if (-not $LogsText) { return $null }
  # Look for: Running: node scripts/update-updates-json.cjs --apk-url https://... .apk
  $pattern = 'Running:\s+node\s+scripts/update-updates-json\.cjs\s+--apk-url\s+(https?://[^\s]+\.apk)'
  $m = [regex]::Match($LogsText, $pattern)
  if ($m.Success) { return $m.Groups[1].Value }
  # Notice annotation printed by workflow: ::notice title=R2 APK URL::<url>
  $mNotice = [regex]::Match($LogsText, '::notice\s+title=R2\s+APK\s+URL::(https?://[^\s]+\.apk)')
  if ($mNotice.Success) { return $mNotice.Groups[1].Value }
  # Explicit echo: Resolved R2 APK public URL: <url>
  $mEcho = [regex]::Match($LogsText, 'Resolved\s+R2\s+APK\s+public\s+URL:\s+(https?://[^\s]+\.apk)')
  if ($mEcho.Success) { return $mEcho.Groups[1].Value }
  # Fallback: look for mood-flow-*.apk public URL printed elsewhere
  $m2 = [regex]::Match($LogsText, '(https?://[^\s]+/releases/mood-flow-[^\s]+\.apk)')
  if ($m2.Success) { return $m2.Groups[1].Value }
  # Additional fallback: look for any R2 URL pattern
  $m3 = [regex]::Match($LogsText, '(https?://[^\s]*\.r2\.cloudflarestorage\.com/[^\s]+\.apk)')
  if ($m3.Success) { return $m3.Groups[1].Value }
  # Public dev domain pattern: https://pub-<id>.r2.dev/...
  $m4 = [regex]::Match($LogsText, '(https?://[^\s]*\.r2\.dev/[^\s]+\.apk)')
  if ($m4.Success) { return $m4.Groups[1].Value }
  # Fallback via updates.json: find resolved update URL in logs and fetch androidApkUrl
  $m5 = [regex]::Match($LogsText, 'Resolved update URL:\s+(https?://[^\s]+/updates\.json)')
  if ($m5.Success) {
    $updatesUrl = $m5.Groups[1].Value
    try {
      $resp = Invoke-RestMethod -Uri $updatesUrl -Method GET -TimeoutSec 30 -Headers @{ Accept = 'application/json' }
      if ($resp -and $resp.androidApkUrl) { return [string]$resp.androidApkUrl }
    }
    catch {}
  }
  return $null
}

try {
  Confirm-RepoRoot
  $br = Get-Branch
  Write-Info ("Target branch: " + $br)
  if (-not $SkipPush) {
    if (Test-Changes) {
      Write-Info 'Uncommitted changes detected, preparing commit'
      & git add -A
      $msg = if ($CommitMessage) { $CommitMessage } else { 'chore(ci): trigger Android CI run' }
      & git commit -m "$msg"
      Write-Ok 'Commit done'
    }
    else {
      Write-Info 'No changes to commit, skipping'
    }

    Write-Info 'Pushing branch to origin'
    & git push origin $br
    Write-Ok 'Branch push done'
  }

  $tagName = if ($Tag) { $Tag } else { New-AutoTag -TagPrefix $TagPrefix }
  Write-Info ("Using tag: " + $tagName)

  if (-not $SkipPush) {
    $exists = (& git tag --list $tagName)
    if ($exists) {
      Write-Warn ("Tag already exists; updating to current HEAD: " + $tagName)
      & git tag -f $tagName
    }
    else {
      $tagMsg = if ($CommitMessage) { $CommitMessage } else { "CI trigger $tagName" }
      & git tag -a $tagName -m $tagMsg
    }

    Write-Info 'Pushing tag to origin'
    & git push origin $tagName --force
    Write-Ok 'Tag push done (CI should be triggered)'
  }

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
  $monitorStart = Get-Date
  $run = $null
  while ((Get-Date) -lt $deadline) {
    # First try the REST API approach
    $runs = Get-Run-ByHeadSha -Owner $owner -Repo $repo -Sha $sha -Token $token
    if ($runs -and $runs.Count -gt 0) {
      # Prefer Build Android APK workflow if present
      $pref = $runs | Where-Object { $_.name -eq 'Build Android APK' }
      if ($pref -and $pref.Count -gt 0) { $run = $pref[0] } else { $run = $runs[0] }
      Write-Info ("Found run: run_id=" + $run.id + ", name=" + $run.name + ", status=" + $run.status + " (elapsed " + (Get-ElapsedStr $monitorStart) + ")")
      # If we picked a non-target workflow that already completed, keep waiting for the target one
      if ($run.name -ne 'Build Android APK') {
        $run = $null
        Start-Sleep -Seconds $PollIntervalSeconds
        continue
      }
      break
    }
    
    # Primary fallback: use gh CLI to find the specific commit run
    $runsGhCommit = Find-Run-ByGhCommit -CommitSha $sha
    if ($runsGhCommit) {
      $run = $runsGhCommit
      Write-Info ("Found run via gh commit: run_id=" + $run.id + ", name=" + $run.name + ", status=" + $run.status + " (elapsed " + (Get-ElapsedStr $monitorStart) + ")")
      # Enrich run with REST details if possible
      $restRun = Get-RunById -Owner $owner -Repo $repo -RunId ([long]$run.id) -Token $token
      if ($restRun) { 
        $run = $restRun 
        Write-Info ("Enriched run details from REST API: status=" + $run.status + ", conclusion=" + $run.conclusion)
      }
      break
    }
    
    # Secondary fallback: general REST API search
    $runsGh = Find-Run-Fallback -Owner $owner -Repo $repo -Sha $sha
    if ($runsGh -and $runsGh.Count -gt 0) {
      $run = $runsGh[0]
      Write-Info ("Found run via gh fallback: run_id=" + $run.id + ", status=" + $run.status + " (elapsed " + (Get-ElapsedStr $monitorStart) + ")")
      break
    }
    
    # Tertiary fallback: search by workflow name
    $runsWf = Find-Run-ByWorkflow -Owner $owner -Repo $repo -Sha $sha
    if ($runsWf -and $runsWf.Count -gt 0) {
      $run = $runsWf[0]
      Write-Info ("Found run via workflow: run_id=" + $run.id + ", status=" + $run.status + " (elapsed " + (Get-ElapsedStr $monitorStart) + ")")
      break
    }
    
    Write-Info ("Run not indexed yet; waiting... (elapsed " + (Get-ElapsedStr $monitorStart) + ")")
    Start-Sleep -Seconds $PollIntervalSeconds
  }

  if (-not $run) {
    $actionsUrl = "https://github.com/$owner/$repo/actions?query=event%3Apush"
    Write-Warn ("No run indexed within " + $WaitSeconds + " seconds. See: " + $actionsUrl)
    Save-SummaryJson @{ ok = $false; reason = 'run_not_found'; actions_url = $actionsUrl; tag = $tagName; branch = $br }
    exit 0
  }

  while ($run.status -ne 'completed' -and (Get-Date) -lt $deadline) {
    Write-Info ("Status: " + $run.status + ", waiting to complete... (elapsed " + (Get-ElapsedStr $monitorStart) + ")")
    Start-Sleep -Seconds $PollIntervalSeconds
    $refreshed = Get-RunById -Owner $owner -Repo $repo -RunId ([long]$run.id) -Token $token
    if ($refreshed) { $run = $refreshed }
    if (-not $run) { break }
  }

  $jobs = $null
  if ($run -and $run.id) { $jobs = Get-RunJobs -Owner $owner -Repo $repo -RunId ([long]$run.id) -Token $token }

  $summary = [ordered]@{
    ok            = $true
    tag           = $tagName
    branch        = $br
    head_sha      = $sha
    run_id        = [long]$run.id
    run_number    = $run.run_number
    status        = $run.status
    conclusion    = $run.conclusion
    html_url      = $run.html_url
    workflow_name = $run.name
    workflow_path = $run.path
    jobs          = $jobs | ForEach-Object { @{ name = $_.name; status = $_.status; conclusion = $_.conclusion } }
    release_url   = "https://github.com/$owner/$repo/releases/tag/$tagName"
    r2_apk_url    = $null
  }

  # Attempt to extract R2 public URL from job logs (build-android, publish-release), with aggregated fallback
  try {
    $r2Url = $null
    if ($jobs) {
      $candidates = @('build-android', 'publish-release')
      foreach ($jn in $candidates) {
        if ($r2Url) { break }
        $job = $jobs | Where-Object { $_.name -eq $jn } | Select-Object -First 1
        if ($job -and $job.id) {
          $logsText = Get-JobLogsText -Owner $owner -Repo $repo -JobId ([long]$job.id) -Token $token
          $r2Url = Get-R2Url-FromLogs -LogsText $logsText
        }
      }
    }
    if (-not $r2Url -and $summary.run_id) {
      # Fallback: aggregated logs for the whole run via gh CLI
      try {
        $aggLogs = (& gh run view $summary.run_id --log 2>$null | Out-String)
        $r2Url = Get-R2Url-FromLogs -LogsText $aggLogs
      } catch {}
    }
    if (-not $r2Url -and $UpdateUrl) {
      try {
        $resp = $null
        if ($UpdateUrl -match '^(https?://)') {
          $resp = Invoke-RestMethod -Uri $UpdateUrl -Method GET -TimeoutSec 30 -Headers @{ Accept = 'application/json' }
        }
        else {
          # Local file path support for updates.json
          $localPath = $UpdateUrl
          if (-not (Test-Path $localPath) -and $PSScriptRoot) {
            # Try relative to repo root
            try {
              $repoRoot = Split-Path -Parent $PSScriptRoot
              $localPath = Join-Path $repoRoot $UpdateUrl
            } catch {}
          }
          if (Test-Path $localPath) {
            $raw = Get-Content $localPath -Raw
            $resp = $raw | ConvertFrom-Json
          }
        }
        if ($resp -and $resp.androidApkUrl) { $r2Url = [string]$resp.androidApkUrl }
      } catch {}
    }
    if ($r2Url) {
      $summary.r2_apk_url = $r2Url
      Write-Ok ("Detected R2 APK URL: " + $r2Url)
    }
    else {
      Write-Warn 'R2 APK URL not found in logs; it may be unavailable or secrets not set.'
    }
  }
  catch {
    Write-Warn ("Failed to extract R2 URL from logs: " + $_.Exception.Message)
  }

  Save-SummaryJson $summary
  if ($summary.html_url) {
    Write-Ok ("Run URL: " + $summary.html_url)
  }
  if ($summary.release_url) {
    Write-Ok ("Release URL: " + $summary.release_url)
  }
  if ($summary.r2_apk_url) {
    Write-Ok ("Cloudflare R2 APK URL: " + $summary.r2_apk_url)

    # Consistency check: updates.json androidApkUrl vs detected R2 URL
    try {
      if ($UpdateUrl) {
        $updates = $null
        if ($UpdateUrl -match '^(https?://)') {
          $updates = Invoke-RestMethod -Uri $UpdateUrl -Method GET -TimeoutSec 30 -Headers @{ Accept = 'application/json' }
        }
        else {
          $path = $UpdateUrl
          if (-not (Test-Path $path) -and $PSScriptRoot) {
            try { $path = Join-Path (Split-Path -Parent $PSScriptRoot) $UpdateUrl } catch {}
          }
          if (Test-Path $path) { $updates = (Get-Content $path -Raw) | ConvertFrom-Json }
        }
        if ($updates -and $updates.androidApkUrl) {
          $apkInJson = [string]$updates.androidApkUrl
          if ($apkInJson -eq $summary.r2_apk_url) {
            Write-Ok 'updates.json androidApkUrl matches detected R2 URL'
          }
          else {
            Write-Warn 'updates.json androidApkUrl does NOT match detected R2 URL'
            Write-Info ('updates.json: ' + $apkInJson)
            Write-Info ('detected:    ' + $summary.r2_apk_url)
          }
        }
        else {
          Write-Warn 'Consistency check skipped: androidApkUrl missing or updates.json not readable'
        }
      }
    }
    catch {
      Write-Warn ('Consistency check failed: ' + $_.Exception.Message)
    }
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