import * as vscode from 'vscode'
import * as languageClient from './language-client'
import * as debuggerClient from './debugger-client'
import * as updater from './updater'
import * as config from './config'
import { extensionId, isVirtualWorkspace, languageId } from './utils'
import * as notebookSerializer from './notebook-serializer'
import * as notebookController from './notebook-controller'
import * as profiling from './profiling'
import * as l10n from '@vscode/l10n'

export let log: vscode.LogOutputChannel

function activateTrusted(context: vscode.ExtensionContext) {
    const isVirtual = isVirtualWorkspace()

    log.trace(`isVirtual: ${isVirtual}`)

    if (!isVirtual) {
        debuggerClient.activate(context)
        profiling.activate(context)
    }

    updater.gc(context)

    languageClient.activate(context)
    notebookSerializer.activate(context)
    notebookController.activate(context)

    function interactiveUpdateAll() {
        log.trace(`interactiveUpdateAll`)

        const interactiveUpdate = (updateConfig: updater.UpdateOptions, texts: {
            "UPDATE_AVALIABLE": string,
            "NOT_FOUND": string,
            "PROGRESS": string,
            "FAILED": string,
        }, deactivate: (() => void), activate: ((context: vscode.ExtensionContext) => void)): Promise<void> => {
            return new Promise((resolve, reject) => {
                if (vscode.workspace.getConfiguration(extensionId, vscode.window.activeTextEditor ? (vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri)?.uri ?? null) : null).get<string>(updateConfig.pathConfigKey)) {
                    log.trace(`[Updater] ${updateConfig.id} is managed manually`)
                    resolve()
                    return
                }

                updater.checkForUpdates(context, updateConfig)
                    .then(result => {
                        if (result.status === updater.FetchUpdateStatus.NewVersion) {
                            vscode.window.showInformationMessage(
                                result.release ? `${texts.UPDATE_AVALIABLE}\n[Details](${result.release?.html_url})` : texts.UPDATE_AVALIABLE,
                                l10n.t('Update'), l10n.t('Shut up'))
                                .then(value => {
                                    if (value === l10n.t('Update')) {
                                        deactivate()
                                        vscode.window.withProgress({
                                            location: vscode.ProgressLocation.Notification,
                                            cancellable: true,
                                            title: texts.PROGRESS,
                                        }, (progress, token) => updater.update(context, updateConfig, progress, token)).then(() => {
                                            activate(context)
                                            resolve()
                                        }, (reason) => {
                                            activate(context)
                                            reject(`${texts.FAILED} ${reason}`)
                                        })
                                    } else {
                                        resolve()
                                    }
                                }, reject)
                        } else if (result.status === updater.FetchUpdateStatus.Nonexistent) {
                            vscode.window.showWarningMessage(texts.NOT_FOUND, l10n.t('Download'), l10n.t('Show Settings'), l10n.t('Shut up'))
                                .then(value => {
                                    if (value === l10n.t('Download')) {
                                        deactivate()
                                        vscode.window.withProgress({
                                            location: vscode.ProgressLocation.Notification,
                                            cancellable: true,
                                            title: texts.PROGRESS,
                                        }, (progress, token) => updater.update(context, updateConfig, progress, token)).then(() => {
                                            activate(context)
                                            resolve()
                                        }, (reason) => {
                                            activate(context)
                                            reject(`${texts.FAILED} ${reason}`)
                                        })
                                    } else if (value === l10n.t('Show Settings')) {
                                        config.goToConfig(updateConfig.pathConfigKey)
                                        resolve()
                                    } else {
                                        resolve()
                                    }
                                }, reject)
                        } else {
                            log.trace(`[Updater] ${updateConfig.id} is up-to-date`)
                            resolve()
                        }
                    })
                    .catch(error => reject(`[Updater] Failed to check for updates: ${error}`))
            })
        }

        const extConfig = config.getConfig(context)
        const tasks = []

        tasks.push(interactiveUpdate(extConfig.languageServer, {
            NOT_FOUND: l10n.t('Language server does not exists'),
            UPDATE_AVALIABLE: l10n.t('Update avaliable for the language server'),
            PROGRESS: l10n.t('Downloading the language server'),
            FAILED: l10n.t('Failed to update the language server'),
        }, languageClient.deactivate, languageClient.activate)
            .catch(reason => vscode.window.showWarningMessage(reason)))

        tasks.push(interactiveUpdate(extConfig.debuggerHost, {
            NOT_FOUND: l10n.t('Debug host does not exists'),
            UPDATE_AVALIABLE: l10n.t('Update avaliable for the debug host'),
            PROGRESS: l10n.t('Downloading the debug host'),
            FAILED: l10n.t('Failed to update the debug host'),
        }, debuggerClient.deactivate, debuggerClient.activate)
            .catch(reason => vscode.window.showWarningMessage(reason)))

        tasks.push(interactiveUpdate(extConfig.runtime, {
            NOT_FOUND: l10n.t('Runtime does not exists'),
            UPDATE_AVALIABLE: l10n.t('Update avaliable for the runtime'),
            PROGRESS: l10n.t('Downloading the runtime'),
            FAILED: l10n.t('Failed to update the runtime'),
        }, () => { }, () => { })
            .catch(reason => vscode.window.showWarningMessage(reason)))

        return Promise.allSettled(tasks)
    }

    context.subscriptions.push(vscode.commands.registerCommand(`${languageId}.update`, () => {
        if (isVirtualWorkspace()) return
        interactiveUpdateAll()
    }))

    if (!isVirtual) {
        interactiveUpdateAll()
    }
}

export function activate(context: vscode.ExtensionContext) {
    log = vscode.window.createOutputChannel("Vibrissa Extension", { log: true })

    if (vscode.workspace.isTrusted) {
        activateTrusted(context)
    } else {
        context.subscriptions.push(vscode.workspace.onDidGrantWorkspaceTrust(() => {
            activateTrusted(context)
        }))
    }
}

export function deactivate() {
    languageClient.deactivate()
}
