
$lines = @(Get-Content ./peso_officer.html)
$skip = $false
$result = @()
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "^\s*<option value=\"\">All Programs</option>" -and $i -gt 0 -and $lines[$i-1] -match "filterLivelihoodProgram" -and $lines[$i+4] -match "^\s*</select>") {
        # Skip this block if it follows the new one (duplicate)
        if ($i -gt 5 -and $lines[$i-5] -match "filterLivelihoodProgram") {
            $skip = $true
        }
    }
    if ($skip -and $lines[$i] -match "^\s*</select>" -and $lines[$i-4] -match "^\s*<option value=\"\">All Programs</option>") {
        $skip = $false
        continue
    }
    if (-not $skip) {
        $result += $lines[$i]
    }
}
$result | Set-Content ./peso_officer.html

