export function usePageLoader() {
  const visible = useState<boolean>('pageLoader:visible', () => false)
  const progress = useState<number>('pageLoader:progress', () => 0)

  // internal bookkeeping
  const token = useState<number>('pageLoader:token', () => 0)
  const startedAt = useState<number>('pageLoader:startedAt', () => 0)
  const shownAt = useState<number>('pageLoader:shownAt', () => 0)

  return {
    visible,
    progress,
    token,
    startedAt,
    shownAt
  }
}
