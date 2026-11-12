@echo off
rem Global Map launcher (Windows). Opens index.html in launch mode: ENGAGE screen, sound on, full screen, guided tour.
rem Uses Chrome or Edge with --start-maximized if installed, otherwise the default browser.
rem --allow-file-access-from-files lets the page load its data files from disk (file://).
setlocal
set "HERE=%~dp0"
set "PAGE=%HERE%index.html"
set "URL=file:///%PAGE:\=/%?tour=intro&audio=on&fullscreen=1"
set "FLAGS=--start-maximized --allow-file-access-from-files --autoplay-policy=no-user-gesture-required"

for %%B in (
  "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
  "%LocalAppData%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
  "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
) do (
  if exist %%B (
    start "" %%B %FLAGS% --new-window "%URL%"
    goto :eof
  )
)

rem Fallback: default browser (URL parameters may be dropped by some browsers when opening file:// links)
start "" "%URL%"
endlocal
