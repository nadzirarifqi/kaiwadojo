// scripts/copy_api_to_dist.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const apiSrc = path.join(rootDir, 'api')
const apiDest = path.join(rootDir, 'dist', 'api')

if (fs.existsSync(apiSrc) && fs.existsSync(path.join(rootDir, 'dist'))) {
  fs.cpSync(apiSrc, apiDest, { recursive: true })
  console.log('✓ Successfully copied api/ directory into dist/api for CyberPanel deployment!')
}
