param (
    [string]$company = 'FCL',
    [string]$itemFilter = 'J31010101',
    [string]$urlBase = "http://localhost:16172/FCL/ODataV4"
)

# Properly encode the company and item filter values
$encodedCompany = [uri]::EscapeDataString($company)
$encodedItemFilter = [uri]::EscapeDataString("No eq '$itemFilter'")

# Construct the full URL with the encoded filter
$url = "$urlBase/Company('$encodedCompany')/Items?\\$format=json&\\$filter=$encodedItemFilter"

# Output the URL for debugging
Write-Host "Request URL: $url"

# Perform the request with default credentials
$response = Invoke-WebRequest -Uri $url -UseDefaultCredentials -Method Get

# Output the response content
Write-Output $response.Content
