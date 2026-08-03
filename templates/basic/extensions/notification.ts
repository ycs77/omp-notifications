import type { ExtensionAPI } from '@oh-my-pi/pi-coding-agent'
import { release } from 'node:os'
import { resolve } from 'node:path'

type Sound = 'notification' | 'stop'

const PLAY_TIMEOUT_MS = 5_000

function isWsl() {
  return (
    process.platform === 'linux' &&
    (process.env.WSL_DISTRO_NAME !== undefined ||
      process.env.WSL_INTEROP !== undefined ||
      release().toLowerCase().includes('microsoft'))
  )
}

async function executePlayer(pi: ExtensionAPI, command: string, args: string[]) {
  const result = await pi.exec(command, args, { timeout: PLAY_TIMEOUT_MS })

  if (result.code === 0) return

  const reason = result.stderr.trim() || result.stdout.trim() || `exit code ${result.code}`
  throw new Error(`Failed to play notification sound with ${command}: ${reason}`)
}

async function playSound(pi: ExtensionAPI, sound: Sound) {
  const audioPath = resolve(import.meta.dirname, '..', 'audios', `${sound}.wav`)

  switch (process.platform) {
    case 'win32': {
      const escapedAudioPath = audioPath.replaceAll("'", "''")
      const script = `[System.Media.SoundPlayer]::new((Resolve-Path -LiteralPath ('${escapedAudioPath}' -replace '^/([a-zA-Z])/', '\\$1:/')).ProviderPath).PlaySync()`

      await executePlayer(pi, 'powershell.exe', ['-NoProfile', '-Command', script])
      return
    }
    case 'darwin':
      await executePlayer(pi, 'afplay', [audioPath])
      return
    case 'linux':
      await executePlayer(pi, isWsl() ? 'paplay' : 'aplay', [audioPath])
      return
    default:
      throw new Error(`Unsupported platform for notification sounds: ${process.platform}`)
  }
}

export default function (pi: ExtensionAPI) {
  pi.on('session_stop', async () => {
    await playSound(pi, 'stop')
  })

  pi.on('tool_approval_requested', async () => {
    await playSound(pi, 'notification')
  })

  pi.on('tool_execution_start', async event => {
    if (event.toolName === 'ask') {
      await playSound(pi, 'notification')
    }
  })

  pi.events.on('permission_request', async () => {
    await playSound(pi, 'notification')
  })
}
