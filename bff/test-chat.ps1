# Test Chat - PowerShell
Write-Host "🧪 Test du chat complet" -ForegroundColor Cyan

# 1. Login
Write-Host "`n1️⃣ Login..." -ForegroundColor Yellow
$loginBody = @{
    email = "user@test.com"
    password = "user123"
} | ConvertTo-Json

$session = $null
try {
    Invoke-WebRequest -Uri "http://localhost:3001/api/auth/login" `
      -Method POST `
      -ContentType "application/json" `
      -Body $loginBody `
      -SessionVariable session `
      -ErrorAction Stop | Out-Null
    Write-Host "✅ Login OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 2. Créer conversation
Write-Host "`n2️⃣ Créer conversation..." -ForegroundColor Yellow
$convResponse = Invoke-WebRequest -Uri "http://localhost:3001/api/conversations" `
  -Method POST `
  -WebSession $session

$conv = $convResponse.Content | ConvertFrom-Json
$conversationId = $conv.id
Write-Host "✅ Conversation: $conversationId" -ForegroundColor Green

# 3. Envoyer message
Write-Host "`n3️⃣ Envoyer message au bot..." -ForegroundColor Yellow
$chatBody = @{
    conversationId = $conversationId
    message = "Bonjour, peux-tu m'aider ?"
} | ConvertTo-Json

try {
    $chatResponse = Invoke-WebRequest -Uri "http://localhost:3001/api/chat" `
      -Method POST `
      -ContentType "application/json" `
      -Body $chatBody `
      -WebSession $session `
      -ErrorAction Stop

    $chatData = $chatResponse.Content | ConvertFrom-Json
    Write-Host "✅ Réponse reçue:" -ForegroundColor Green
    Write-Host "   $($chatData.answer)" -ForegroundColor Cyan
    Write-Host "   Sources: $($chatData.chunk_ids.Count)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Chat failed: $($_.Exception.Message)" -ForegroundColor Red
    
    # Afficher détails erreur
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Détails: $responseBody" -ForegroundColor Red
    }
}

# 4. Vérifier messages en DB
Write-Host "`n4️⃣ Vérifier messages DB..." -ForegroundColor Yellow
$messagesResponse = Invoke-WebRequest -Uri "http://localhost:3001/api/messages/$conversationId" `
  -WebSession $session

$messages = $messagesResponse.Content | ConvertFrom-Json
Write-Host "✅ Messages en DB: $($messages.Count)" -ForegroundColor Green

foreach ($msg in $messages) {
    $color = if ($msg.sender_role -eq "USER") { "White" } else { "Cyan" }
    Write-Host "   [$($msg.sender_role)] $($msg.content)" -ForegroundColor $color
}

Write-Host "`n✅ Test terminé !" -ForegroundColor Green