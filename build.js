#!/usr/bin/env node

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const REGISTRY_PATH = join(ROOT, 'notifications.json')
const TEMPLATE_DIR = join(ROOT, 'templates', 'basic')
const AUDIO_TEMPLATE_DIR = join(ROOT, 'templates', 'audios')
const PLUGINS_DIR = join(ROOT, 'plugins')
const MARKETPLACE_PATH = join(ROOT, '.omp-plugin', 'marketplace.json')
const README_PATH = join(ROOT, 'README.md')
const DESCRIPTION = '在 OMP 要求權限、提問或停止時，自動播放提示音通知用戶'
const AUDIO_FILES = ['notification.wav', 'stop.wav']
const NO_PRUNE = process.argv.slice(2).includes('--no-prune')

function render(template, variables) {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    if (!(key in variables)) {
      throw new Error(`模板缺少變數：${key}`)
    }

    return String(variables[key])
  })
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function validateContact(contact, path) {
  if (!contact || typeof contact.name !== 'string' || typeof contact.email !== 'string') {
    throw new Error(`${path} 必須包含 name 與 email 字串`)
  }
}

function validateRegistry(registry) {
  if (!registry || typeof registry !== 'object') {
    throw new Error('notifications.json 必須是 JSON 物件')
  }

  if (typeof registry.version !== 'string' || !registry.version) {
    throw new Error('notifications.json 缺少 version')
  }

  validateContact(registry.owner, 'notifications.json 的 owner')

  if (
    !registry.marketplace ||
    typeof registry.marketplace.name !== 'string' ||
    typeof registry.marketplace.description !== 'string'
  ) {
    throw new Error('notifications.json 的 marketplace 必須包含 name 與 description 字串')
  }

  if (!Array.isArray(registry.plugins) || registry.plugins.length === 0) {
    throw new Error('notifications.json 的 plugins 必須是非空陣列')
  }

  const ids = new Set()
  for (const plugin of registry.plugins) {
    if (
      !plugin ||
      typeof plugin.id !== 'string' ||
      !/^[a-z0-9][a-z0-9-]*$/.test(plugin.id) ||
      typeof plugin.name !== 'string' ||
      !plugin.name
    ) {
      throw new Error('每個 plugin 都必須有小寫英數連字號 id 與非空 name')
    }

    if (ids.has(plugin.id)) {
      throw new Error(`plugin id 重複：${plugin.id}`)
    }

    if (plugin.author !== undefined) {
      validateContact(plugin.author, `plugin ${plugin.id} 的 author`)
    }

    ids.add(plugin.id)
  }
}

function requireFile(path) {
  if (!existsSync(path)) {
    throw new Error(`缺少必要檔案：${path}`)
  }
}

function updateReadmePlugins(tableText) {
  const readme = readFileSync(README_PATH, 'utf8')
  const marker = /(<!-- plugins:start -->)[\s\S]*?(<!-- plugins:end -->)/

  if (!marker.test(readme)) {
    throw new Error('README.md 缺少 <!-- plugins:start --> / <!-- plugins:end --> 標記')
  }

  writeFileSync(README_PATH, readme.replace(marker, `$1\n${tableText}\n$2`))
}

function buildPlugin(plugin, registry) {
  const target = join(PLUGINS_DIR, plugin.id)
  const author = plugin.author ?? registry.owner
  const variables = {
    id: plugin.id,
    version: registry.version,
    name: plugin.name,
    description: DESCRIPTION,
    authorName: author.name,
    authorEmail: author.email,
  }

  rmSync(target, { recursive: true, force: true })
  cpSync(TEMPLATE_DIR, target, { recursive: true })
  mkdirSync(join(target, 'audios'), { recursive: true })

  const packageTemplatePath = join(target, 'package.json.tmpl')
  const readmeTemplatePath = join(target, 'README.md.tmpl')
  writeJson(
    packageTemplatePath.replace(/\.tmpl$/, ''),
    JSON.parse(render(readFileSync(packageTemplatePath, 'utf8'), variables)),
  )
  writeFileSync(
    readmeTemplatePath.replace(/\.tmpl$/, ''),
    render(readFileSync(readmeTemplatePath, 'utf8'), variables),
  )
  rmSync(packageTemplatePath)
  rmSync(readmeTemplatePath)

  for (const audioFile of AUDIO_FILES) {
    cpSync(join(AUDIO_TEMPLATE_DIR, plugin.id, audioFile), join(target, 'audios', audioFile))
  }

  console.log(`✅ plugins/${plugin.id}`)
}

function main() {
  const registry = readJson(REGISTRY_PATH)
  validateRegistry(registry)

  requireFile(join(TEMPLATE_DIR, 'package.json.tmpl'))
  requireFile(join(TEMPLATE_DIR, 'README.md.tmpl'))
  requireFile(join(TEMPLATE_DIR, 'extensions', 'notification.ts'))
  for (const plugin of registry.plugins) {
    for (const audioFile of AUDIO_FILES) {
      requireFile(join(AUDIO_TEMPLATE_DIR, plugin.id, audioFile))
    }
  }

  const expectedPluginIds = new Set(registry.plugins.map(plugin => plugin.id))

  if (!NO_PRUNE && existsSync(PLUGINS_DIR)) {
    for (const entry of readdirSync(PLUGINS_DIR)) {
      const path = join(PLUGINS_DIR, entry)
      if (!statSync(path).isDirectory() || expectedPluginIds.has(entry)) continue

      rmSync(path, { recursive: true, force: true })
      console.log(`❎ 清理：plugins/${entry}`)
    }
  }

  for (const plugin of registry.plugins) {
    buildPlugin(plugin, registry)
  }

  const marketplacePlugins = registry.plugins.map(plugin => ({
    name: `notification-${plugin.id}`,
    description: `${plugin.name} - ${DESCRIPTION}`,
    version: registry.version,
    source: `./plugins/${plugin.id}`,
    category: 'development',
  }))
  writeJson(MARKETPLACE_PATH, {
    ...registry.marketplace,
    owner: registry.owner,
    plugins: marketplacePlugins,
  })
  console.log('✅ .omp-plugin/marketplace.json')

  const listText = registry.plugins
    .map(plugin => `- [${plugin.name}](./plugins/${plugin.id})`)
    .join('\n')
  updateReadmePlugins(listText)
  console.log('✅ README.md')

  console.log(`\n完成：${marketplacePlugins.length} 個插件建立完畢`)
}

main()
