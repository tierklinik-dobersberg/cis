const typography = require('@tailwindcss/typography');

var enablePurge = false;

try {
  enablePurge = process.env.TAILWIND_MODE === 'build';
} catch(err) {}

module.exports = {
  mode: 'jit',
  content: ['./src/**/*.{html,scss,ts}'],
  theme: {
    colors: (theme) => ({
      transparent: 'transparent',
      current: 'currentColor',
      white: 'white',
      ...theme("foundationColors"),
      ...theme("alertColors"),
      ...theme("specialColors"),
    }),
    foundationColors: {
      // foundation colors
      primary: {
        DEFAULT: '#194B7D',
        dark: '#153f6a',
      },
      secondary: {
        DEFAULT: '#68A4E1',
        dark: '#428EDA'
      },
      tertiary: {
        DEFAULT: '#EDEDED',
        dark: '#CBCBCB',
      },
      subtle: '#F5F6F8',
      text: {
        primary: '#181818',
        highlight: '#3B3B3B',
        secondary: '#717171',
        tertiary: '#A2A2A2',
        deEmphasized: '#B4B4B4'
      },
    },
    alertColors: {
      // alert colors
      'alert-green': {
        DEFAULT: '#4CAF50',
        dark: '#419544',
      },
      'alert-orange': {
        DEFAULT: '#FF9800',
        dark: '#db8300',
      },
      'alert-red': {
        DEFAULT: '#F44336',
        dark: '#F11C0D',
      },
      'alert-blue': {
        DEFAULT: '#2196F3',
        dark: '#0c81e0',
      },
    },
    specialColors: {
      // special colors
      meadow: {
        DEFAULT: '#00C29C',
        dark: '#00a685'
      },
      pink: {
        DEFAULT: '#ee87c0',
        dark: '#e758a7',
      },
      purple: {
        DEFAULT: '#9D6FB3',
        dark: '#8856A3'
      },
      'blue-gray': {
        DEFAULT: '#7364A5',
        dark: '#615390'
      },
      'rost-dust': {
        DEFAULT: '#AF6377',
        dark: '#9c5064'
      },
      'golden-rod': {
        DEFAULT: '#dba11c',
        dark: '#ba8918',
      },
    },
    textColor: (theme) => {
      return {
        ...theme("colors"),
        'color-primary': theme("colors").primary,
        'color-secondary': theme("colors").secondary,
        transparent: 'transparent',
        white: 'white',
        current: 'currentColor',
        primary: '#181818',
        highlight: '#3B3B3B',
        secondary: '#717171',
        tertiary: '#A2A2A2',
        deEmphasized: '#B4B4B4'
      }
    },
    minWidth: {
      '1/2': '50%',
      '1/3': '33%',
      '2/3': '33%',
    },
    fontFamily: {
      inter: 'Inter, sans-serif',
      lato: 'Lato, sans-serif',
      roboto: 'Roboto, sans-serif',
    },
    extend: {
      screens: {
        'print': { 'raw': 'print' },
      },
      opacity: {
        light: '0.5',
      },
      width: {
        'fit': 'fit-content'
      },
      height: {
        'fit': 'fit-content'
      },
      typography: (theme) => ({
        important: true,
				light: {
					css: [
						{
							color: theme('colors.text.primary'),
							'[class~="lead"]': {
								color: theme('colors.primary'),
							},
							a: {
								color: theme('colors.white'),
							},
							strong: {
								color: theme('colors.white'),
							},
							'ol > li::before': {
								color: theme('colors.text.secondary'),
							},
							'ul > li::before': {
								backgroundColor: theme('textColor.secondary'),
							},
							hr: {
								borderColor: theme('colors.subtle'),
							},
							blockquote: {
								color: theme('colors.gray.primary'),
								borderLeftColor: theme('colors.subtle'),
							},
							h1: {
								color: theme('colors.white'),
							},
							h2: {
								color: theme('colors.white'),
							},
							h3: {
								color: theme('colors.white'),
							},
							h4: {
								color: theme('colors.white'),
							},
							'figure figcaption': {
								color: theme('colors.text.secondary'),
							},
							code: {
								color: theme('colors.white'),
							},
							'a code': {
								color: theme('colors.white'),
							},
							pre: {
								color: theme('colors.gray.200'),
								backgroundColor: theme('colors.subtle'),
							},
							thead: {
								color: theme('colors.white'),
								borderBottomColor: theme('colors.subtle'),
							},
							'tbody tr': {
								borderBottomColor: theme('colors.subtle'),
							},
						},
					],
				},
			}),
    },
  },
  variants: {
    extend: {
      backgroundOpacity: ['active'],
      backgroundColor: ['active'],
      boxShadow: ['active'],
      borderRadius: ['hover'],
    }
  },
  plugins: [
    typography,
    require('./tkd-theme.js')
  ],
};
