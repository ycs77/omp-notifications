import type { ExtensionAPI } from '@oh-my-pi/pi-coding-agent'
import { appendFile } from 'node:fs/promises'
import { join } from 'node:path'

export default function exampleExtension(pi: ExtensionAPI) {
  pi.on('session_stop', async (_event, ctx) => {
    const logPath = join(ctx.cwd, 'example.log')
    const logLine = `${new Date().toISOString()} agent stopped\n`

    await appendFile(logPath, logLine, 'utf8')
  })
}
