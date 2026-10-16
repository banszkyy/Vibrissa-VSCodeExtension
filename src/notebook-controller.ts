import * as vscode from 'vscode'
import * as fs from 'fs'
import * as config from './config'
import * as childProcess from 'child_process'
import { log } from './extension'
import * as rpc from 'vscode-jsonrpc/node'

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(new BBLangNotebookController(context))
}

export class BBLangNotebookController implements vscode.Disposable {
    static readonly controllerId = 'bblang-notebook-controller'
    static readonly notebookType = 'bblang-notebook'
    static readonly label = 'BBLang Notebook'
    static readonly supportedLanguages = ['bbc']

    private readonly controller: vscode.NotebookController
    private readonly context: vscode.ExtensionContext
    private executionOrder = 0

    constructor(context: vscode.ExtensionContext) {
        this.controller = vscode.notebooks.createNotebookController(
            BBLangNotebookController.controllerId,
            BBLangNotebookController.notebookType,
            BBLangNotebookController.label
        )
        this.context = context

        this.controller.supportedLanguages = BBLangNotebookController.supportedLanguages
        this.controller.supportsExecutionOrder = true
        this.controller.executeHandler = this.execute.bind(this)
    }

    dispose() {
        this.controller.dispose()
    }

    private async execute(
        cells: ReadonlyArray<vscode.NotebookCell>,
        _notebook: vscode.NotebookDocument,
        _controller: vscode.NotebookController
    ): Promise<void> {
        for (const cell of cells) {
            await this.executeCell(cell)
        }
    }

    private async executeCell(cell: vscode.NotebookCell): Promise<void> {
        const execution = this.controller.createNotebookCellExecution(cell)
        execution.executionOrder = ++this.executionOrder
        execution.start(Date.now())

        const extConfig = config.getConfig(this.context)
        const runtimePath = extConfig.runtime.path()

        if (!runtimePath) {
            await execution.replaceOutput(new vscode.NotebookCellOutput([
                vscode.NotebookCellOutputItem.text(`Runtime not set`)
            ]))
            execution.end(false)
            return
        }

        if (!fs.existsSync(runtimePath)) {
            await execution.replaceOutput(new vscode.NotebookCellOutput([
                vscode.NotebookCellOutputItem.text(`Runtime not found`)
            ]))
            execution.end(false)
            return
        }

        await new Promise<void>(async (resolve) => {
            const cells: Array<vscode.NotebookCellOutputItem> = []
            let stdout = ''
            let stderr = ''
            let stdin = ''
            let result = 0

            await execution.clearOutput()

            const runtimePath = extConfig.runtime.path()

            if (!runtimePath) {
                await execution.replaceOutput(new vscode.NotebookCellOutput([
                    vscode.NotebookCellOutputItem.text(`Runtime not set`)
                ]))
                execution.end(false)
                return
            }

            if (!fs.existsSync(runtimePath)) {
                await execution.replaceOutput(new vscode.NotebookCellOutput([
                    vscode.NotebookCellOutputItem.text(`Runtime not found`)
                ]))
                execution.end(false)
                return
            }

            let updateCellsLateTimeout: NodeJS.Timeout | null = null
            const updateCells = () => {
                const _cells = []
                if (stdout) _cells.push(vscode.NotebookCellOutputItem.stdout(stdout))
                if (stderr) _cells.push(vscode.NotebookCellOutputItem.stderr(stderr))
                _cells.push(...cells)
                return execution.replaceOutput(_cells.map(v => new vscode.NotebookCellOutput([v])))
            }
            const updateCellsLate = () => {
                if (!updateCellsLateTimeout) {
                    updateCellsLateTimeout = setTimeout(() => {
                        updateCells()
                        updateCellsLateTimeout = null
                    }, 100)
                }
            }

            const args = [
                '--ipc',
                '--uri', cell.notebook.uri.toString(),
                `data:${btoa(cell.document.getText())}`
            ]
            log.trace(`[Runtime] Spawning process "${runtimePath}" ${args.map(v => `"${v}"`).join(' ')}`)
            const proc = childProcess.spawn(runtimePath, args)
            proc.addListener('spawn', () => {
                log.trace(`[Runtime] Spawned`)
            })
            proc.addListener('error', (error) => {
                log.trace(`[Runtime]`, error)
                cells.push(vscode.NotebookCellOutputItem.error(error))
                updateCellsLate()
            })
            proc.addListener('close', (code, signal) => {
                log.trace(`[Runtime] Close`, code, signal)
                if (updateCellsLateTimeout) clearTimeout(updateCellsLateTimeout)

                if (code !== 0) {
                    if (code) {
                        cells.push(vscode.NotebookCellOutputItem.text(`Runtime exited with code ${code} ${signal ? `(${signal})` : ''}`.trimEnd()))
                    } else {
                        cells.push(vscode.NotebookCellOutputItem.text(`Runtime exited (${signal ? `(${signal})` : ''})`.trimEnd()))
                    }
                } else if (result) {
                    cells.push(vscode.NotebookCellOutputItem.text(`Finished with code ${result}`))
                }

                updateCells()
                execution.end(code === 0, Date.now())

                resolve()
            })

            proc.stderr.addListener('data', (chunk) => {
                stderr += chunk.toString()
                log.trace(`[Runtime] Stderr`, chunk.toString())
                updateCellsLate()
            })

            const connection = rpc.createMessageConnection(
                new rpc.StreamMessageReader(proc.stdout),
                new rpc.StreamMessageWriter(proc.stdin),
                {
                    error(message) { log.error(message) },
                    info(message) { log.info(message) },
                    warn(message) { log.warn(message) },
                    log(message) { log.debug(message) },
                }
            )

            connection.onNotification(new rpc.NotificationType2<string, string>('log'), (level, message) => {
                switch (level) {
                    case 'trace': log.trace(message); break
                    case 'debug': log.debug(message); break
                    case 'info': log.info(message); break
                    case 'warn': log.warn(message); break
                    case 'error': log.error(message); break
                    default: log.appendLine(message); break
                }
            })

            connection.onError((error) => {
                log.error(...error)
            })

            connection.onUnhandledNotification(e => {
                log.error(`[Runtime] Unhandled notification`, e)
            })

            connection.onUnhandledProgress(e => {
                log.error(`[Runtime] Unhandled progress`, e)
            })

            connection.onNotification(new rpc.NotificationType1<string>('stdout'), (chunk) => {
                stdout += chunk
                log.trace(`[Runtime] Stdout`, chunk)
                updateCellsLate()
            })

            connection.onNotification(new rpc.NotificationType1<string>('stderr'), (chunk) => {
                stderr += chunk
                log.trace(`[Runtime] Stderr`, chunk)
                updateCellsLate()
            })

            connection.onNotification(new rpc.NotificationType1<number>('result'), (_result) => {
                result = _result
            })

            connection.onRequest(new rpc.RequestType0('stdin'), (token) => {
                return new Promise((resolve, reject) => {
                    const inputBox = vscode.window.createInputBox()
                    inputBox.show()
                    inputBox.onDidAccept(() => {
                        stdin += inputBox.value
                        inputBox.dispose()

                        if (stdin.length === 0) {
                            reject(`Empty input`)
                        } else {
                            const c = stdin[0]
                            stdin = stdin.substring(1)
                            resolve(c)
                        }
                    })
                    inputBox.onDidHide(() => {
                        inputBox.dispose()
                        reject(`Cancelled`)
                    })
                    token.onCancellationRequested(() => {
                        inputBox.hide()
                    })
                })
            })

            connection.onClose(() => {
                log.trace(`[Runtime] RPC connection closed`)
            })

            connection.listen()
            //connection.trace(rpc.Trace.Verbose, { log(message) { log.trace(message) } })
        })
    }
}
