# Fish completion for fxd command
# Install: cp fxd.fish ~/.config/fish/completions/

# Disable file completion by default
complete -c fxd -f

# Commands
complete -c fxd -n "__fish_use_subcommand" -a "help" -d "Show help information"
complete -c fxd -n "__fish_use_subcommand" -a "version" -d "Show FXD version"
complete -c fxd -n "__fish_use_subcommand" -a "health" -d "Check FXD system health"
complete -c fxd -n "__fish_use_subcommand" -a "save" -d "Save current state to .fxd file"
complete -c fxd -n "__fish_use_subcommand" -a "load" -d "Load state from .fxd file"
complete -c fxd -n "__fish_use_subcommand" -a "import" -d "Import files or directories"
complete -c fxd -n "__fish_use_subcommand" -a "export" -d "Export state to files"
complete -c fxd -n "__fish_use_subcommand" -a "stats" -d "Show statistics about FXD file"
complete -c fxd -n "__fish_use_subcommand" -a "list" -d "List .fxd files in current directory"
complete -c fxd -n "__fish_use_subcommand" -a "create" -d "Create new FXD project"
complete -c fxd -n "__fish_use_subcommand" -a "mount" -d "Mount FXD disk as virtual drive"
complete -c fxd -n "__fish_use_subcommand" -a "unmount" -d "Unmount virtual drive"

# save command - complete with .fxd files
complete -c fxd -n "__fish_seen_subcommand_from save" -a "(__fish_complete_suffix .fxd)"

# load command - complete with existing .fxd files
complete -c fxd -n "__fish_seen_subcommand_from load" -a "(ls *.fxd 2>/dev/null)"

# stats command - complete with existing .fxd files
complete -c fxd -n "__fish_seen_subcommand_from stats" -a "(ls *.fxd 2>/dev/null)"

# import command
complete -c fxd -n "__fish_seen_subcommand_from import" -r -F -d "File or directory to import"
complete -c fxd -n "__fish_seen_subcommand_from import" -l "save" -r -a "(__fish_complete_suffix .fxd)" -d "Save imported data to file"
complete -c fxd -n "__fish_seen_subcommand_from import" -l "format" -r -a "auto json yaml" -d "Import format"

# export command
complete -c fxd -n "__fish_seen_subcommand_from export" -r -a "(__fish_complete_directories)" -d "Export directory"
complete -c fxd -n "__fish_seen_subcommand_from export" -l "format" -r -a "json files html" -d "Export format"
complete -c fxd -n "__fish_seen_subcommand_from export" -l "compress" -d "Compress output"

# create command
complete -c fxd -n "__fish_seen_subcommand_from create" -l "template" -r -a "empty basic full" -d "Project template"

# mount command
complete -c fxd -n "__fish_seen_subcommand_from mount" -a "(ls *.fxd 2>/dev/null)"
complete -c fxd -n "__fish_seen_subcommand_from mount" -l "drive" -r -a "R: S: T: U: V:" -d "Drive letter (Windows)"
complete -c fxd -n "__fish_seen_subcommand_from mount" -l "readonly" -d "Mount read-only"

# unmount command
complete -c fxd -n "__fish_seen_subcommand_from unmount" -r -a "R: S: T: U: V: /mnt/fxd" -d "Mount point"

# help command - complete with command names
complete -c fxd -n "__fish_seen_subcommand_from help" -a "help version health save load import export stats list create mount unmount"

# Global options (available for all commands)
complete -c fxd -l "help" -d "Show help information"
complete -c fxd -l "verbose" -d "Verbose output"
complete -c fxd -l "quiet" -d "Quiet mode"
complete -c fxd -l "version" -d "Show version"
