# Bundle the JSON files in .\data into data.js for the static site.
# Usage: powershell -ExecutionPolicy Bypass -File build.ps1 "<updated label>"
param([string]$Updated = "")
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$utf8 = New-Object System.Text.UTF8Encoding $false
$parts = @()
foreach ($f in Get-ChildItem (Join-Path $here 'data') -Filter *.json | Sort-Object Name) {
    $text = [System.IO.File]::ReadAllText($f.FullName, $utf8).Trim()
    if ($f.BaseName -eq 'meta') { $parts += '"meta":' + $text } else { $parts += '"' + $f.BaseName + '":' + $text }
}
$label = ($Updated -replace '\\', '\\' -replace '"', '\"')
$js = "window.DATA = {" + ($parts -join ',') + ',"updated":"' + $label + '"};' + "`n" +
      "if (window.DATA.meta) { Object.assign(window.DATA, window.DATA.meta); }`n"
[System.IO.File]::WriteAllText((Join-Path $here 'data.js'), $js, $utf8)
"data.js written: $($parts.Count) files, $($js.Length) chars"
