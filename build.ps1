# Bundle .\data\league\*.json and .\data\teams\*.json into data.js for the static site.
# Usage: powershell -ExecutionPolicy Bypass -File build.ps1 "<updated label>"
param([string]$Updated = "")
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$utf8 = New-Object System.Text.UTF8Encoding $false
function Read-Group([string]$folder) {
    $parts = @()
    foreach ($f in Get-ChildItem (Join-Path $here "data\$folder") -Filter *.json | Sort-Object Name) {
        $parts += '"' + $f.BaseName + '":' + [System.IO.File]::ReadAllText($f.FullName, $utf8).Trim()
    }
    return '{' + ($parts -join ',') + '}'
}
$label = ($Updated -replace '\\', '\\' -replace '"', '\"')
$js = 'window.DATA = {"league":' + (Read-Group 'league') + ',"teams":' + (Read-Group 'teams') + ',"updated":"' + $label + '"};' + "`n"
[System.IO.File]::WriteAllText((Join-Path $here 'data.js'), $js, $utf8)
"data.js written: $($js.Length) chars"
