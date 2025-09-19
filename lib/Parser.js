import decode from './Decoder.js';

/** @type {Set<string>} */
const pTag = new Set([
    'p',
]);

/** @type {Set<string>} */
const descriptionTags = new Set([
    'dd', 'dt',
]);

/** @type {Set<string>} */
const explainationTags = new Set([
    'rp', 'rt', 
]);

/** @type {Set<string>} */
const formTags = new Set([
    'button',
    'datalist',
    'input',
    'optgroup', 'option',
    'select',
    'textarea',
]);

/** @type {Set<string>} */
const tableSectionTags = new Set([
    'thead', 'tbody',
]);

/** @type {Map<string, Set<string>>} */
const implicitClose = new Map([
    ['body', new Set(['head', 'link', 'script'])],
    ['hr', pTag],

    ['header', pTag],
    ['footer', pTag],
    ['nav', pTag],
    ['div', pTag],
    ['main', pTag],
    ['article', pTag],
    ['section', pTag],
    ['aside', pTag],

    ['p', pTag],
    ['h1', pTag],
    ['h2', pTag],
    ['h3', pTag],
    ['h4', pTag],
    ['h5', pTag],
    ['h6', pTag],

    ['address', pTag],
    ['blockquote', pTag],
    ['pre', pTag],
    ['details', pTag],

    ['dl', pTag],
    ['dt', descriptionTags],
    ['dd', descriptionTags],
    
    ['rt', explainationTags],
    ['rp', explainationTags],

    ['form', pTag],
    ['button', formTags],
    ['datalist', formTags],
    ['fieldset', pTag],
    ['input', formTags],
    ['output', formTags],
    ['optgroup', new Set(['optgroup', 'option'])],
    ['option', new Set(['option'])],
    ['select', formTags],
    ['textarea', formTags],

    ['table', pTag],
    ['tbody', tableSectionTags],
    ['tfoot', tableSectionTags],
    ['th', new Set(['th'])],
    ['tr', new Set(['tr', 'th', 'td'])],
    ['td', new Set(['thead', 'th', 'td'])],
    
    ['ol', pTag],
    ['ul', pTag],
    ['li', new Set(['li'])],
    
    ['figure', pTag],
    ['figcaption', pTag],
]);

/** @type {Set<string>} */
const emptyElements = new Set([
    'area',
    'base', 'basefont', 'br',
    'col', 'command',
    'embed',
    'frame',
    'hr',
    'img', 'input', 'isindex',
    'keygen',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr',
]);

/**
 * @typedef Handler
 * @property {(name: string, attributes: Record<string, string>, selfClosing: boolean) => any} onStartTag
 * @property {(explicit: boolean) => any} onEndTag
 * 
 * @property {(value: string) => any} onText
 * @property {(value: string) => any} onComment
 * @property {(value: string) => any} onCDATA
 * @property {(value: string) => any} onDoctype
 * @property {(value: string) => any} onDeclaration
 * 
 * @property {() => any} onReset
 * @property {(error: Error) => any} onError
 * @property {() => import('./index.js').Tag} onEnd
 */

export default class Parser {
    /** @protected @type {Partial<Handler>} */
    handler;

    /** @protected @type {string} */
    buffer;
    /** @protected @type {string[]} */
    stack;

    /** @protected @type {string[]} */
    text;
    /** @protected @type {string | null} */
    tagName;
    /** @protected @type {string | null} */
    attributeName;
    /** @protected @type {string[]} */
    attributeValue;
    /** @protected @type {Record<string, string>} */
    attributes;
    
    /**
     * @param {Partial<Handler>} [handler = {}]
     * @param {boolean} [reset = true]
     */
    constructor(handler = {}, reset = true) {
        this.handler = handler;
        if (reset) this.onReset();
    }

    /**
     * 
     * 
     * @returns {import('./index.js').Tag}
     */
    onEnd() {
        while (this.stack.length) {
            this.handler.onEndTag?.(false);
            this.stack.pop();
        }
        
        return this.handler.onEnd?.();
    }

    /**
     * 
     */
    onReset() {
        this.handler.onReset?.();
        
        this.text = [];
        this.tagName = null;
        this.attributeName = null;
        this.attributeValue = [];
        this.attributes = {};

        this.buffer = null;
        this.stack = [];
    }
    
    /**
     * 
     * 
     * @param {number} start 
     * @param {number} end 
     */
    onText(start, end) {
        this.text.push(this.buffer.slice(start, end));
    }

    /**
     * 
     * 
     * @param {number} start 
     * @param {number} end 
     */
    onTextEntity(start, end) {
        const entity = this.buffer.slice(start, end);
        this.text.push(decode(entity) ?? '&' + entity);
    }

    /**
     * 
     */
    onTextEnd() {
        this.handler.onText?.(this.text.join('').trim());
        this.text.length = 0;
    }

    /**
     * 
     * 
     * @param {number} start 
     * @param {number} end 
     */
    onStartTagName(start, end) {
        this.tagName = this.buffer.slice(start, end).toLowerCase();
    }

    /**
     * 
     * 
     * @param {number} start 
     * @param {number} end 
     */
    onAttributeName(start, end) {
        this.attributeName = this.buffer.slice(start, end).toLowerCase();
    }

    /**
     * 
     * 
     * @param {number} start 
     * @param {number} end 
     */
    onAttributeValue(start, end) {
        this.attributeValue.push(this.buffer.slice(start, end));
    }

    /**
     * 
     * 
     * @param {number} start 
     * @param {number} end 
     */
    onAttributeEntity(start, end) {
        const entity = this.buffer.slice(start, end);
        this.attributeValue.push(decode(entity) ?? '&' + entity);
    }

    /**
     * 
     */
    onAttributeEnd() {
        this.attributes[this.attributeName] = this.attributeValue.join('');
        this.attributeName = null;
        this.attributeValue.length = 0;
    }

    /**
     * 
     */
    onStartTagClose() {
        const close = implicitClose.get(this.tagName);
        if (close) {
            while (close.has(this.stack.at(-1))) {
                this.handler.onEndTag?.(false);
                this.stack.pop();
            }
        }
        
        const selfClosing = emptyElements.has(this.tagName);
        this.handler.onStartTag?.(this.tagName, this.attributes, selfClosing);
        
        if (!selfClosing) this.stack.push(this.tagName);
        this.tagName = null;
        this.attributes = {};
    }

    /**
     * 
     * 
     * @param {number} start 
     * @param {number} end 
     */
    onEndTagName(start, end) {
        const name = this.buffer.slice(start, end);
        if (emptyElements.has(name)) return;

        let distance = this.stack.length - this.stack.lastIndexOf(name) - 1;
        if (distance === this.stack.length) return;

        do {
            this.handler.onEndTag?.(!distance);
            this.stack.pop();
        } while (distance--);
    }

    /**
     * 
     * 
     * @param {number} start 
     * @param {number} end 
     */
    onComment(start, end) {
        this.handler.onComment?.(this.buffer.slice(start, end).trim());
    }

    /**
     * 
     * 
     * @param {number} start 
     * @param {number} end 
     */
    onCDATA(start, end) {
        this.handler.onCDATA?.(this.buffer.slice(start, end).trim());
    }

    /**
     * 
     * 
     * @param {number} start 
     * @param {number} end 
     */
    onDeclaration(start, end) {
        this.handler.onDeclaration?.(this.buffer.slice(start, end).trimEnd());
    }
}
