/** SkeleDOM's element types. @enum {string} */
export const Element = Object.freeze({
    /** <> ... </>. */
    TAG: 'tag',
    /** Root(s) holder. */
    DOCUMENT: 'document',
});

/** SkeleDOM's data types. @enum {string} */
export const Data = Object.freeze({
    /** String */
    TEXT: 'text',
    /** <!-- ... --> */
    COMMENT: 'comment',
    /** <![CDATA[ ... ]]> */
    CDATA: 'cdata',
    /** <!DOCTYPE ...> */
    DOCTYPE: 'doctype',
    /** <? ... ?> */
    DIRECTIVE: 'directive',
});

/**
 * Multi-valued attributes membership checker. @type {Set<string>} */
const Group = new Set([
    'class',
    'rel',
    'sandbox',
    'accept-charset',
    'headers',
    'sizes',
    'accesskey',
    'dropzone',
    'rev',
    'archive',
    'for',
]);

/** Whitespace sequence splitter. @type {RegExp} */
const Whitespace = /\s+/;

/**
 * SkeleDOM's base navigable node abstract class.
 * @abstract
 */
export class Node {
    /** @protected @readonly @type {Element | Data} */
    type;
    /** Container node. @type {Tag | undefined} */
    parent;
    /** Previous node in the depth-first order. @type {Node | undefined} */
    previous;
    /** Next node in the depth-first order. @type {Node | undefined} */
    next;
    /** Sibling on the left. @type {Node | undefined} */
    previousSibling;
    /** Sibling on the right. @type {Node | undefined} */
    nextSibling;

    /**
     * Set navigational information.
     * 
     * @param {Tag} parent
     * @param {Node} [previous]
     */
    link(parent, previous) {
        (this.parent = parent).children.push(this);
        (this.previousSibling = this.parent.children.at(-2))?.nextSibling = this;
        (this.previous = previous).next = this;
    }
}

/**
 * Markup container.
 */
export class Tag extends Node {
    /** @type {string} */
    name;
    /** @type {Record<string, string | Set<string>>} */
    attributes;
    /** @type {Node[]} */
    children;
    /** @type {Node} */
    tail;

    /**
     * @param {string} name
     * @param {Record<string, string | Set<string>>} [attributes = {}] 
     * @param {Node[]} [children = []] 
     * @param {Element} [type=Element.TAG]
     */
    constructor(name, attributes = {}, children = [], type = Element.TAG) {
        super();
        this.name = name;
        this.attributes = attributes;
        this.children = children;
        this.type = type;
    }
    
    /**
     * Iterate over own descendants in a depth-first order.
     * 
     * @returns {IterableIterator<Node>}
     */
    *[Symbol.iterator]() {
        const stop = this.tail?.next;
        if (stop == undefined) return;
        for (let node = this.next; node != stop; node = node.next) yield node;
    }
}

/**
 * Plain data.
 */
export class Text extends Node {
    /** @type {string} */
    value;

    /**
     * @param {string} [value = ''] 
     * @param {Data} [type = Data.TEXT] 
     */
    constructor(value = '', type = Data.TEXT) {
        super();
        this.value = value;
        this.type = type;
    }
}

export default class Handler {
    /** Root node. @protected @type {Tag} */
    document;
    /** Open tags memory stack to track parent-child relationships. @protected @type {Tag[]} */
    ancestry;
    /** Last processesd node. @protected @type {Node} */
    previous;
    
    /**
     * @param {boolean} [reset = true] 
     */
    constructor(reset = true) {
        if (reset) this.onReset();
    }

    /**
     * 
     */
    onReset() {
        this.ancestry = [this.document = this.previous = new Tag(undefined, undefined, undefined, Element.DOCUMENT)];
    }

    /**
     * 
     * @returns {Tag}
     */
    onEnd() {
        return this.document;
    }

    /**
     * 
     * 
     * @param {string} name 
     * @param {Record<string, string>} attributes 
     * @param {boolean} selfClosing 
     */
    onStartTag(name, attributes, selfClosing) {
        for (const attribute in attributes) if (Group.has(attribute)) attributes[attribute] = new Set(attributes[attribute].trim().split(Whitespace));
        const tag = new Tag(name, attributes);         //: Create new tag
        tag.link(this.ancestry.at(-1), this.previous); //: Link tag to the tree and vice versa
        if (!selfClosing) this.ancestry.push(tag);     //: If tag can bear children, push to stack
        this.previous = tag;                           //: Set tag as previous node
    }

    /**
     * 
     */
    onEndTag() { 
        const tag = this.ancestry.pop();                             //: May no longer bear children
        tag.tail = tag.children.at(-1)?.tail ?? tag.children.at(-1); //: Register last descendant
    }

    /**
     * 
     * 
     * @param {string} value 
     */
    onText(value) {
        const text = new Text(value);
        text.link(this.ancestry.at(-1), this.previous);
        this.previous = text;
    }

    /**
     * 
     * 
     * @param {string} value 
     */
    onComment(value) {
        const text = new Text(value, Data.COMMENT);
        text.link(this.ancestry.at(-1), this.previous);
        this.previous = text;
    }

    /**
     * 
     * 
     * @param {string} value 
     */
    onCDATA(value) {
        const text = new Text(value, Data.CDATA);
        text.link(this.ancestry.at(-1), this.previous);
        this.previous = text;
    }

    /**
     * 
     * 
     * @param {string} value 
     */
    onDeclaration(value) {
        const text = new Text(value, Data.DOCTYPE);
        text.link(this.ancestry.at(-1), this.previous);
        this.previous = text;
    }

    /**
     * 
     * 
     * @param {string} value 
     */
    onDirective(value) {
        const text = new Text(value, Data.DIRECTIVE);
        text.link(this.ancestry.at(-1), this.previous);
        this.previous = text;
    }
}

//: TODO - Init Tag & Init Text functions?.
//: TODO - Derive previous (depth/breadth)-first node if not provided? At Handler or at Node or as utility?
//: TODO - Allow user to provide element constructor map? Signal secondary node types like empty tag? Ignore the problem of inheritance?
