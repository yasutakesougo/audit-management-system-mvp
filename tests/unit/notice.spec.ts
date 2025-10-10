import { describe, expect, it } from 'vitest'

import { withUserMessage } from '@/lib/notice'

describe('withUserMessage', () => {
  it('uses specific user message when error matches rule', () => {
    const timeoutError = { message: 'Request timeout', code: 'Timeout' }

    const noticed = withUserMessage(timeoutError, 'ignored')

    expect(noticed.userMessage).toBe('ネットワークの状態を確認して、再度お試しください。')
    expect(noticed.message).toBe('Request timeout')
  })

  it('falls back to provided message when no rule matches', () => {
    const genericError = { message: '', code: 'E_UNKNOWN' }

    const noticed = withUserMessage(genericError, 'custom message')

    expect(noticed.userMessage).toBe('custom message')
    expect(noticed.message).toBe('操作に失敗しました。時間をおいて再度お試しください。')
  })
})
