import * as vscode from 'vscode'
import { LanguageClient, State, ResponseError, LSPErrorCodes, RequestType, Range } from 'vscode-languageclient/node'
import { log } from './extension'

export interface AllocationItem {
  range: Range
  kind: 'box' | 'closure' | 'string'
}
export interface AllocationsParams {
  textDocument: { uri: string }
}
export interface AllocationsResult {
  version: number
  items: AllocationItem[]
}

export const AllocationsRequest =
  new RequestType<AllocationsParams, AllocationsResult, void>('meow/decorations')

type Kind = AllocationItem['kind']

interface DocState {
  timer?: NodeJS.Timeout
  cts?: vscode.CancellationTokenSource
  result?: AllocationsResult
}

const DEBOUNCE_MS = 250

export class AllocationDecorations implements vscode.Disposable {
  private readonly types = new Map<Kind, vscode.TextEditorDecorationType>();
  private readonly docs = new Map<string, DocState>();
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly client: LanguageClient, private readonly languageIds: ReadonlySet<string>) {
    const icons = {
      'box': '\uec41',
      'closure': '\uec41',
      'string': '\uec41',
      // ehhhhhhhh...... meow
    }
    for (const kind of ['box', 'closure', 'string'] as const) {
      this.types.set(kind, vscode.window.createTextEditorDecorationType({
        after: {
          margin: '0 0 0 0.25em',
          width: '1em',
          height: '1em',
          contentText: icons[kind],
          color: new vscode.ThemeColor('editorCodeLens.foreground'),
          textDecoration: 'none; font-family: codicon; font-size: 1em; vertical-align: middle; display: inline !important',
          border: 'none',
        },
      }))
    }

    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(e => this.schedule(e.document)),
      vscode.window.onDidChangeVisibleTextEditors(eds => {
        for (const ed of eds) {
          this.apply(ed)
          if (!this.docs.get(ed.document.uri.toString())?.result) this.schedule(ed.document, 0)
        }
      }),
      vscode.workspace.onDidCloseTextDocument(d => this.forget(d.uri.toString())),
      client.onDidChangeState(e => {
        if (e.newState === State.Running) this.refreshVisible()
        else this.resetAll()
      }),
    )

    if (client.state === State.Running) this.refreshVisible()
  }

  private schedule(document: vscode.TextDocument, delay = DEBOUNCE_MS) {
    if (!this.languageIds.has(document.languageId)) return
    const key = document.uri.toString()
    const state = this.state(key)

    clearTimeout(state.timer)
    state.cts?.cancel()

    state.timer = setTimeout(() => void this.refresh(document), delay)
  }

  private refreshVisible() {
    for (const editor of vscode.window.visibleTextEditors) this.schedule(editor.document, 0)
  }

  private async refresh(document: vscode.TextDocument): Promise<void> {
    if (this.client.state !== State.Running) return
    const key = document.uri.toString()
    const state = this.state(key)

    state.cts?.dispose()
    const cts = (state.cts = new vscode.CancellationTokenSource())

    try {
      const res = await this.client.sendRequest(
        AllocationsRequest,
        { textDocument: { uri: key } },
        cts.token,
      )
      if (cts.token.isCancellationRequested) return

      if (res.version !== document.version) {
        this.schedule(document)
        return
      }
      state.result = res
      for (const editor of vscode.window.visibleTextEditors) {
        if (editor.document.uri.toString() === key) this.apply(editor)
      }
    } catch (error) {
      if (error instanceof ResponseError &&
        (error.code === LSPErrorCodes.ContentModified || error.code === LSPErrorCodes.RequestCancelled)) {
        if (!cts.token.isCancellationRequested) this.schedule(document)
        return
      }
      log.error('Decorations failed', error)
    }
  }

  private apply(editor: vscode.TextEditor) {
    const res = this.docs.get(editor.document.uri.toString())?.result
    const byKind = new Map<Kind, vscode.DecorationOptions[]>()
    for (const item of res?.items ?? []) {
      const range = this.client.protocol2CodeConverter.asRange(item.range)
      const at = new vscode.Range(range.end, range.end)
      let list = byKind.get(item.kind)
      if (!list) byKind.set(item.kind, (list = []))
      list.push({ range: at })
    }
    for (const [kind, type] of this.types) {
      editor.setDecorations(type, byKind.get(kind) ?? [])
    }
  }

  private state(key: string): DocState {
    let s = this.docs.get(key)
    if (!s) this.docs.set(key, (s = {}))
    return s
  }

  private forget(key: string) {
    const s = this.docs.get(key)
    if (!s) return
    clearTimeout(s.timer)
    s.cts?.cancel()
    s.cts?.dispose()
    this.docs.delete(key)
  }

  private resetAll() {
    for (const key of [...this.docs.keys()]) this.forget(key)
    for (const editor of vscode.window.visibleTextEditors) this.apply(editor)
  }

  dispose() {
    this.resetAll()
    this.types.forEach(t => t.dispose())
    this.disposables.forEach(d => d.dispose())
  }
}
