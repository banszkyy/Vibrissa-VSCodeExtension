import * as https from 'https'
import * as fs from 'fs'
import * as path from 'path'
import AdmZip from 'adm-zip'
import * as vscode from 'vscode'
import * as utils from './utils'
import { log } from './extension'
import { LatestRelease, LatestReleaseAsset } from './github-api-schemas'
import { globalStateChanged } from './language-client'

const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

export interface FetchUpdateResult {
    status: FetchUpdateStatus
    release: null | LatestRelease
}

export enum FetchUpdateStatus {
    Nonexistent,
    NewVersion,
    UpToDate,
    Untracked,
}

export type UpdateOptions = {
    id: string
    githubUsername: string
    githubRepository: string
    githubAssetName: string
    executableFilename: string
    pathConfigKey: string
}

async function getLatestRelease(options: UpdateOptions, token: vscode.CancellationToken | null = null): Promise<LatestRelease> {
    const res = await utils.download(https, {
        hostname: 'api.github.com',
        path: `/repos/${options.githubUsername}/${options.githubRepository}/releases/latest`,
        headers: {
            'user-agent': userAgent
        }
    }, token)
    return await utils.downloadJson<LatestRelease>(res, token)
}

export async function checkForUpdates(context: vscode.ExtensionContext, options: UpdateOptions, progress: vscode.Progress<{ message?: string | undefined; increment?: number | undefined }> | null = null, token: vscode.CancellationToken | null = null): Promise<FetchUpdateResult> {
    const targetDirectory = path.join(context.globalStorageUri.fsPath, 'bin')

    log.trace(`[Updater] Checking updates for ${options.id} ...`)

    checkIfExists: {
        if (fs.existsSync(targetDirectory)) {
            for (const element of fs.readdirSync(targetDirectory, { encoding: 'utf8', recursive: false })) {
                if (element.startsWith(`${options.id}-`)) {
                    break checkIfExists
                }
            }
        }

        log.trace(`[Updater] Directory \"${targetDirectory}\" doesn't exists`)
        return {
            status: FetchUpdateStatus.Nonexistent,
            release: null,
        }
    }

    progress?.report({ message: 'Fetching latest release info' })
    log.trace(`[Updater] Getting latest release from "${options.githubRepository}"`)
    const latest = await getLatestRelease(options, token)

    log.trace(`[Updater]`, latest)

    let latestAsset: LatestReleaseAsset | null = null
    for (const asset of latest.assets) {
        if (asset.name === options.githubAssetName) {
            latestAsset = asset
        }
    }

    if (!latestAsset) {
        log.warn(`[Updater] Asset "${options.githubAssetName}" doesn't exists in the latest release`)
        throw new Error(`Asset "${options.githubAssetName}" doesn't exists in the latest release`)
    }

    log.trace(`[Updater]`, latestAsset)

    const actualTargetDirectory = path.join(context.globalStorageUri.fsPath, 'bin', `${options.id}-${latest.id}`)
    if (fs.existsSync(actualTargetDirectory)) {
        log.trace(`[Updater]`, `Directory \"${actualTargetDirectory}\" exists`)
        return {
            status: FetchUpdateStatus.UpToDate,
            release: latest,
        }
    } else {
        log.trace(`[Updater]`, `Directory \"${actualTargetDirectory}\" doesn't exists`)
        return {
            status: FetchUpdateStatus.NewVersion,
            release: latest,
        }
    }
}

export function gc(context: vscode.ExtensionContext) {
    const tempDirectory = path.join(context.globalStorageUri.fsPath, 'temp')
    if (!fs.existsSync(tempDirectory)) return
    log.trace(`[Updater] Removing directory \"${tempDirectory}\"`)
    fs.rmSync(tempDirectory, { force: true, recursive: true })
}

export async function update(context: vscode.ExtensionContext, options: UpdateOptions, progress: vscode.Progress<{ message?: string | undefined; increment?: number | undefined }> | null = null, token: vscode.CancellationToken | null = null) {
    log.debug(`[Updater] Updating ${options.id}`)

    progress?.report({ message: 'Fetching latest release info' })
    log.trace(`[Updater] Getting latest release from "${options.githubRepository}"`)
    const latest = await getLatestRelease(options, token)

    log.trace(`[Updater]\n${JSON.stringify(latest, null, ' ')}`)

    let latestAsset: LatestReleaseAsset | null = null
    for (const asset of latest.assets) {
        if (asset.name === options.githubAssetName) {
            latestAsset = asset
            break
        }
    }

    if (!latestAsset) {
        log.warn(`[Updater] Asset "${options.githubAssetName}" doesn't exists in the latest release`)
        throw new Error(`Asset "${options.githubAssetName}" doesn't exists in the latest release`)
    }

    log.trace(`[Updater]\n${JSON.stringify(latestAsset, null, ' ')}`)

    const tempDirectory = path.join(context.globalStorageUri.fsPath, 'temp', utils.getNonce())
    const targetDirectory = path.join(context.globalStorageUri.fsPath, 'bin', `${options.id}-${latest.id}`)

    if (fs.existsSync(targetDirectory)) {
        log.warn(`[Updater] Directory "${targetDirectory}" already exists`)
        throw new Error(`Already exists`)
    }

    progress?.report({ message: 'Preparing' })

    fs.mkdirSync(tempDirectory, { recursive: true })
    fs.mkdirSync(targetDirectory, { recursive: true })

    const downloadFilename = path.join(tempDirectory, latestAsset.name)

    log.trace(`[Updater] Opening file \"${downloadFilename}\" for writing`)
    const file = fs.createWriteStream(downloadFilename)
    if (file.errored) {
        log.error(`[Updater]`, file.errored)
        throw new Error(`Stream writer for file "${downloadFilename}" failed to create`)
    }

    progress?.report({ message: 'Downloading release asset' })
    log.trace(`[Updater] Downloading file from \"${latestAsset.browser_download_url}\"`)
    const assetRes = await utils.download(https, latestAsset.browser_download_url, token)
    log.trace(`[Updater] ${assetRes.statusCode} ${assetRes.statusMessage}`)
    await utils.downloadFile(assetRes, file, (percent) => {
        progress?.report({ message: 'Downloading release asset', increment: percent * 100 })
    })

    progress?.report({ message: 'Extracting' })
    log.trace(`[Updater] Extracting \"${downloadFilename}\" to \"${targetDirectory}\"`)
    const zip = new AdmZip(downloadFilename)
    await zip.extractAllToAsync(targetDirectory, true, true)

    if (fs.statSync(targetDirectory).isFile()) {
        context.globalState.update(`pathto-${options.id}`, targetDirectory)
        log.trace(`[Updater] Setting "pathto-${options.id}" to "${targetDirectory}"`)
        globalStateChanged.fire(`pathto-${options.id}`)
    } else {
        context.globalState.update(`pathto-${options.id}`, path.join(targetDirectory, options.executableFilename))
        log.trace(`[Updater] Setting "pathto-${options.id}" to "${path.join(targetDirectory, options.executableFilename)}"`)
        globalStateChanged.fire(`pathto-${options.id}`)
    }

    log.trace(`[Updater] Done`)
}
