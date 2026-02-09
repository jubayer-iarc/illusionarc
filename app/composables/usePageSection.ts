// app/composables/usePageSection.ts
export function usePageSection<T>(page: string, sectionKey: string, fallback: T) {
  const supabase = useSupabaseClient()
  const key = `section:${page}:${sectionKey}`

  const data = useState<T>(key, () => fallback)

  async function refresh() {
    const { data: row, error } = await supabase
      .from('page_sections')
      .select('data')
      .eq('page', page)
      .eq('section_key', sectionKey)
      .eq('is_published', true)
      .single()

    if (!error && row?.data) data.value = row.data as T
  }

  return { data, refresh }
}
