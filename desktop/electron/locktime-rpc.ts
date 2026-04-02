/**
 * locktime-rpc.ts
 *
 * Typed iBridger RPC client for the LockTime C++ backend.
 * Runs in the Electron main process (Node.js) — never in the renderer.
 *
 * Transport:
 *   Windows → Named pipe  \\.\pipe\locktime-svc
 *   macOS   → Unix socket /tmp/locktime-svc.sock
 *
 * Proto types are generated at build time via `npm run generate-proto`
 * (scripts/generate-proto.js → electron/generated/locktime_pb.{js,d.ts}).
 * No .proto file loading at runtime — all encode/decode is static.
 */

import { IBridgerClient } from '@lambertse/ibridger'
import * as pb from '../src/generated/locktime_pb'
import { log } from './logger'

// ─── Transport endpoint ───────────────────────────────────────────────────────

export const RPC_ENDPOINT =
  process.platform === 'win32' ? '\\\\.\\pipe\\locktime-svc' : '/tmp/locktime-svc.sock'

// ─── Client class ─────────────────────────────────────────────────────────────

const SVC = 'locktime.rpc.LockTimeService'

export class LockTimeRPCClient {
  private client: IBridgerClient

  constructor(endpoint: string = RPC_ENDPOINT) {
    this.client = new IBridgerClient(
      { endpoint },
      {
        baseDelayMs: 200,
        maxDelayMs: 10_000,
        maxAttempts: Infinity,
        onReconnect: () => log.info('RPC client reconnected'),
      },
    )
    this.client.onDisconnect = () => {
      log.warn('RPC client disconnected — will reconnect automatically')
    }
    log.info(`RPC client created — endpoint: ${endpoint}`)
  }

  async connect(): Promise<void> {
    await this.client.connect()
  }

  disconnect(): void {
    this.client.disconnect()
  }

  get isConnected(): boolean {
    return this.client.isConnected
  }

  // ─── Internal helper ─────────────────────────────────────────────────────
  // ReqClass / RespClass are generated static protobufjs classes.
  // They expose verify(), create(), encode(), decode() as static methods.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async call<Resp>(
    method: string,
    ReqClass: any,
    RespClass: any,
    request: object,
  ): Promise<Resp> {
    const errMsg = ReqClass.verify(request) as string | null
    if (errMsg) throw new Error(`Invalid request for ${method}: ${errMsg}`)
    const reqMsg = ReqClass.create(request)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const respMsg = await this.client.call(SVC, method, reqMsg, ReqClass, RespClass)
    return respMsg as Resp
  }

  // ─── Status ──────────────────────────────────────────────────────────────

  getStatus() {
    return this.call<pb.locktime.rpc.IGetStatusResponse>(
      'GetStatus',
      pb.locktime.rpc.GetStatusRequest,
      pb.locktime.rpc.GetStatusResponse,
      {},
    )
  }

  // ─── Rules ───────────────────────────────────────────────────────────────

  listRules() {
    return this.call<pb.locktime.rpc.IListRulesResponse>(
      'ListRules',
      pb.locktime.rpc.ListRulesRequest,
      pb.locktime.rpc.ListRulesResponse,
      {},
    )
  }

  getRule(id: string) {
    return this.call<pb.locktime.rpc.IGetRuleResponse>(
      'GetRule',
      pb.locktime.rpc.GetRuleRequest,
      pb.locktime.rpc.GetRuleResponse,
      { id },
    )
  }

  createRule(req: pb.locktime.rpc.ICreateRuleRequest) {
    return this.call<pb.locktime.rpc.ICreateRuleResponse>(
      'CreateRule',
      pb.locktime.rpc.CreateRuleRequest,
      pb.locktime.rpc.CreateRuleResponse,
      req,
    )
  }

  updateRule(req: pb.locktime.rpc.IUpdateRuleRequest) {
    return this.call<pb.locktime.rpc.IUpdateRuleResponse>(
      'UpdateRule',
      pb.locktime.rpc.UpdateRuleRequest,
      pb.locktime.rpc.UpdateRuleResponse,
      req,
    )
  }

  patchRule(req: pb.locktime.rpc.IPatchRuleRequest) {
    console.log('Patching rule:', req)
    return this.call<pb.locktime.rpc.IPatchRuleResponse>(
      'PatchRule',
      pb.locktime.rpc.PatchRuleRequest,
      pb.locktime.rpc.PatchRuleResponse,
      req,
    )
  }

  deleteRule(id: string) {
    return this.call<pb.locktime.rpc.IDeleteRuleResponse>(
      'DeleteRule',
      pb.locktime.rpc.DeleteRuleRequest,
      pb.locktime.rpc.DeleteRuleResponse,
      { id },
    )
  }

  // ─── Overrides ───────────────────────────────────────────────────────────

  grantOverride(req: pb.locktime.rpc.IGrantOverrideRequest) {
    return this.call<pb.locktime.rpc.IGrantOverrideResponse>(
      'GrantOverride',
      pb.locktime.rpc.GrantOverrideRequest,
      pb.locktime.rpc.GrantOverrideResponse,
      req,
    )
  }

  revokeOverride(ruleId: string) {
    return this.call<pb.locktime.rpc.IRevokeOverrideResponse>(
      'RevokeOverride',
      pb.locktime.rpc.RevokeOverrideRequest,
      pb.locktime.rpc.RevokeOverrideResponse,
      { rule_id: ruleId },
    )
  }

  // ─── Usage ───────────────────────────────────────────────────────────────

  getUsageToday() {
    return this.call<pb.locktime.rpc.IGetUsageTodayResponse>(
      'GetUsageToday',
      pb.locktime.rpc.GetUsageTodayRequest,
      pb.locktime.rpc.GetUsageTodayResponse,
      {},
    )
  }

  getUsageWeek() {
    return this.call<pb.locktime.rpc.IGetUsageWeekResponse>(
      'GetUsageWeek',
      pb.locktime.rpc.GetUsageWeekRequest,
      pb.locktime.rpc.GetUsageWeekResponse,
      {},
    )
  }

  getBlockAttempts(req: pb.locktime.rpc.IGetBlockAttemptsRequest = {}) {
    return this.call<pb.locktime.rpc.IGetBlockAttemptsResponse>(
      'GetBlockAttempts',
      pb.locktime.rpc.GetBlockAttemptsRequest,
      pb.locktime.rpc.GetBlockAttemptsResponse,
      req,
    )
  }

  // ─── System ──────────────────────────────────────────────────────────────

  getProcesses() {
    return this.call<pb.locktime.rpc.IGetProcessesResponse>(
      'GetProcesses',
      pb.locktime.rpc.GetProcessesRequest,
      pb.locktime.rpc.GetProcessesResponse,
      {},
    )
  }

  // ─── Config ──────────────────────────────────────────────────────────────

  getConfig() {
    return this.call<pb.locktime.rpc.IGetConfigResponse>(
      'GetConfig',
      pb.locktime.rpc.GetConfigRequest,
      pb.locktime.rpc.GetConfigResponse,
      {},
    )
  }

  updateConfig(config: Record<string, string>) {
    return this.call<pb.locktime.rpc.IUpdateConfigResponse>(
      'UpdateConfig',
      pb.locktime.rpc.UpdateConfigRequest,
      pb.locktime.rpc.UpdateConfigResponse,
      { config },
    )
  }
}

// ─── Type aliases re-exported for main.ts ────────────────────────────────────
// Generated interfaces use camelCase (matching protobufjs static module output).

export type CreateRuleRequest = pb.locktime.rpc.ICreateRuleRequest
export type UpdateRuleRequest = pb.locktime.rpc.IUpdateRuleRequest
export type PatchRuleRequest = pb.locktime.rpc.IPatchRuleRequest
export type GrantOverrideRequest = pb.locktime.rpc.IGrantOverrideRequest
export type GetBlockAttemptsRequest = pb.locktime.rpc.IGetBlockAttemptsRequest
