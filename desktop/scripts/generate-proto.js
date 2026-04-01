/**
 * generate-proto.js
 *
 * Copies the shared proto file into the desktop build's extraResources so it
 * is bundled into the packaged Electron app and can be loaded at runtime by
 * protobufjs in the main process.
 *
 * Run via: npm run generate-proto
 */

const fs   = require('fs')
const path = require('path')

const SRC  = path.resolve(__dirname, '..', '..', 'proto', 'locktime', 'locktime.proto')
const DEST = path.resolve(__dirname, '..', 'resources', 'proto', 'locktime', 'locktime.proto')

fs.mkdirSync(path.dirname(DEST), { recursive: true })
fs.copyFileSync(SRC, DEST)

console.log(`[generate-proto] Copied locktime.proto → ${DEST}`)
