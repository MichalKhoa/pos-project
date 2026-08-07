Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

strScriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Path to pythonw.exe in virtual environment or system PATH
strPythonw = strScriptDir & "\backend\venv\Scripts\pythonw.exe"
If Not fso.FileExists(strPythonw) Then
    strPythonw = "pythonw.exe"
End If

strTarget = strScriptDir & "\backend\settings_gui.py"

' Run pythonw silently (0 = hidden window, False = don't block)
WshShell.Run """" & strPythonw & """ """ & strTarget & """", 0, False
