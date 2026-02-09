// app/composables/useSiteSettings.ts
export type NavItem = { label: string; to: string; enabled?: boolean }
export type LinkItem = { label: string; to: string }

export type SiteSettings = {
  brand_name: string
  brand_logo_url: string
  header_nav: NavItem[]
  footer_links: LinkItem[]
  footer_legal: LinkItem[]
  footer_tagline: string
}

const FALLBACK: SiteSettings = {
  brand_name: 'illusion Arc',
  brand_logo_url: '/android-chrome-512x512.png',
  header_nav: [
    { label: 'Work', to: '/work', enabled: true },
    { label: 'Services', to: '/services', enabled: true },
    { label: 'Arcade', to: '/arcade', enabled: true },
    { label: 'Tournaments', to: '/tournaments', enabled: true },
    { label: 'Apps', to: '/apps', enabled: true },
    { label: 'About', to: '/about', enabled: true },
    { label: 'Leaderboard', to: '/arcade/leaderboard', enabled: true },
    { label: 'Winners', to: '/arcade/winners', enabled: true }
  ],
  footer_links: [
    { label: 'Work', to: '/work' },
    { label: 'Arcade', to: '/arcade' },
    { label: 'Tournaments', to: '/tournaments' },
    { label: 'Contact', to: '/contact' }
  ],
  footer_legal: [
    { label: 'Privacy Policy', to: '/privacy-policy' },
    { label: 'Terms & Conditions', to: '/terms' }
  ],
  footer_tagline: 'Games • AR/VR • VFX/CGI • Animation'
}

export function useSiteSettings() {
  const supabase = useSupabaseClient()

  // cached across app
  const settings = useState<SiteSettings>('site_settings', () => FALLBACK)

  async function refresh() {
    const { data, error } = await supabase
      .from('site_settings')
      .select('brand_name, brand_logo_url, header_nav, footer_links, footer_legal, footer_tagline')
      .eq('id', 'global')
      .single()

    if (!error && data) {
      settings.value = {
        brand_name: data.brand_name ?? FALLBACK.brand_name,
        brand_logo_url: data.brand_logo_url ?? FALLBACK.brand_logo_url,
        header_nav: (data.header_nav as any) ?? FALLBACK.header_nav,
        footer_links: (data.footer_links as any) ?? FALLBACK.footer_links,
        footer_legal: (data.footer_legal as any) ?? FALLBACK.footer_legal,
        footer_tagline: data.footer_tagline ?? FALLBACK.footer_tagline
      }
    }
  }

  return { settings, refresh }
}
