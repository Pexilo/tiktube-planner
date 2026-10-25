# Équivalents Windows des outils macOS (OCR Vision, `say`, notifications), via les API WinRT.
# Lancé par shared/platform.mjs avec Windows PowerShell 5.1 (powershell.exe) : pwsh 7 ne charge pas WinRT.
#   ocr <image> [image…]                  → JSON [{ path, text, lang }]  (lang : deviné côté Node)
#   voices                                → JSON [{ name, lang }]
#   speak <voix> <vitesse> <sortie.wav> <texte.txt>
#   notify <titre> <message>
param([Parameter(Mandatory)][string]$Cmd, [Parameter(ValueFromRemainingArguments)][string[]]$Rest)
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [Text.Encoding]::UTF8

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() |
  Where-Object { $_.Name -eq "AsTask" -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } |
  Select-Object -First 1
function Await($op, [Type]$type) {
  $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
  [void]$task.Wait(-1)
  $task.Result
}

switch ($Cmd) {
  "ocr" {
    [void][Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
    [void][Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
    [void][Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
    [void][Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]
    # Moteur français s'il est installé (il lit aussi l'anglais), sinon les langues du profil.
    $fr = New-Object Windows.Globalization.Language "fr-FR"
    $engine = if ([Windows.Media.Ocr.OcrEngine]::IsLanguageSupported($fr)) { [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($fr) } else { [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }
    $out = foreach ($path in $Rest) {
      try {
        $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync((Resolve-Path $path).Path)) ([Windows.Storage.StorageFile])
        $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
        $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
        $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
        $result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
        $stream.Dispose()
        # Lignes triées de haut en bas
        $lines = $result.Lines | Sort-Object { $_.Words[0].BoundingRect.Y } | ForEach-Object { $_.Text }
        [pscustomobject]@{ path = $path; text = ($lines -join "`n"); lang = "" }
      } catch {
        [pscustomobject]@{ path = $path; text = ""; lang = "" }
      }
    }
    ConvertTo-Json -InputObject @($out) -Compress
  }
  "voices" {
    [void][Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media, ContentType = WindowsRuntime]
    $list = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | ForEach-Object { [pscustomobject]@{ name = $_.DisplayName; lang = $_.Language } }
    ConvertTo-Json -InputObject @($list) -Compress
  }
  "speak" {
    $voice, $rate, $outFile, $textFile = $Rest
    [void][Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media, ContentType = WindowsRuntime]
    [void][Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]
    $syn = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
    $v = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.DisplayName -eq $voice } | Select-Object -First 1
    if ($v) { $syn.Voice = $v }
    $syn.Options.SpeakingRate = [double]::Parse($rate, [Globalization.CultureInfo]::InvariantCulture)
    $text = [IO.File]::ReadAllText($textFile, [Text.Encoding]::UTF8)
    $speech = Await ($syn.SynthesizeTextToStreamAsync($text)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
    $reader = New-Object Windows.Storage.Streams.DataReader($speech.GetInputStreamAt(0))
    [void](Await ($reader.LoadAsync([uint32]$speech.Size)) ([uint32]))
    $bytes = New-Object byte[] ([int]$speech.Size)
    $reader.ReadBytes($bytes)
    [IO.File]::WriteAllBytes($outFile, $bytes)
  }
  "notify" {
    $title, $message = $Rest
    [void][Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
    [void][Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime]
    $esc = { param($s) [Security.SecurityElement]::Escape($s) }
    $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
    $xml.LoadXml("<toast><visual><binding template='ToastGeneric'><text>$(& $esc $title)</text><text>$(& $esc $message)</text></binding></visual></toast>")
    $appId = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe'
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId).Show((New-Object Windows.UI.Notifications.ToastNotification $xml))
  }
  default { throw "Commande inconnue : $Cmd" }
}
