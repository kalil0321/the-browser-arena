import { ConvexHttpClient } from 'convex/browser'

export class ConvexBackendClient {
  private client: any

  constructor(url: string) {
    this.client = new ConvexHttpClient(url) as any
  }

  async createAgentFromBackend(args: {
    sessionId: string
    name: string
    model?: string
    browser: { sessionId: string; url: string }
  }): Promise<string> {
    const id = await this.client.mutation('mutations:createAgentFromBackend', args)
    return id as unknown as string
  }

  async updateAgentStatusRunning(agentId: string): Promise<void> {
    await this.client.mutation('mutations:updateAgentStatusFromBackend', {
      agentId,
      status: 'running',
    })
  }

  async updateAgentBrowserUrl(agentId: string, url: string): Promise<void> {
    await this.client.mutation('mutations:updateAgentBrowserUrlFromBackend', {
      agentId,
      url,
    })
  }

  async updateAgentResult(agentId: string, result: any, status?: 'completed' | 'failed'): Promise<void> {
    await this.client.mutation('mutations:updateAgentResultFromBackend', {
      agentId,
      result,
      ...(status ? { status } : {}),
    })
  }

  async updateAgentStatusFailed(agentId: string, error: string): Promise<void> {
    await this.client.mutation('mutations:updateAgentStatusFromBackend', {
      agentId,
      status: 'failed',
      error,
    })
  }
}

export function getConvexBackendClient(): ConvexBackendClient {
  const url = process.env.CONVEX_URL || ''
  if (!url) throw new Error('Missing CONVEX_URL')
  return new ConvexBackendClient(url)
}


