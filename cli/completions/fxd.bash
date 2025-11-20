# Bash completion for fxd command
# Install: sudo cp fxd.bash /etc/bash_completion.d/fxd
# Or: sudo cp fxd.bash /usr/local/etc/bash_completion.d/fxd (macOS with Homebrew)

_fxd_completions() {
    local cur prev opts commands
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"

    # All available commands
    commands="help version health save load import export stats list create mount unmount"

    # Options that take file arguments
    file_opts="save load import export stats"

    # If we're completing the first argument (command)
    if [ ${COMP_CWORD} -eq 1 ]; then
        COMPREPLY=( $(compgen -W "${commands}" -- ${cur}) )
        return 0
    fi

    # Get the command (first argument)
    local cmd="${COMP_WORDS[1]}"

    # Complete based on the command
    case "${cmd}" in
        save)
            # Complete .fxd files for save command
            if [ ${COMP_CWORD} -eq 2 ]; then
                COMPREPLY=( $(compgen -f -X '!*.fxd' -- ${cur}) )
                # Also allow creating new files
                COMPREPLY+=( $(compgen -W "${cur}.fxd" -- ${cur}) )
            fi
            ;;
        load|stats)
            # Complete existing .fxd files
            if [ ${COMP_CWORD} -eq 2 ]; then
                COMPREPLY=( $(compgen -f -X '!*.fxd' -- ${cur}) )
            fi
            ;;
        import)
            # Complete directories and files for import
            if [ ${COMP_CWORD} -eq 2 ]; then
                COMPREPLY=( $(compgen -d -f -- ${cur}) )
            elif [ ${COMP_CWORD} -eq 3 ] && [ "${prev}" == "--save" ]; then
                # After --save flag, complete .fxd files
                COMPREPLY=( $(compgen -f -X '!*.fxd' -- ${cur}) )
            else
                # Complete flags
                COMPREPLY=( $(compgen -W "--save --format" -- ${cur}) )
            fi
            ;;
        export)
            # Complete directories for export
            if [ ${COMP_CWORD} -eq 2 ]; then
                COMPREPLY=( $(compgen -d -- ${cur}) )
            else
                # Complete format flag
                COMPREPLY=( $(compgen -W "--format json files html" -- ${cur}) )
            fi
            ;;
        create)
            # Complete new .fxd file names
            if [ ${COMP_CWORD} -eq 2 ]; then
                COMPREPLY=( $(compgen -W "${cur}.fxd" -- ${cur}) )
            fi
            ;;
        mount)
            # Complete .fxd files to mount
            if [ ${COMP_CWORD} -eq 2 ]; then
                COMPREPLY=( $(compgen -f -X '!*.fxd' -- ${cur}) )
            else
                # Complete mount options
                COMPREPLY=( $(compgen -W "--drive --readonly" -- ${cur}) )
            fi
            ;;
        unmount)
            # Complete mount points
            if [ ${COMP_CWORD} -eq 2 ]; then
                COMPREPLY=( $(compgen -W "R: S: T: /mnt/fxd" -- ${cur}) )
            fi
            ;;
        help)
            # Complete help topics (commands)
            if [ ${COMP_CWORD} -eq 2 ]; then
                COMPREPLY=( $(compgen -W "${commands}" -- ${cur}) )
            fi
            ;;
        *)
            # Default: complete files and common flags
            COMPREPLY=( $(compgen -f -W "--help --verbose --quiet" -- ${cur}) )
            ;;
    esac

    return 0
}

# Register the completion function
complete -F _fxd_completions fxd
