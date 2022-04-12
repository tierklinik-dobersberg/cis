import { Injectable } from '@angular/core';
import { ChartDataset } from 'chart.js';
import config from '../../../../tailwind.config.js';

@Injectable({providedIn: 'root'})
export class ColorService {
    colors: string[] = [];
    byName = new Map<string, string>();

    constructor() {
        const colors = new Set<string>();
        const byName = new Map<string, string>();
        ['DEFAULT', 'dark'].forEach(key => {
            [config.theme.foundationColors, config.theme.specialColors].forEach(colorset => {
                Object.keys(colorset)
                    .forEach(colorName => {
                        if (colorName === 'tertiary') {
                          return;
                        }
                        try {
                            const color = colorset[colorName][key];
                            if (!!color) {
                                colors.add(color);
                                let name = colorName.toLowerCase();
                                if (key !== 'DEFAULT') {
                                  name += '-' + key
                                }
                                byName.set(name, color);
                            }
                        } catch(err) {}
                    })
                })
        })

        this.colors = Array.from(colors);
        this.byName = byName;
        console.log(this.colors);
    }

    byIndex(i: number): string {
      return this.colors[i % this.colors.length];
    }

    get(nameOrColor: string): string {
      const v = this.byName.get(nameOrColor);
      if (!!v) {
        return v;
      }
      return nameOrColor;
    }

    colorizeDatasets(data: ChartDataset<any, any>[]) {
        data.forEach((d, idx) => {
            d.backgroundColor = this.byIndex(idx);
            d.borderColor = this.byIndex(idx);
            d.pointBackgroundColor = this.byIndex(idx);
        })
    }
}
