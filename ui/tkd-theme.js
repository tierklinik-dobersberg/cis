const plugin = require('tailwindcss/plugin')

module.exports = plugin.withOptions(
  ({ className = 'tkd', target = 'modern'} = {}) => {
    return function({addComponents, theme}) {
      addComponents({
        '.tkd-btn': {
          '@apply px-3 py-1.5 rounded cursor-pointer outline-none focus:outline-none font-medium focus:ring-2 focus:ring-primary text-sm focus:ring-opacity-light active:shadow-inner text-white': {},
          '@apply transition-colors duration-75 ease-in-out': {},
          '@apply flex items-center gap-2 font-lato justify-around leading-4': {},
          '& > svg': {
            '@apply w-4 h-4': {}
          },

          backgroundColor: 'var(--color)',
          '&:hover': {
            backgroundColor: 'var(--hover)'
          },

          '&.tkd-outline': {
            '@apply border': {},
            backgroundColor: 'unset',
            color: 'var(--color)',
            borderColor: 'var(--color)',
            '&:hover': {
              color: 'var(--hover)',
              borderColor: 'var(--hover)',
            }
          }
        },

        '.tdk-btn .tkd-small': {
          '@apply text-xs px-1.5 py-1': {}
        },

        '&[default]': {
          cursor: 'default'
        },

        '.tkd-btn.tkd-primary': {
          '--color': theme('colors.primary.DEFAULT'),
          '--hover': theme('colors.primary.dark')
        },
        '.tkd-btn.tkd-secondary': {
          '--color': theme('colors.secondary.DEFAULT'),
          '--hover': theme('colors.secondary.dark')
        },
        '.tkd-btn.tkd-tertiary': {
          '--color': theme('colors.tertiary.DEFAULT'),
          '--hover': theme('colors.tertiary.dark')
        },
        '.tkd-btn.tkd-danger': {
          '--color': theme('colors.alert.red.DEFAULT'),
          '--hover': theme('colors.alert.red.dark')
        },
      })
    }
  }
)
