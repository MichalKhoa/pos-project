Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strScriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Run Himmel_POS.bat with Window Style 0 (completely hidden console window)
WshShell.Run """" & strScriptDir & "\Himmel_POS.bat""", 0, False
