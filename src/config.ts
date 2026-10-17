import * as vscode from 'vscode'
import * as utils from './utils'

const dotnetRID = (() => {
    switch (process.platform) {
        case 'linux':
            switch (process.arch) {
                case 'x64': return 'linux-x64'
                case 'arm': return 'linux-arm'
                case 'arm64': return 'linux-arm64'
            }
            break
        case 'win32':
            switch (process.arch) {
                case 'x64': return 'win-x64'
            }
            break
    }
    vscode.window.showErrorMessage(`The current platform ${process.platform}-${process.arch} is not supported`)
    return ''
})()

const executableFileExtension = (() => {
    switch (process.platform) {
        case 'win32':
            return '.exe'
        case 'linux':
        default:
            return ''
    }
})()

export function getConfig(context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration(utils.extensionId, vscode.window.activeTextEditor ? (vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri)?.uri ?? null) : null)
    const getPath = (v: { id: string, pathConfigKey: string }) => {
        let a = config.get<string | null>(v.pathConfigKey, null)
        if (!a || a === '') a = null
        let b: string | null = String(context.globalState.get(`pathto-${v.id}`))
        if (!b || b === '') b = null
        return a ?? b
    }
    return Object.freeze({
        runtime: {
            id: 'runtime',
            executableFilename: `executableFileExtension${executableFileExtension}`,
            githubUsername: 'banszkyy',
            githubRepository: 'Vibrissa',
            githubAssetName: dotnetRID ? `${dotnetRID}.zip` : '',
            pathConfigKey: 'runtime.path',
            path() { return getPath(this) },
        },
        languageServer: {
            id: 'languageserver',
            executableFilename: `vibrissa_languageserver${executableFileExtension}`,
            githubUsername: 'banszkyy',
            githubRepository: 'Vibrissa-LanguageServer',
            githubAssetName: dotnetRID ? `${dotnetRID}.zip` : '',
            pathConfigKey: 'server.path',
            path() { return getPath(this) },
        },
        debuggerHost: {
            id: 'debughost',
            executableFilename: `vibrissa_debughost${executableFileExtension}`,
            githubUsername: 'banszkyy',
            githubRepository: 'Vibrissa-DebugHost',
            githubAssetName: dotnetRID ? `${dotnetRID}.zip` : '',
            pathConfigKey: 'debug.server.path',
            logPath: config.get<string>('debug.server.log'),
            path() { return getPath(this) },
        },
    })
}

export function goToConfig(config: string) {
    vscode.commands.executeCommand('workbench.action.openSettings', `${utils.extensionId}.${config}`)
}
