import { Injectable } from '@angular/core';
import { ChartData, ChartDataset } from 'chart.js';
import config from '../../../../tailwind.config.js';

@Injectable({providedIn: 'root'})
export class ColorService {
    colors: string[] = [];
    private datasetColors = new Map<string, string>();

    constructor() {
        const colors = new Set<string>();
        ['DEFAULT', 'dark'].forEach(key => {
            [config.theme.foundationColors, config.theme.specialColors].forEach(colorset => {
                Object.keys(colorset)
                    .forEach(colorName => {
                        try {
                            const color = colorset[colorName][key];
                            if (!!color) {
                                colors.add(color);
                            }
                        } catch(err) {}
                    })
                })
        })

        this.colors = Array.from(colors);
        console.log(this.colors);
    }

    colorizeDatasets(data: ChartDataset<any, any>[]) {
        data.forEach((d, idx) => {
            d.backgroundColor = this.colors[idx];
        })
    }
}
