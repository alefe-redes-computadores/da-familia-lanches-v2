# DFL SITE V85.1 R5 - Diagnostico leitura apenas, Windows 10/11
# Execute via PowerShell no notebook com a impressora USB conectada.
# NAO instala drivers, NAO imprime, NAO altera portas ou configuracoes.
$ErrorActionPreference = 'Continue'
Write-Output '=== DFL - IMPRESSORA TERMICA USB / DIAGNOSTICO ==='
Write-Output 'Sistema operacional:'
try { (Get-CimInstance Win32_OperatingSystem | Select-Object -First 1 Caption, Version, OSArchitecture) | Format-List | Out-String | Write-Output } catch { Write-Output ('Sistema: ' + $_.Exception.Message) }
Write-Output '--- Impressoras instaladas ---'
try {
  $printers = @(Get-CimInstance Win32_Printer)
  if ($printers.Count -eq 0) { Write-Output 'Nenhuma impressora encontrada no Windows.' }
  else { $printers | Select-Object Name, DriverName, PortName, WorkOffline, Default, Shared | Format-Table -AutoSize | Out-String -Width 200 | Write-Output }
} catch { Write-Output ('Impressoras: ' + $_.Exception.Message) }
Write-Output '--- Dispositivos USB / fila de impressao ---'
try {
  $usb = @(Get-CimInstance Win32_PnPEntity | Where-Object { $_.PNPDeviceID -match '^(USBPRINT|USB\\VID_)' -or ($_.Name -match '(?i)thermal|receipt|pos.?58|esc.?pos|printer|impressora') })
  if ($usb.Count -eq 0) { Write-Output 'Sem USBPRINT identificado; verifique cabo USB e driver.' }
  else { $usb | Select-Object -First 25 Name, PNPDeviceID, Status | Format-Table -Wrap | Out-String -Width 200 | Write-Output }
} catch { Write-Output ('USB: ' + $_.Exception.Message) }
Write-Output '--- Proximas verificacoes ---'
Write-Output '1. Bobina: confirme largura nominal 58 mm ou 80 mm.'
Write-Output '2. No Windows: Dispositivos e Impressoras > Preferencias de impressao > Papel/Recibo.'
Write-Output '3. No DFL Admin (depois de publicar R4/R5): abra ticket > Conferir largura > Imprimir SOMENTE teste curto.'
Write-Output '4. Se cortar uma borda, confira tamanho da midia, escala 100%, margens e driver.'
Write-Output '5. Nao ative impressao automatica nem comando de guilhotina ainda.'
Write-Output '=== FIM / NENHUMA ALTERACAO ==='
