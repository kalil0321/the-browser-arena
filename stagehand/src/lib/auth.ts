import type { Request, Response, NextFunction } from 'express'

export function bearerAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers['authorization'] || ''
  const token = typeof header === 'string' && header.startsWith('Bearer ')
    ? header.slice('Bearer '.length)
    : ''

  const expected = process.env.AGENT_SERVER_API_KEY || ''
  if (!expected) {
    res.status(500).json({ error: 'Server misconfigured: missing AGENT_SERVER_API_KEY' })
    return
  }

  if (!token || token !== expected) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  next()
}


