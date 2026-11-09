# Tiny local web server for previewing the site: http://localhost:8765/
# POST /save/<league|teams>/<name>.json writes that file into .\data (local use only).
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://localhost:8765/')
$listener.Start()
Write-Output 'Serving on http://localhost:8765/'
$types = @{ '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.json' = 'application/json; charset=utf-8'; '.css' = 'text/css; charset=utf-8' }
$utf8 = New-Object System.Text.UTF8Encoding $false
while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request; $res = $ctx.Response
    $res.Headers.Add('Access-Control-Allow-Origin', '*')
    $res.Headers.Add('Access-Control-Allow-Private-Network', 'true')
    $res.Headers.Add('Access-Control-Allow-Headers', 'Content-Type')
    $path = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath.TrimStart('/'))
    if ($req.HttpMethod -eq 'OPTIONS') { $res.StatusCode = 204; $res.Close(); continue }
    if ($req.HttpMethod -eq 'POST') {
        if ($path -match '^save/(league|teams)/([a-z0-9-]+)\.json$') {
            $reader = New-Object System.IO.StreamReader($req.InputStream, $utf8)
            $body = $reader.ReadToEnd(); $reader.Close()
            $dir = Join-Path (Join-Path $root 'data') $Matches[1]
            if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
            [System.IO.File]::WriteAllText((Join-Path $dir ($Matches[2] + '.json')), $body, $utf8)
            $msg = [System.Text.Encoding]::UTF8.GetBytes('saved'); $res.OutputStream.Write($msg, 0, $msg.Length)
        } else { $res.StatusCode = 400 }
        $res.Close(); continue
    }
    if ($path -eq '') { $path = 'index.html' }
    $file = Join-Path $root $path
    if ((Test-Path $file -PathType Leaf) -and ([System.IO.Path]::GetFullPath($file)).StartsWith($root)) {
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $ext = [System.IO.Path]::GetExtension($file)
        $res.ContentType = $(if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' })
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else { $res.StatusCode = 404 }
    $res.Close()
}
