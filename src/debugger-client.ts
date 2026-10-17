'use strict'

import * as vscode from 'vscode'
import { WorkspaceFolder, DebugConfiguration, ProviderResult, CancellationToken } from 'vscode'
import * as config from './config'
import * as fs from 'fs'
import { languageId } from './utils'
import { log } from './extension'

const runMode: 'external' | 'server' | 'inline' = 'external'

export function activate(context: vscode.ExtensionContext) {
    log.debug('[Debugger] Activating debugger ...')

    const provider = new ConfigurationProvider()
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider(languageId, provider))

    let adapterFactory: vscode.DebugAdapterDescriptorFactory
    let trackerFactory: vscode.DebugAdapterTrackerFactory

    switch (runMode) {
        case 'server':
            throw new Error('Not implemented')
        case 'inline':
            throw new Error('Not implemented')
        case 'external':
        default:
            log.debug('[Debugger] Configuring debugger as external')
            adapterFactory = new class implements vscode.DebugAdapterDescriptorFactory {
                createDebugAdapterDescriptor(session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable | undefined): ProviderResult<vscode.DebugAdapterDescriptor> {
                    log.trace(`[Debugger] Registering debug adapter descriptor`, session, executable)

                    if (executable) { return executable }

                    const debuggerHostConfig = config.getConfig(context).debuggerHost;
                    const hostPath = debuggerHostConfig.path()

                    if (!hostPath) {
                        log.warn(`[Debugger] Debug server not set`)
                        vscode.window.showErrorMessage(`Debug server not set`)
                        return null
                    }

                    if (!fs.existsSync(hostPath)) {
                        log.warn(`[Debugger] Debug server "${hostPath}" not found`)
                        vscode.window.showErrorMessage(`Debug server "${hostPath}" not found`)
                        return null
                    }

                    log.info(`[Debugger] Debug host at \"${hostPath}\"`)

                    const args = []
                    if (debuggerHostConfig.logPath) {
                        args.push(...["--log", debuggerHostConfig.logPath])
                    }
                    return new vscode.DebugAdapterExecutable(hostPath, args)
                }
            }()
            break
    }

    trackerFactory = new class implements vscode.DebugAdapterTrackerFactory {
        createDebugAdapterTracker(session: vscode.DebugSession): ProviderResult<vscode.DebugAdapterTracker> {
            log.trace(`[Debugger] Registering debug adapter tracker`, session)
            return {
                //onDidSendMessage(message: any): void {
                //    log.trace(`[Debugger] ${message}`)
                //},
                onError(error: Error): void {
                    log.error(`[Debugger] Error`)
                    log.error(error)
                },
                onExit(code, signal) {
                    log.debug(`[Debugger] Exited { code: ${code}, signal: ${signal} }`)
                },
            }
        }
    }

    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory(languageId, adapterFactory))
    context.subscriptions.push(vscode.debug.registerDebugAdapterTrackerFactory(languageId, trackerFactory))

    if ('dispose' in adapterFactory &&
        typeof adapterFactory.dispose === 'function' &&
        adapterFactory.dispose instanceof Function) {
        context.subscriptions.push(adapterFactory as { dispose(): void })
    }

    if ('dispose' in trackerFactory &&
        typeof trackerFactory.dispose === 'function' &&
        trackerFactory.dispose instanceof Function) {
        context.subscriptions.push(trackerFactory as { dispose(): void })
    }

    context.subscriptions.push(vscode.commands.registerCommand(`${languageId}.debugEditorContents`, (resource: vscode.Uri | null | undefined) => {
        log.debug('[Debugger] Try to start debugging ...')

        const targetResource = resource ?? vscode.window.activeTextEditor?.document.uri ?? null
        if (!targetResource) {
            vscode.window.showErrorMessage(`No document opened for debugging`)
            return
        }

        log.trace('[Debugger] Resource:', targetResource)

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(targetResource)

        log.trace('[Debugger] Start debuging ...')
        vscode.debug.startDebugging(workspaceFolder, {
            type: languageId,
            name: 'Debug Editor Contents',
            request: 'launch',
            program: targetResource.fsPath,
            stopOnEntry: false,
            noDebug: false,
        })
            .then(result => {
                if (!result) {
                    vscode.window.showErrorMessage('Failed to start debugging')
                    log.warn('[Debugger] Failed to start debugging')
                } else {
                    log.info('[Debugger] Debugging started')
                }
            }, error => {
                log.error(`[Debugger] Failed to start debugging`, error)
            })
    }))

    context.subscriptions.push(vscode.commands.registerCommand(`${languageId}.profileEditorContents`, (resource: vscode.Uri | null | undefined) => {
        log.debug('[Debugger] Try to start profiling ...')

        const targetResource = resource ?? vscode.window.activeTextEditor?.document.uri ?? null
        if (!targetResource) {
            vscode.window.showErrorMessage(`No document opened for profiling`)
            return
        }

        log.trace('[Debugger] Resource:', targetResource)

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(targetResource)

        log.trace('[Debugger] Start profiling ...')
        vscode.debug.startDebugging(workspaceFolder, {
            type: languageId,
            name: 'Profile Editor Contents',
            request: 'launch',
            program: targetResource.fsPath,
            stopOnEntry: false,
            noDebug: false,
            profile: true,
        })
            .then(result => {
                if (!result) {
                    vscode.window.showErrorMessage('Failed to start profiling')
                    log.warn('[Debugger] Failed to start profiling')
                } else {
                    log.info('[Debugger] Profiling started')
                }
            }, error => {
                log.error(`[Debugger] Failed to start profiling`, error)
            })
    }))

    context.subscriptions.push(vscode.commands.registerCommand(`${languageId}.executeEditorContents`, (resource: vscode.Uri | null | undefined) => {
        log.debug('[Debugger] Try to start debugging (no debug) ...')

        const targetResource = resource ?? vscode.window.activeTextEditor?.document.uri ?? null
        if (!targetResource) {
            vscode.window.showErrorMessage(`No document opened for debugging`)
            return
        }

        log.trace('[Debugger] Resource:', targetResource)

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(targetResource)

        log.trace('[Debugger] Start debuging (no debug) ...')
        vscode.debug.startDebugging(workspaceFolder, {
            type: languageId,
            name: 'Debug Editor Contents',
            request: 'launch',
            program: targetResource.fsPath,
            stopOnEntry: false,
            noDebug: true,
        })
            .then(result => {
                if (!result) {
                    vscode.window.showErrorMessage('Failed to start debugging')
                    log.warn('[Debugger] Failed to start debugging (no debug)')
                } else {
                    log.info('[Debugger] Debugging started (no debug)')
                }
            }, error => {
                log.error(`[Debugger] Failed to start debugging (no debug)`, error)
            })
    }))

    vscode.debug.onDidStartDebugSession(e => log.trace('[Debugger] Debug session started:', e))
    vscode.debug.onDidChangeActiveDebugSession(e => log.trace('[Debugger] Active debug session changed:', e))
    vscode.debug.onDidTerminateDebugSession(e => log.trace('[Debugger] Debug session terminated:', e))
    //vscode.debug.onDidReceiveDebugSessionCustomEvent(e => log.trace('[Debugger] Custom event received:', e))
    vscode.debug.onDidChangeBreakpoints(e => log.trace('[Debugger] Breakpoints changed:', e))

    const outputChannel = vscode.window.createOutputChannel("Vibrissa Debug Host", { log: true })

    vscode.debug.onDidReceiveDebugSessionCustomEvent(e => {
        if (e.event === "adapterLog") {
            switch (e.body.level) {
                case 'trace': outputChannel.trace(e.body.message); break
                case 'debug': outputChannel.debug(e.body.message); break
                case 'info': outputChannel.info(e.body.message); break
                case 'warn': outputChannel.warn(e.body.message); break
                case 'error': outputChannel.error(e.body.message); break
                default: outputChannel.appendLine(e.body.message); break
            }
        }
    })

    log.info('[Debugger] Debugger activated')
}

class ConfigurationProvider implements vscode.DebugConfigurationProvider {
    resolveDebugConfiguration(folder: WorkspaceFolder | undefined, config: DebugConfiguration, token?: CancellationToken): ProviderResult<DebugConfiguration> {

        if (!config.type && !config.request && !config.name) {
            const editor = vscode.window.activeTextEditor
            if (editor && editor.document.languageId === languageId) {
                config.type = languageId
                config.name = 'Launch'
                config.request = 'launch'
                config['program'] = '${file}'
            }
        }

        if (!config['program']) {
            return vscode.window.showInformationMessage("Cannot find a program to debug").then(_ => {
                return undefined // abort launch
            })
        }

        log.trace('[Debugger] Debug configuration resolved', config)

        return config
    }
}
export function deactivate() {
    
}

