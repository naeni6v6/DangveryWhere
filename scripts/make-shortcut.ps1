# 프로젝트 루트에 실행 바로가기(.lnk) 두 개를 만듭니다.
#   - 댕브리웨어 실행.lnk      → 모바일 앱 화면 (http://localhost:5173/mobile)
#   - 댕브리웨어 웹 실행.lnk   → 웹(PC) 화면   (http://localhost:5173/web)
# 폴더를 다른 위치로 옮겨서 바로가기가 깨졌을 때 이 파일을 우클릭 → "PowerShell로 실행" 하세요.

$root = Split-Path -Parent $PSScriptRoot
$icon = Join-Path $root 'assets\logo.ico'
$shell = New-Object -ComObject WScript.Shell

$links = @(
  @{ Name = '댕브리웨어 실행.lnk';    Script = 'scripts\start.cmd';     Desc = '댕브리웨어 개발 서버를 켜고 모바일 앱 화면을 엽니다' },
  @{ Name = '댕브리웨어 웹 실행.lnk'; Script = 'scripts\start-web.cmd'; Desc = '댕브리웨어 개발 서버를 켜고 웹(PC) 화면을 엽니다' }
)

foreach ($item in $links) {
  $target = Join-Path $root $item.Script
  $link = Join-Path $root $item.Name
  $shortcut = $shell.CreateShortcut($link)
  $shortcut.TargetPath = 'cmd.exe'
  $shortcut.Arguments = '/c ""' + $target + '""'
  $shortcut.WorkingDirectory = $root
  $shortcut.IconLocation = "$icon,0"
  $shortcut.Description = $item.Desc
  $shortcut.WindowStyle = 1
  $shortcut.Save()
  Write-Host "바로가기 생성 완료: $link"
}
