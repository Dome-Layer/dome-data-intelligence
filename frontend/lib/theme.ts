export type Theme = 'light' | 'dark'

export const getTheme = (): Theme => {
  if (typeof window === 'undefined') return 'light'
  const saved = localStorage.getItem('dome-theme') as Theme | null
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const setTheme = (theme: Theme): void => {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('dome-theme', theme)
}

export const toggleTheme = (): Theme => {
  const current = document.documentElement.getAttribute('data-theme') as Theme | null
  const next: Theme = current === 'dark' ? 'light' : 'dark'
  setTheme(next)
  return next
}

export const initTheme = (): void => {
  setTheme(getTheme())
}
