import cfg from "@tierklinik-dobersberg/tailwind/config.js";

cfg.content = [
  "./src/**/*.{html,ts,css,scss}",
  "./node_modules/@tierklinik-dobersberg/angular/**/*.{mjs,js,html,css}"
]

cfg.theme.extend.fontWeight = {
  light: '200',
  normal: '300',
  medium: '400',
  semibold: '500',
  bold: '600'
}

cfg.plugins.push(require('@tailwindcss/container-queries'));

export default cfg;
