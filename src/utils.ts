import * as fs from 'fs'
import * as vscode from 'vscode'

export const extensionId = 'vibrissa'
export const languageId = 'vibrissa'
export const languageExtension = '.vi'

export function isVirtualWorkspace(): boolean {
    return !!vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.every(f => f.uri.scheme !== 'file')
}

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

export function getNonce(length = 32): string {
    let text = ''
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    for (let i = 0; i < length; i++) { text += possible.charAt(Math.floor(Math.random() * possible.length)) }
    return text
}

export class HttpError extends Error {
    readonly Code: number
    readonly StatusMessage?: string

    constructor(code: number, statusMessage?: string) {
        super(statusMessage ? `HTTP ${code} ("${statusMessage}")` : `HTTP ${code}`)
        this.Code = code
        this.StatusMessage = statusMessage
    }
}

export function download(lib: typeof import('http') | typeof import('https'), req: string | import('http').RequestOptions | URL, token: vscode.CancellationToken | null = null): Promise<import('http').IncomingMessage> {
    return new Promise((resolve, reject) => {
        const _req = lib.get(req, res => {
            if (res.statusCode && res.statusCode >= 400 && res.statusCode < 600) {
                reject(new HttpError(res.statusCode, res.statusMessage))
                return
            }

            if (res.headers.location) {
                const redirectUrl = new URL(res.headers.location)

                if (typeof req === 'string') {
                    req = redirectUrl.toString()
                } else if (req instanceof URL) {
                    req = redirectUrl
                } else {
                    req.host = redirectUrl.host
                    req.hostname = redirectUrl.hostname
                    req.path = redirectUrl.pathname
                    req.port = redirectUrl.port
                    req.protocol = redirectUrl.protocol
                }

                download(lib, req).then(resolve).catch(reject)
                return
            }

            resolve(res)

            res.on('error', reject)
        })
        _req.on('error', reject)
        token?.onCancellationRequested(() => {
            _req.destroy(new Error(`Task cancelled`))
        })
    })
}

export function downloadText(res: import('http').IncomingMessage, token: vscode.CancellationToken | null = null): Promise<string> {
    return new Promise(resolve => {
        let data = ''
        res.on('data', (chunk: Buffer) => { data += chunk.toString() })
        res.on('end', () => resolve(data))
        token?.onCancellationRequested(() => {
            res.destroy()
            resolve(data)
        })
    })
}

export function downloadJson<T>(res: import('http').IncomingMessage, token: vscode.CancellationToken | null = null): Promise<T> {
    return new Promise(resolve => {
        let data = ''
        res.on('data', (chunk: Buffer) => { data += chunk.toString() })
        res.on('end', () => resolve(<T>JSON.parse(data)))
        token?.onCancellationRequested(() => {
            res.destroy()
            resolve(<T>undefined)
        })
    })
}

export function downloadFile<T extends NodeJS.WritableStream>(res: import('http').IncomingMessage, output: T, progress: (increment: number) => void, token: vscode.CancellationToken | null = null): Promise<void> {
    return new Promise<void>(resolve => {
        progress(0)
        res.pipe(output)

        const totalBytes = Number.parseInt(res.headers['content-length'] ?? '0', 10)
        let downloadedBytes = 0
        let lastDownloadedBytes = 0
        if (totalBytes > 0) {
            res.on('data', (data: Buffer) => {
                downloadedBytes += data.length
                progress((downloadedBytes - lastDownloadedBytes) / totalBytes)
                lastDownloadedBytes = downloadedBytes
            })
        }

        res.on('end', () => {
            progress(1)
            resolve()
        })

        token?.onCancellationRequested(() => {
            res.destroy()
            resolve()
        })
    })
}

export function tryGetJson<T>(_path: string): T | null {
    if (!fs.existsSync(_path)) {
        return null
    }
    const content = fs.readFileSync(_path, 'utf8')
    return JSON.parse(content)
}
