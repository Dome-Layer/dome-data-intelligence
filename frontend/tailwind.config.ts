import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        'dome-bg':              '#FFFFFF',   // --color-bg-base: page background
        'dome-surface':         '#FAFAFA',   // --color-bg-subtle: card backgrounds
        'dome-elevated':        '#F5F5F5',   // --color-bg-muted: elevated surfaces

        // Text
        'dome-text':            '#0A0A0A',   // --color-text-primary
        'dome-muted':           '#525252',   // --color-text-secondary
        'dome-tertiary':        '#A3A3A3',   // --color-text-tertiary

        // Borders
        'dome-border-subtle':   '#F0F0F0',   // --color-border-subtle
        'dome-border':          '#E8E8E8',   // --color-border-default
        'dome-border-strong':   '#D4D4D4',   // --color-border-strong
        'dome-border-accent':   '#99CCFF',   // --color-border-accent

        // Accent — electric blue, the only brand colour
        'dome-accent':          '#0080FF',   // --color-accent
        'dome-accent-hover':    '#40A8FF',   // --color-accent-hover
        'dome-accent-active':   '#0066CC',   // --color-accent-active
        'dome-accent-subtle':   '#E8F3FF',   // --color-accent-subtle

        // Status — system feedback only
        'dome-success':         '#16A34A',
        'dome-success-subtle':  '#F0FDF4',
        'dome-success-border':  '#86EFAC',
        'dome-warning':         '#D97706',
        'dome-warning-subtle':  '#FFFBEB',
        'dome-warning-border':  '#FCD34D',
        'dome-error':           '#DC2626',
        'dome-error-subtle':    '#FEF2F2',
        'dome-error-border':    '#FCA5A5',
      },
      fontFamily: {
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      animation: {
        'spin-slow': 'spin 1.5s linear infinite',
      },
    },
  },
  plugins: [],
}

export default config
