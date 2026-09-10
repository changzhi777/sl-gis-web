/**
 * nano-api 门户接口封装（公开端点 · 免鉴权）
 * 直连线上 API（小程序无 CORS；H5 由后端 CORS 放行）
 * 失败一律 resolve(null)，由页面回落本地 mock
 */
const BASE = 'https://nanoai.fun/api'

interface ApiResp<T> {
  code: number
  msg: string
  data: T
}

function request<T>(options: UniNamespace.RequestOptions): Promise<T | null> {
  return new Promise((resolve) => {
    uni.request({
      ...options,
      url: `${BASE}${options.url}`,
      timeout: 8000,
      success: (res) => {
        const j = res.data as ApiResp<T> | null
        resolve(j && j.code === 0 ? j.data : null)
      },
      fail: () => resolve(null),
    })
  })
}

export function apiGet<T>(path: string): Promise<T | null> {
  return request<T>({ url: path, method: 'GET' })
}

export function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T | null> {
  return request<T>({ url: path, method: 'POST', data: body, header: { 'Content-Type': 'application/json' } })
}

/** 公告 / 账单 / 报修响应形状 */
export interface NoticeRow {
  id: number
  title: string
  type: string
  content: string
  su_mu: string | null
  channel: string
  created: string
}

export interface BillRow {
  account: string
  owner: string
  month: string
  usage_t: number
  amount: number
  paid: boolean
  paid_at: string | null
}

export interface RepairRow {
  ticket: string
  category: string
  location: string
  description: string | null
  status: string
  created: string
}
