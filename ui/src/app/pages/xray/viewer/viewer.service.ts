import { Injectable } from "@angular/core";
import * as dwv from 'dwv';
import { ViewerComponent } from "./viewer";

export interface Tool {
    label: string;
    id: string;
    icon: string;
}

@Injectable({
    providedIn: 'root',
})
export class DwvService {
    private viewerIdCounter = 0;

    /**
     * renderes is used to track active DcwPage components that are not yet disposed
     * because angular/ionic keep their views cached for navigating back in history.
     * The ID for the DWV render element is always `dwv` but passed as `dwv/${DwvPageID}`
     * so we can return the correct version
     */
    private renderers = new Map<string, ViewerComponent>();

    /** Returns a new application-lifetime unique ID for a dwv instance */
    getUniqueID() {
        return this.viewerIdCounter++;
    }

    constructor() {
        this.setup();
    }

    register(comp: ViewerComponent): string {
        const id = `${this.getUniqueID()}`;
        this.renderers.set(id, comp)
        return id;
    }

    unregister(id: string) {
        const val = this.renderers.get(id);
        if (!val) {
            return;
        }

        this.renderers.delete(id);
    }

    private setup() {
        dwv.utils.decodeQuery = dwv.utils.decodeQuery;

        dwv.gui.base.getElement = (containerDivId: string, name: string) => {
            const id = containerDivId.split('/')[1];
            containerDivId = 'dwv';

            const comp = this.renderers.get(id);
            if (!comp) {
                throw new Error(`failed to get DWV renderer element`);
            }

            const parent: HTMLElement = comp.element.nativeElement;
            const elements = parent.getElementsByClassName(name);
            // getting the last element since some libraries (ie jquery-mobile) create
            // span in front of regular tags (such as select)...
            return elements[elements.length - 1];
        }

        dwv.gui.getElement = dwv.gui.base.getElement;

        // refresh element
        dwv.gui.refreshElement = dwv.gui.base.refreshElement;

        dwv.i18nInitialise("auto", "assets/");

        // Image decoders (for web workers)
        dwv.image.decoderScripts = {
            jpeg2000: 'assets/dwv/decoders/pdfjs/decode-jpeg2000.js',
            'jpeg-lossless': 'assets/dwv/decoders/rii-mango/decode-jpegloss.js',
            'jpeg-baseline': 'assets/dwv/decoders/pdfjs/decode-jpegbaseline.js',
            rle: 'assets/dwv/decoders/dwv/decode-rle.js'
        };

        const style = dwv.html.Style;
        dwv.html.Style = function () {
            let s = new style();
            s.setScale(0.2);

            return s;
        }
    }
}