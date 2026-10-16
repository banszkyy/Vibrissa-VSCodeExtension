import * as vscode from 'vscode'
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    Disposable
} from 'vscode-languageclient/node'
import * as utils from './utils'
import { log } from './extension'
import * as config from './config'
import * as fs from 'fs'
import { AllocationDecorations } from './code-decorations'

export let client: LanguageClientManager | null = null
let decorations: AllocationDecorations | null = null
export let globalStateChanged: vscode.EventEmitter<string>

export function activate(context: vscode.ExtensionContext) {
    startServer(context)

    context.subscriptions.push(globalStateChanged = new vscode.EventEmitter<string>())

    const languageServerChanged = () => {
        vscode.window.showInformationMessage(`Path to the language server was changed. Do you want to restart the server?`, 'Yes', 'No')
            .then(e => {
                if (e === 'Yes') {
                    restartServer(context)
                }
            })
    }

    globalStateChanged.event(key => {
        const c = config.getConfig(context)
        if (key === `pathto-${c.languageServer.id}`) {
            languageServerChanged()
        }
    })

    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration(`${utils.extensionConfigName}.server.path`)) {
            languageServerChanged()
        }
    }))

    context.subscriptions.push(vscode.commands.registerCommand(`${utils.languageId}.recompile`, (file?: vscode.Uri) => {
        if (!client?.client) return

        if (!file) {
            file = vscode.window.activeTextEditor?.document.uri
        }

        if (!file) {
            log.warn(`[Language] Cannot recompile because no file provided`)
            return
        }

        log.info(`[Language] Requesting recompile ...`)
        client.client.sendRequest('bblang/compiler/recompile', { file: file.toString() })
            .then(res => {
                log.info(`[Language] Recompiling`, res)
            })
            .catch(err => {
                log.error(err)
            })
    }))

    context.subscriptions.push(vscode.commands.registerCommand(`${utils.languageId}.languageServer.restart`, () => {
        restartServer(context)
    }))
}

export function deactivate() {
    stopServer()
}

function restartServer(context: vscode.ExtensionContext) {
    return stopServer().then(() => startServer(context))
}

function startServer(context: vscode.ExtensionContext) {
    const extConfig = config.getConfig(context)
    const serverPath = extConfig.languageServer.path()

    if (!serverPath) {
        log.warn(`[Language] Language server not set`)
        vscode.window.showErrorMessage(`Language server not set`)
        return Promise.resolve()
    }

    if (!fs.existsSync(serverPath)) {
        log.warn(`[Language] Language server "${serverPath}" not found`)
        vscode.window.showErrorMessage(`Language server "${serverPath}" not found`)
        return Promise.resolve()
    }

    log.trace(`[Language] Language server at \"${serverPath}\"`)

    client = new LanguageClientManager(context, serverPath)
    decorations?.dispose()
    decorations = new AllocationDecorations(client.client, new Set<string>([utils.languageId]))
    return client.activate()
}

function stopServer() {
    decorations?.dispose()
    decorations = null
    if (!client) return Promise.resolve()
    return client.deactivate()
        .finally(() => {
            client?.dispose()
            client = null
        })
}

export type LanguageClientManagerOptions = {
    serverPath: string,
    args?: string[],
}

export class LanguageClientManager implements Disposable {
    readonly client: LanguageClient
    private readonly context: vscode.ExtensionContext
    private readonly outputChannel: vscode.LogOutputChannel

    private compilerStatusBarItem: vscode.LanguageStatusItem | null
    private compilerStatusCooldown: NodeJS.Timeout | null

    constructor(context: vscode.ExtensionContext, serverPath: string, args: string[] = []) {
        const serverOptions: ServerOptions =
        {
            run: { command: serverPath },
            debug: { command: serverPath },
            args: args,
            options: {
                detached: false,
            },
        }

        this.outputChannel = vscode.window.createOutputChannel('BBLang Language Server', { log: true })

        const clientOptions: LanguageClientOptions = {
            documentSelector: [{
                language: utils.languageExtension,
            }],
            synchronize: {
                fileEvents: [
                    vscode.workspace.createFileSystemWatcher('**/.bbc'),
                    vscode.workspace.createFileSystemWatcher('**/.bbnb')
                ],
            },
            diagnosticPullOptions: {
                onChange: true,
                onTabs: true,
                onSave: true,
            },
            outputChannel: this.outputChannel,
        }

        log.debug(`[Language] Language server is at "${serverPath}"`)

        this.client = new LanguageClient(
            utils.extensionConfigName,
            'BBLang Language Client',
            serverOptions,
            clientOptions
        )

        interface CompilerStatusNotificationArgs {
            status: 'done' | 'failed' | 'working'
            details?: string
        }

        interface ProjectStatusNotificationArgs {
            projectType: null | 'project' | 'file'
            contextFile: string
            indexedFiles?: number
            root?: string
        }

        this.compilerStatusBarItem = null
        this.compilerStatusCooldown = null

        this.client.onNotification('bblang/compiler/status', (status: CompilerStatusNotificationArgs) => {
            if (this.compilerStatusCooldown) clearTimeout(this.compilerStatusCooldown)
            this.compilerStatusCooldown = setTimeout(() => {
                if (!this.compilerStatusBarItem) {
                    this.compilerStatusBarItem = vscode.languages.createLanguageStatusItem(`bblang-compiler-status`, { language: utils.languageId })
                    this.compilerStatusBarItem.name = `BBLang Compiler Status`
                    context.subscriptions.push(this.compilerStatusBarItem)
                }

                switch (status.status) {
                    case 'done':
                        this.compilerStatusBarItem.text = `Compiled`
                        this.compilerStatusBarItem.busy = false
                        this.compilerStatusBarItem.severity = vscode.LanguageStatusSeverity.Information
                        this.compilerStatusBarItem.command = { command: `${utils.languageId}.recompile`, title: 'Recompile', arguments: [] }
                        break
                    case 'working':
                        this.compilerStatusBarItem.text = `Compiling`
                        this.compilerStatusBarItem.busy = true
                        this.compilerStatusBarItem.severity = vscode.LanguageStatusSeverity.Information
                        this.compilerStatusBarItem.command = undefined
                        break
                    case 'failed':
                        this.compilerStatusBarItem.text = `Failed`
                        this.compilerStatusBarItem.busy = false
                        this.compilerStatusBarItem.severity = vscode.LanguageStatusSeverity.Error
                        this.compilerStatusBarItem.command = { command: `${utils.languageId}.recompile`, title: 'Recompile', arguments: [] }
                        break
                }

                this.compilerStatusBarItem.detail = status.details ?? undefined
            }, 100)
        })

        let projectStatusBarItem: vscode.StatusBarItem | null = null
        const fileToProjectStatus = new Map<string, ProjectStatusNotificationArgs>()

        this.client.onNotification('bblang/project/status', (status: ProjectStatusNotificationArgs) => {
            fileToProjectStatus.set(status.contextFile, status)
            if (vscode.window.activeTextEditor?.document) {
                if (schemeIgnore.has(vscode.window.activeTextEditor.document.uri.scheme)) return
                updateProjectStatus(vscode.window.activeTextEditor.document.uri)
            }
        })

        function updateProjectStatus(file: vscode.Uri) {
            const project = fileToProjectStatus.get(file.toString())
            log.debug(`[Language] Project`, file, project)

            if (project) {
                if (!projectStatusBarItem) {
                    projectStatusBarItem = vscode.window.createStatusBarItem('bblang-project')
                    projectStatusBarItem.name = `BBLang Project`
                    context.subscriptions.push(projectStatusBarItem)
                }
                projectStatusBarItem.show()

                if (project.projectType === 'project') {
                    projectStatusBarItem.text = `$(project) Project`
                    projectStatusBarItem.tooltip = `${project.indexedFiles} files compiled\n${project.root}`
                    projectStatusBarItem.backgroundColor = undefined
                    projectStatusBarItem.color = undefined
                } else if (project.projectType === 'file') {
                    projectStatusBarItem.text = `$(file) File`
                    projectStatusBarItem.tooltip = `${project.indexedFiles} files compiled\n${project.root}`
                    projectStatusBarItem.backgroundColor = undefined
                    projectStatusBarItem.color = undefined
                } else {
                    projectStatusBarItem.text = `$(warning) No Project`
                    projectStatusBarItem.tooltip = undefined
                    projectStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground')
                    projectStatusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground')
                }
            } else {
                projectStatusBarItem?.hide()
            }
        }
        const schemeIgnore = new Set<string>([
            'output',
            'vscode-scm',
            'git',
        ])

        vscode.workspace.onDidOpenTextDocument(e => {
            if (schemeIgnore.has(e.uri.scheme)) return
            updateProjectStatus(e.uri)
        })
        vscode.workspace.onDidCloseTextDocument(e => {
            if (schemeIgnore.has(e.uri.scheme)) return
            updateProjectStatus(e.uri)
        })
        vscode.workspace.onDidChangeTextDocument(e => {
            if (schemeIgnore.has(e.document.uri.scheme)) return
            updateProjectStatus(e.document.uri)
        })
        vscode.window.onDidChangeActiveTextEditor(e => {
            if (!e) return
            if (schemeIgnore.has(e.document.uri.scheme)) return
            updateProjectStatus(e.document.uri)
        })

        this.client.onNotification('window/logMessage', (message) => {
            switch (message.type) {
                case 1:
                    this.outputChannel.error(message.message)
                    break
                case 2:
                    this.outputChannel.warn(message.message)
                    break
                case 3:
                    this.outputChannel.info(message.message)
                    break
                case 4:
                    this.outputChannel.appendLine(message.message)
                    break
                case 5:
                    this.outputChannel.debug(message.message)
                    break
                case 6:
                    this.outputChannel.trace(message.message)
                    break
                default:
                    this.outputChannel.appendLine(message.message)
                    break
            }
        })

        this.client.error = () => { }
        this.client.warn = () => { }
        this.client.info = () => { }
        this.client.debug = () => { }

        log.debug(`[Language] Language server created`, serverOptions)

        this.context = context
    }

    public activate(): Promise<void> {
        log.debug(`[Language] Starting language server ...`)
        return this.client.start()
            .then(() => {
                this.context.subscriptions.push(this.client)
                log.debug(`[Language] Language server started`)
            })
            .catch(error => {
                log.error(`[Language] Failed to start language server`, error)
                vscode.window.showErrorMessage(error)
            })
    }

    public deactivate(): Promise<void> {
        return this.client?.stop()
            .then(() => {
                log.debug(`[Language] Language server stopped`)
            })
            .catch(error => {
                log.error(`[Language] Failed to stop language server`, error)
                vscode.window.showErrorMessage(error)
            })
    }

    [Symbol.dispose]() { this.dispose() }

    public dispose() {
        this.client?.dispose()
        this.outputChannel?.dispose()
        this.outputChannel.dispose()
        this.compilerStatusBarItem?.dispose()
        if (this.compilerStatusCooldown) clearTimeout(this.compilerStatusCooldown)
    }
}
