module.exports = {
  purge: {
    enabled: false,// TODO(ppacher): only for production build
    content: ['./src/**/*.{html,ts}']
  },
  darkMode: false, // or 'media', 'class'
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
        dark: 'ba8918',
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
    fontFamily: {
      inter: 'Inter, sans-serif',
      lato: 'Lato, sans-serif',
      roboto: 'Roboto, sans-serif',
    },
    extend: {
      opacity: {
        light: '0.5',
      },
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
  plugins: [],
};
