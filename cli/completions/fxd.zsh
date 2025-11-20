#compdef fxd
# Zsh completion for fxd command
# Install: cp fxd.zsh ~/.zsh/completions/_fxd
# Then add to .zshrc: fpath=(~/.zsh/completions $fpath)

_fxd() {
    local -a commands
    commands=(
        'help:Show help information'
        'version:Show FXD version'
        'health:Check FXD system health'
        'save:Save current state to .fxd file'
        'load:Load state from .fxd file'
        'import:Import files or directories'
        'export:Export state to files'
        'stats:Show statistics about FXD file'
        'list:List .fxd files in current directory'
        'create:Create new FXD project'
        'mount:Mount FXD disk as virtual drive'
        'unmount:Unmount virtual drive'
    )

    local -a _fxd_files
    _fxd_files=(*.fxd(N))

    _arguments -C \
        '1: :->command' \
        '*:: :->args' \
        && return 0

    case $state in
        command)
            _describe 'command' commands
            ;;
        args)
            case $words[1] in
                save)
                    _arguments \
                        '1: :_files -g "*.fxd"' \
                        '1: :_message "new filename.fxd"'
                    ;;
                load|stats)
                    _arguments \
                        '1: :_files -g "*.fxd"'
                    ;;
                import)
                    _arguments \
                        '1: :_files' \
                        '--save[Save imported data]:filename:_files -g "*.fxd"' \
                        '--format[Import format]:format:(auto json yaml)'
                    ;;
                export)
                    _arguments \
                        '1: :_directories' \
                        '--format[Export format]:format:(json files html)' \
                        '--compress[Compress output]'
                    ;;
                create)
                    _arguments \
                        '1: :_message "project name"' \
                        '--template[Project template]:template:(empty basic full)'
                    ;;
                mount)
                    _arguments \
                        '1: :_files -g "*.fxd"' \
                        '--drive[Drive letter]:drive:(R: S: T: U: V:)' \
                        '--readonly[Mount read-only]'
                    ;;
                unmount)
                    _arguments \
                        '1: :_message "mount point"'
                    ;;
                help)
                    _describe 'help topic' commands
                    ;;
                *)
                    _files
                    ;;
            esac
            ;;
    esac

    return 0
}

_fxd "$@"
