import { spawn } from "node:child_process";

const windowsScript = [
  "Add-Type -AssemblyName System.Windows.Forms",
  "[System.Windows.Forms.Application]::EnableVisualStyles() | Out-Null",
  "$owner = New-Object System.Windows.Forms.Form",
  "$owner.TopMost = $true",
  "$owner.ShowInTaskbar = $false",
  "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
  "$dialog.Description = 'Choose the project folder'",
  "$dialog.ShowNewFolderButton = $false",
  "$result = $dialog.ShowDialog($owner)",
  "if ($result -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.SelectedPath }",
  "$owner.Dispose()",
].join("; ");

export function pickFolder(): Promise<string | null> {
  if (process.platform !== "win32") {
    return Promise.reject(
      new Error("The folder picker is not available on this system. Type the path."),
    );
  }

  return new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      ["-STA", "-NoProfile", "-Command", windowsScript],
      { windowsHide: true },
    );
    let output = "";
    let errorOutput = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      errorOutput += chunk;
    });
    child.on("error", () => {
      reject(new Error("Couldn't open the folder picker."));
    });
    child.on("close", (code) => {
      const path = output.trim();
      if (path) {
        resolve(path);
        return;
      }
      if (code !== 0) {
        reject(new Error(errorOutput.trim() || "Couldn't open the folder picker."));
        return;
      }
      resolve(null);
    });
  });
}
