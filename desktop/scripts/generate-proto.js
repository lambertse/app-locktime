/**
 * generate-proto.js
 *
 * Tasks:
 *
 * 1. Generates dist/generated/proto.js inside @lambertse/ibridger from the
 *    ibridger wire-protocol proto files.  The published npm package omits this
 *    generated file, so we must produce it locally after every `npm install`.
 *
 * 2. Generates src/generated/locktime_pb.{js,d.ts} from the shared
 *    locktime.proto using --keep-case so field names stay snake_case (matching
 *    the proto file).  This is the single source of truth for all message types:
 *      - electron/locktime-rpc.ts  imports the JS for encode/decode
 *      - src/api/client.ts         uses `import type` for zero-cost type checking
 *    No .proto file loading at runtime and no hand-written type mirrors.
 *
 * Run via: npm run generate-proto
 */

const fs   = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const SRC  = path.resolve(__dirname, '..', '..', 'proto', 'locktime', 'locktime.proto')

const pbjs = path.resolve(__dirname, '..', 'node_modules', '.bin', 'pbjs')
const pbts = path.resolve(__dirname, '..', 'node_modules', '.bin', 'pbts')

if (!fs.existsSync(pbjs)) {
  console.warn('[generate-proto] pbjs not found — skipping proto generation.')
  console.warn('  Run: npm install --no-save protobufjs-cli')
  process.exit(0)
}

// ── Task 1: generate ibridger wire-protocol types ─────────────────────────────

const IBRIDGER_PROTO_DIR = path.resolve(
  __dirname, '..', '..', 'backend', 'build', '_deps', 'ibridger-src', 'proto', 'ibridger'
)
const IBRIDGER_OUT_DIR = path.resolve(
  __dirname, '..', 'node_modules', '@lambertse', 'ibridger', 'dist', 'generated'
)
const PROTO_FILES = ['constants.proto', 'envelope.proto', 'rpc.proto'].map(
  (f) => path.join(IBRIDGER_PROTO_DIR, f)
)

const missingProto = PROTO_FILES.find((f) => !fs.existsSync(f))
if (missingProto) {
  console.warn(`[generate-proto] ibridger proto file not found: ${missingProto}`)
  console.warn('  Run cmake to fetch ibridger before generating protos.')
  process.exit(0)
}

fs.mkdirSync(IBRIDGER_OUT_DIR, { recursive: true })

const outJs = path.join(IBRIDGER_OUT_DIR, 'proto.js')
execFileSync(pbjs, ['-t', 'static-module', '-w', 'commonjs', '-o', outJs, ...PROTO_FILES])
console.log(`[generate-proto] Generated ibridger proto.js → ${outJs}`)

const outDts = path.join(IBRIDGER_OUT_DIR, 'proto.d.ts')
execFileSync(pbts, ['-o', outDts, outJs])
console.log(`[generate-proto] Generated ibridger proto.d.ts → ${outDts}`)

// ── Task 2: generate locktime static types ────────────────────────────────────
// --keep-case preserves proto snake_case field names in JS properties and TS
// interfaces — no camelCase conversion, no mapping glue needed anywhere.
// Output goes to src/generated/ so both the electron main process and the
// renderer can reference it (renderer uses `import type`, zero runtime cost).

const LOCKTIME_OUT_DIR = path.resolve(__dirname, '..', 'src', 'generated')
fs.mkdirSync(LOCKTIME_OUT_DIR, { recursive: true })

const locktimeJs = path.join(LOCKTIME_OUT_DIR, 'locktime_pb.js')
execFileSync(pbjs, ['-t', 'static-module', '-w', 'commonjs', '--keep-case', '-o', locktimeJs, SRC])
console.log(`[generate-proto] Generated locktime_pb.js → ${locktimeJs}`)

const locktimeDts = path.join(LOCKTIME_OUT_DIR, 'locktime_pb.d.ts')
execFileSync(pbts, ['-o', locktimeDts, locktimeJs])
console.log(`[generate-proto] Generated locktime_pb.d.ts → ${locktimeDts}`)
