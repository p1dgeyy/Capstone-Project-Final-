# PowerShell Script to Flatten Repository Structure
# Run this script from INSIDE the Capstone-Project-Final--main folder.

Write-Host "Starting repository flattening process..." -ForegroundColor Cyan

$currentDir = Get-Item .
$parentDir = $currentDir.Parent

if ($null -eq $parentDir) {
    Write-Error "Could not find parent directory. Make sure this script is inside the Capstone-Project-Final--main folder."
    exit
}

Write-Host "Current Directory: $($currentDir.FullName)"
Write-Host "Target Parent Directory: $($parentDir.FullName)"

# Get all items in current directory except the script itself
$items = Get-ChildItem -Path . -Exclude "flatten.ps1"

foreach ($item in $items) {
    $destination = Join-Path $parentDir.FullName $item.Name
    Write-Host "Moving '$($item.Name)' to Target..." -ForegroundColor Yellow
    if (Test-Path $destination) {
        Move-Item -Path $item.FullName -Destination $destination -Force -Recurse
    } else {
        Move-Item -Path $item.FullName -Destination $destination -Force
    }
}

Write-Host "Files moved successfully!" -ForegroundColor Green
Write-Host "To complete cleanup, please run the following commands in the root of your repository:" -ForegroundColor Cyan
Write-Host "1. Remove-Item -Path '$($currentDir.Name)' -Force -Recurse" -ForegroundColor White
Write-Host "2. git add ." -ForegroundColor White
Write-Host "3. git commit -m 'flat: Move project files to repository root'" -ForegroundColor White
Write-Host "4. git push origin main" -ForegroundColor White
