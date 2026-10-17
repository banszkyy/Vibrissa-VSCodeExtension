'use strict'

import { TextDecoder, TextEncoder } from 'util'
import * as vscode from 'vscode'
import { log } from './extension'
import { languageId } from './utils'

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.workspace.registerNotebookSerializer('vibrissa-notebook', new VibrissaNotebookSerializer()))
}

interface RawNotebook {
    cells: RawNotebookCell[]
}

interface RawNotebookCell {
    source: string[]
    cell_type: RawCellType
}

type RawCellType = 'code' | 'markdown'

class VibrissaNotebookSerializer implements vscode.NotebookSerializer {
    async deserializeNotebook(content: Uint8Array, _token: vscode.CancellationToken): Promise<vscode.NotebookData> {
        const contents = new TextDecoder().decode(content)

        let raw: RawNotebookCell[]
        try {
            raw = (<RawNotebook>JSON.parse(contents)).cells
        } catch (error) {
            log.warn(error + "")
        }
        raw ??= []

        return new vscode.NotebookData(raw.map(v => new vscode.NotebookCellData(
            v.cell_type === 'code' ? vscode.NotebookCellKind.Code : vscode.NotebookCellKind.Markup,
            v.source.join('\n'),
            v.cell_type === 'code' ? languageId : 'markdown'
        )))
    }

    async serializeNotebook(data: vscode.NotebookData, _token: vscode.CancellationToken): Promise<Uint8Array> {
        const contents: RawNotebook = {
            cells: []
        }

        contents.cells.push(...data.cells.map(v => ({
            cell_type: v.kind === vscode.NotebookCellKind.Code ? <RawCellType>'code' : <RawCellType>'markdown',
            source: v.value.split(/\r?\n/g)
        })))

        return new TextEncoder().encode(JSON.stringify(contents))
    }
}
