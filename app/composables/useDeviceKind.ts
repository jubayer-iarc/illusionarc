export type DeviceKind = 'mobile' | 'desktop'

export function useDeviceKind(breakpointPx = 768) {
    const kind = useState<DeviceKind>('ui:deviceKind', () => 'desktop')
    const ready = useState<boolean>('ui:deviceKindReady', () => false)

    if (import.meta.client) {
        const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`)

        const apply = () => {
            kind.value = mq.matches ? 'mobile' : 'desktop'
            ready.value = true
        }

        // run once
        apply()

        // listen changes
        const onChange = () => apply()
        mq.addEventListener?.('change', onChange)

        onBeforeUnmount(() => {
            mq.removeEventListener?.('change', onChange)
        })
    }

    return { kind, ready }
}