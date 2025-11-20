# PowerShell completion for fxd command
# Install: Add to your PowerShell profile ($PROFILE):
# . path\to\fxd.ps1

# Register argument completer for fxd command
Register-ArgumentCompleter -CommandName fxd -ScriptBlock {
    param($commandName, $wordToComplete, $commandAst, $fakeBoundParameters)

    $commands = @(
        [PSCustomObject]@{ Name = 'help'; Description = 'Show help information' }
        [PSCustomObject]@{ Name = 'version'; Description = 'Show FXD version' }
        [PSCustomObject]@{ Name = 'health'; Description = 'Check FXD system health' }
        [PSCustomObject]@{ Name = 'save'; Description = 'Save current state to .fxd file' }
        [PSCustomObject]@{ Name = 'load'; Description = 'Load state from .fxd file' }
        [PSCustomObject]@{ Name = 'import'; Description = 'Import files or directories' }
        [PSCustomObject]@{ Name = 'export'; Description = 'Export state to files' }
        [PSCustomObject]@{ Name = 'stats'; Description = 'Show statistics about FXD file' }
        [PSCustomObject]@{ Name = 'list'; Description = 'List .fxd files in current directory' }
        [PSCustomObject]@{ Name = 'create'; Description = 'Create new FXD project' }
        [PSCustomObject]@{ Name = 'mount'; Description = 'Mount FXD disk as virtual drive' }
        [PSCustomObject]@{ Name = 'unmount'; Description = 'Unmount virtual drive' }
    )

    # Get all words in the command line
    $words = $commandAst.ToString() -split '\s+' | Where-Object { $_ -ne '' }
    $wordCount = $words.Count

    # If we're completing the first argument (command)
    if ($wordCount -le 2) {
        $commands | Where-Object { $_.Name -like "$wordToComplete*" } | ForEach-Object {
            [System.Management.Automation.CompletionResult]::new(
                $_.Name,
                $_.Name,
                'ParameterValue',
                $_.Description
            )
        }
        return
    }

    # Get the command (first argument)
    $command = $words[1]

    # Complete based on the command
    switch ($command) {
        'save' {
            # Complete .fxd files for save command
            Get-ChildItem -Filter "*.fxd" -File | Where-Object { $_.Name -like "$wordToComplete*" } | ForEach-Object {
                [System.Management.Automation.CompletionResult]::new(
                    $_.Name,
                    $_.Name,
                    'ParameterValue',
                    "Save to $($_.Name)"
                )
            }
            # Also suggest creating new file
            if ($wordToComplete) {
                [System.Management.Automation.CompletionResult]::new(
                    "$wordToComplete.fxd",
                    "$wordToComplete.fxd",
                    'ParameterValue',
                    "Create new file"
                )
            }
        }
        'load' {
            # Complete existing .fxd files
            Get-ChildItem -Filter "*.fxd" -File | Where-Object { $_.Name -like "$wordToComplete*" } | ForEach-Object {
                [System.Management.Automation.CompletionResult]::new(
                    $_.Name,
                    $_.Name,
                    'ParameterValue',
                    "Load $($_.Name)"
                )
            }
        }
        'stats' {
            # Complete existing .fxd files
            Get-ChildItem -Filter "*.fxd" -File | Where-Object { $_.Name -like "$wordToComplete*" } | ForEach-Object {
                [System.Management.Automation.CompletionResult]::new(
                    $_.Name,
                    $_.Name,
                    'ParameterValue',
                    "Show stats for $($_.Name)"
                )
            }
        }
        'import' {
            # Check if previous word is a flag
            $prevWord = if ($wordCount -gt 2) { $words[$wordCount - 2] } else { '' }

            if ($prevWord -eq '--save') {
                # Complete .fxd files after --save
                Get-ChildItem -Filter "*.fxd" -File | Where-Object { $_.Name -like "$wordToComplete*" } | ForEach-Object {
                    [System.Management.Automation.CompletionResult]::new(
                        $_.Name,
                        $_.Name,
                        'ParameterValue',
                        "Save to $($_.Name)"
                    )
                }
            } elseif ($wordToComplete -like '--*') {
                # Complete flags
                @(
                    [PSCustomObject]@{ Name = '--save'; Description = 'Save imported data to file' }
                    [PSCustomObject]@{ Name = '--format'; Description = 'Import format' }
                ) | Where-Object { $_.Name -like "$wordToComplete*" } | ForEach-Object {
                    [System.Management.Automation.CompletionResult]::new(
                        $_.Name,
                        $_.Name,
                        'ParameterValue',
                        $_.Description
                    )
                }
            } else {
                # Complete files and directories
                Get-ChildItem | Where-Object { $_.Name -like "$wordToComplete*" } | ForEach-Object {
                    [System.Management.Automation.CompletionResult]::new(
                        $_.Name,
                        $_.Name,
                        'ParameterValue',
                        "Import $($_.Name)"
                    )
                }
            }
        }
        'export' {
            # Check if previous word is a flag
            $prevWord = if ($wordCount -gt 2) { $words[$wordCount - 2] } else { '' }

            if ($prevWord -eq '--format') {
                # Complete format options
                @('json', 'files', 'html') | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                    [System.Management.Automation.CompletionResult]::new(
                        $_,
                        $_,
                        'ParameterValue',
                        "Export as $_"
                    )
                }
            } elseif ($wordToComplete -like '--*') {
                # Complete flags
                @(
                    [PSCustomObject]@{ Name = '--format'; Description = 'Export format' }
                    [PSCustomObject]@{ Name = '--compress'; Description = 'Compress output' }
                ) | Where-Object { $_.Name -like "$wordToComplete*" } | ForEach-Object {
                    [System.Management.Automation.CompletionResult]::new(
                        $_.Name,
                        $_.Name,
                        'ParameterValue',
                        $_.Description
                    )
                }
            } else {
                # Complete directories
                Get-ChildItem -Directory | Where-Object { $_.Name -like "$wordToComplete*" } | ForEach-Object {
                    [System.Management.Automation.CompletionResult]::new(
                        $_.Name,
                        $_.Name,
                        'ParameterValue',
                        "Export to $($_.Name)"
                    )
                }
            }
        }
        'create' {
            # Suggest project name
            if ($wordToComplete) {
                [System.Management.Automation.CompletionResult]::new(
                    "$wordToComplete",
                    "$wordToComplete",
                    'ParameterValue',
                    "Create project: $wordToComplete"
                )
            }
        }
        'mount' {
            # Check if previous word is a flag
            $prevWord = if ($wordCount -gt 2) { $words[$wordCount - 2] } else { '' }

            if ($prevWord -eq '--drive') {
                # Complete drive letters
                @('R:', 'S:', 'T:', 'U:', 'V:') | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                    [System.Management.Automation.CompletionResult]::new(
                        $_,
                        $_,
                        'ParameterValue',
                        "Mount as $_"
                    )
                }
            } elseif ($wordToComplete -like '--*') {
                # Complete flags
                @(
                    [PSCustomObject]@{ Name = '--drive'; Description = 'Drive letter' }
                    [PSCustomObject]@{ Name = '--readonly'; Description = 'Mount read-only' }
                ) | Where-Object { $_.Name -like "$wordToComplete*" } | ForEach-Object {
                    [System.Management.Automation.CompletionResult]::new(
                        $_.Name,
                        $_.Name,
                        'ParameterValue',
                        $_.Description
                    )
                }
            } else {
                # Complete .fxd files
                Get-ChildItem -Filter "*.fxd" -File | Where-Object { $_.Name -like "$wordToComplete*" } | ForEach-Object {
                    [System.Management.Automation.CompletionResult]::new(
                        $_.Name,
                        $_.Name,
                        'ParameterValue',
                        "Mount $($_.Name)"
                    )
                }
            }
        }
        'unmount' {
            # Complete drive letters
            @('R:', 'S:', 'T:', 'U:', 'V:') | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                [System.Management.Automation.CompletionResult]::new(
                    $_,
                    $_,
                    'ParameterValue',
                    "Unmount $_"
                )
            }
        }
        'help' {
            # Complete help topics (commands)
            $commands | Where-Object { $_.Name -like "$wordToComplete*" } | ForEach-Object {
                [System.Management.Automation.CompletionResult]::new(
                    $_.Name,
                    $_.Name,
                    'ParameterValue',
                    "Help for $($_.Name)"
                )
            }
        }
        default {
            # Default: complete files
            Get-ChildItem | Where-Object { $_.Name -like "$wordToComplete*" } | ForEach-Object {
                [System.Management.Automation.CompletionResult]::new(
                    $_.Name,
                    $_.Name,
                    'ParameterValue',
                    $_.Name
                )
            }
        }
    }
}

# Add alias completions if fxd has aliases
# Set-Alias -Name fxd-cli -Value fxd
# Register-ArgumentCompleter -CommandName fxd-cli -ScriptBlock $Function:TabExpansion2
