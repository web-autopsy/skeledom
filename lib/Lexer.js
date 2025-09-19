/**
 * ASCII character codes. @enum {number}
 */
const Character = Object.freeze({
    //: Symbols
    LESS_THAN: 0x3c,         // < Tag Start
    SLASH: 0x2f,             // / Close Tag
    GREATER_THAN: 0x3e,      // > Tag End

    EQUALS: 0x3d,            // = Attribute Assignment
    QUOTATION_MARK: 0x22,    // " Attribute Value
    APOSTROPHE: 0x27,        // ' Attribute Value

    QUESTION_MARK: 0x3f,     // ? Directive
    EXCLAIMATION_MARK: 0x21, // ! Comment - Doctype
    DASH: 0x2d,              // - Comment
    OPEN_BRACKET: 0x5b,      // [ CDATA
    CLOSE_BRACKET: 0x5d,     // ] CDATA

    AMPERSAND: 0x26,         // & Entity
    NUMBER: 0x23,            // # Entity
    SEMI_COLON: 0x3b,        // ; Entity

    //: Alphanumerics
    LOWERCASE_A: 0x61,       // a
    LOWERCASE_Z: 0x7a,       // z

    ZERO: 0x30,              // 0
    NINE: 0x39,              // 9

    //: Whitespace
    SPACE: 0x20,
});

/**
 * Checks whether an ASCII character code
 * falls within the alphabetic range.
 * 
 * @param {number} char 
 * @returns {boolean}
 */
function isAlphabetic(char) {
    char |= Character.SPACE;
    return char >= Character.LOWERCASE_A && char <= Character.LOWERCASE_Z;
}

/**
 * Checks whether an ASCII character code
 * falls within the alphanumeric range.
 * 
 * @param {number} char 
 * @returns {boolean}
 */
function isAlphanumeric(char) {
    return isAlphabetic(char) || char >= Character.ZERO && char <= Character.NINE;
}

/**
 * Checks whether an ASCII character code
 * falls within the whitespace range.
 * 
 * @param {number} char 
 * @returns {boolean}
 */
function isWhitespace(char) {
    return char <= Character.SPACE;
}

/** Sequences to match special keywords. @enum {Uint8Array} */
const Sequence = Object.freeze({
    STYLE: new Uint8Array([0x73, 0x74, 0x79, 0x6c, 0x65]),                       // style
    SCRIPT: new Uint8Array([0x73, 0x63, 0x72, 0x69, 0x70, 0x74]),                // script

    TITLE: new Uint8Array([0x74, 0x69, 0x74, 0x6c, 0x65]),                       // title
    TEXT_AREA: new Uint8Array([0x74, 0x65, 0x78, 0x74, 0x61, 0x72, 0x65, 0x61]), // textarea
    XMP: new Uint8Array([0x78, 0x6d, 0x70]),                                     // xmp

    CDATA: new Uint8Array([0x43, 0x44, 0x41, 0x54, 0x41]),                       // cdata
    DOCTYPE: new Uint8Array([0x64, 0x6F, 0x63, 0x74, 0x79, 0x70, 0x65]),         // doctype
});

/** HTML attribute quote types. @enum {string} */
export const Quote = Object.freeze({
    SINGLE: "'",
    DOUBLE: '"',
    NULLUM: ' ',
});

/**
 * @typedef Parser
 * @property {(start: number, end: number) => any} onText
 * @property {(start: number, end: number) => any} onTextEntity
 * @property {() => any} onTextEnd
 * 
 * @property {(start: number, end: number) => any} onStartTagName
 * @property {(start: number, end: number) => any} onAttributeName
 * @property {(start: number, end: number) => any} onAttributeValue
 * @property {(start: number, end: number) => any} onAttributeEntity
 * @property {(quote: Quote) => any} onAttributeEnd
 * @property {() => any} onSelfClosingTag
 * @property {(start: number, end: number) => any} onStartTagClose
 * @property {(start: number, end: number) => any} onEndTagName
 * 
 * @property {(start: number, end: number) => any} onComment
 * @property {(start: number, end: number) => any} onCDATA
 * @property {(start: number, end: number) => any} onDeclaration
 * @property {(start: number, end: number) => any} onDirective
 * 
 * @property {() => any} onReset
 * @property {(error: Error) => any} onError
 * @property {() => import('./index.js').Tag} onEnd 
 */

export default class Lexer {
    /** @protected @type {Partial<Parser>} */
    parser;

    /** Return state. @protected @type {} */
    previous;
    /** Proceed state. @protected @type {} */
    next;
    /** Current state. @protected @type {} */
    state;

    /** Buffer index. @protected @type {number} */
    index;
    /** Current section start index (inclusive). @protected @type {number} */
    sectionStart;

    /** Current match sequence. @protected @type {Sequence | null} */
    sequence;
    /** @type {number} */
    sequenceIndex;

    /**
     * @param {Partial<Parser>} [parser = {}] 
     * @param {boolean} [reset = true] 
     */
    constructor(parser = {}, reset = true) {
        this.parser = parser;
        if (reset) this.reset();
    }

    /**
     * 
     */
    reset() {
        this.parser.onReset?.();

        this.previous = null;
        this.next = null;
        this.state = this.PAGE;

        this.index = 0;
        this.sectionStart = 0;

        this.sequence = null;
        this.sequenceIndex = 0;
    }

    /**
     * 
     * 
     * @param {string} chunk 
     */
    write(chunk) {
        this.parser.buffer = chunk;

        do {
            this.state(chunk.charCodeAt(this.index));
            console.log(`${chunk.charAt(this.index)}\x1B[2G -> ${this.state.name.padEnd(25, '.')} Index: ${this.index} Start: ${this.sectionStart}`);
        } while (++this.index < chunk.length);
    }

    /**
     * 
     * 
     * @param {string} [chunk] 
     * @returns {Tag}
     */
    end(chunk) {
        if (chunk) this.write(chunk);
        return this.parser.onEnd?.();
    }

   PAGE(char) {
        if (isWhitespace(char)) {
            return;
        
        //: ...<
        } else if (char === Character.LESS_THAN) {
            this.state = this.START_TAG_OPEN;
            this.sectionStart = this.index;
        
        //: ...&
        } else if (char === Character.AMPERSAND) {
            this.state = this.BEFORE_TEXT_ENTITY;
        
        //: ...a
        } else {
            this.state = this.TEXT;
        }
    }
    
    TEXT(char) {
        //: ...<
        if (char === Character.LESS_THAN) {
            this.state = this.START_TAG_OPEN;

        //: ...&
        } else if (char === Character.AMPERSAND) {
            this.state = this.BEFORE_TEXT_ENTITY;
        }

        //: Subsequent state controls text emitting.
    }

    BEFORE_TEXT_ENTITY(char) {
        //: &a... &#...
        if (isAlphanumeric(char) || char === Character.NUMBER) {
            if (this.sectionStart !== this.index - 1) {
                this.parser.onText?.(this.sectionStart, this.index - 1);
            }

            this.state = this.TEXT_ENTITY;
            this.sectionStart = this.index;

        //: & ...
        } else {
            this.state = this.TEXT;
            this.state(char);
        }
    }

    TEXT_ENTITY(char) {
        //: &a...
        if (isAlphanumeric(char)) {
            return;

        } else {
            this.parser.onTextEntity?.(this.sectionStart, this.index);
            this.state = this.TEXT;

            //: &a;
            if (char === Character.SEMI_COLON) {
                this.sectionStart = this.index + 1;

            //: &a<...
            } else {
                this.sectionStart = this.index;
                this.state(char);
            }
        }
    }

    RAW_TEXT(char) {
        //: ...<
        if (char === Character.LESS_THAN) {
            this.state = this.RAW_TEXT_END_OPEN;
        }
    }

    RAW_TEXT_END_OPEN(char) {
        //: </...
        if (char === Character.SLASH) {
            this.state = this.END_SEQUENCE_MATCH;
            this.sequenceIndex = 0;
        
        //: <a
        } else {
            this.state = this.RAW_TEXT;
            this.state(char);
        }
    }

    START_TAG_OPEN(char) {
        //: </...
        if (char === Character.SLASH) {
            this.state = this.END_TAG_OPEN;
            return; //: Don't emit text yet.

        //: <a...
        } else if (isAlphabetic(char)) {
            check: {
                //: <s...
                if (char === Sequence.SCRIPT[0]) {
                    this.state = this.S_SEQUENCE_START;

                //: <t...
                } else if (char === Sequence.TEXT_AREA[0]) {
                    this.state = this.T_SEQUENCE_START;

                //: <x...
                } else if (char === Sequence.XMP[0]) {
                    this.state = this.START_SEQUENCE_MATCH;
                    this.sequence = Sequence.XMP;
                    this.sequenceIndex = 1;

                //: <d...
                } else {
                    this.state = this.START_TAG_NAME;
                    break check;
                }

                this.previous = this.next = this.START_TAG_NAME;
            }
            
        //: <!...
        } else if (char === Character.EXCLAIMATION_MARK) {
            this.state = this.EXCLAIMATION;

        //: <?...
        } else if (char === Character.QUESTION_MARK) {
            this.state = this.DIRECTIVE;

        //: <<... <>... <0...
        } else {
            this.state = this.TEXT;
            this.state(char);
            return; //: Don't emit text yet.
        }

        //: Emit text if exists.
        if (this.sectionStart !== this.index - 1) {
            this.parser.onText?.(this.sectionStart, this.index - 1);
            this.parser.onTextEnd?.();
        }

        //: Delayed section start index update.
        this.sectionStart = this.index;
    }

    START_TAG_NAME(char) {
        //: <div ...
        if (isWhitespace(char)) {
            this.parser.onStartTagName?.(this.sectionStart, this.index);
            this.state = this.BEFORE_ATTRIBUTE_NAME;

        //: <div>
        } else if (char === Character.GREATER_THAN) {
            this.parser.onStartTagName?.(this.sectionStart, this.index);
            this.parser.onStartTagClose?.();
            this.state = this.sequence ? this.RAW_TEXT : this.PAGE;
            this.sectionStart = this.index + 1;

        //: <img/...
        } else if (char === Character.SLASH) {
            this.parser.onStartTagName?.(this.sectionStart, this.index);
            this.state = this.SELF_CLOSING_TAG;
        }
    }

    S_SEQUENCE_START(char) {
        char |= Character.SPACE; //: Case insensitive.

        //: <sc...
        if (char === Sequence.SCRIPT[1]) {
            this.sequence = Sequence.SCRIPT;

        //: <st...
        } else if (char === Sequence.STYLE[1]) {
            this.sequence = Sequence.STYLE;

        //: <sp...
        } else {
            this.state = this.START_TAG_NAME;
            this.state(char);
            return;
        }

        this.state = this.START_SEQUENCE_MATCH;
        this.sequenceIndex = 2;
    }

    T_SEQUENCE_START(char) {
        char |= Character.SPACE; //: Case insensitive.

        //: <te...
        if (char === Sequence.TEXT_AREA[1]) {
            this.sequence = Sequence.TEXT_AREA;

        //: <ti...
        } else if (char === Sequence.TITLE[1]) {
            this.sequence = Sequence.TITLE;

        //: <tr...
        } else {
            this.state = this.START_TAG_NAME;
            this.state(char);
            return;
        }

        this.state = this.START_SEQUENCE_MATCH;
        this.sequenceIndex = 2;
    }

    START_SEQUENCE_MATCH(char) {
        //: Failure
        if ((char | Character.SPACE) !== this.sequence[this.sequenceIndex]) {
            this.state = this.previous;
            this.state(char);
            this.sequence = null;

        //: Success
        } else if (++this.sequenceIndex === this.sequence.length) {
            this.state = this.next;
        }
    }

    END_SEQUENCE_MATCH(char) {
        //: Failure
        if ((char | Character.SPACE) !== this.sequence[this.sequenceIndex]) {
            this.state = this.RAW_TEXT;
            this.state(char);

        //: Success
        } else if (++this.sequenceIndex === this.sequence.length) {
            if (this.sectionStart !== this.index - this.sequence.length - 1) {
                this.parser.onText?.(this.sectionStart, this.index - this.sequence.length - 1);
                this.parser.onTextEnd?.();
            }
            
            this.state = this.END_TAG_NAME;
            this.sectionStart = this.index - this.sequence.length + 1;
            this.sequence = null;
        }
    }

    EXCLAIMATION(char) {
        //: <!-...
        if (char === Character.DASH) {
            this.state = this.COMMENT_START;
            return;

        //: <![...
        } else if (char === Character.OPEN_BRACKET) {
            this.next = this.CDATA_START;
            this.sequence = Sequence.CDATA;

        //: <!d...
        } else if ((char | Character.SPACE) === Sequence.DOCTYPE[0]) {
            this.next = this.DECLARATION;
            this.sequence = Sequence.DOCTYPE;

        //: <!a...
        } else {
            this.state = this.DASHLESS_COMMENT;
            return;
        }

        this.previous = this.DASHLESS_COMMENT;
        this.state = this.START_SEQUENCE_MATCH;
        this.sequenceIndex = 1;
    }
    
    COMMENT_START(char) {
        //: <!--...
        if (char === Character.DASH) {
            this.state = this.COMMENT_END;
            this.sectionStart = this.index + 1;

        //: <!-a...
        } else {
            this.state = this.DASHLESS_COMMENT;
        }
    }

    COMMENT(char) {
        //: ...-
        if (char === Character.DASH) {
            this.state = this.COMMENT_END_OPEN;
        }
    }

    COMMENT_END_OPEN(char) {
        //: ...--
        if (char === Character.DASH) {
            this.state = this.COMMENT_END;
        
        //: ...-a
        } else {
            this.state = this.COMMENT;
        }
    }

    COMMENT_END(char) {
        //: ...-->
        if (char === Character.GREATER_THAN) {
            this.parser.onComment?.(this.sectionStart, this.index - 2);
            this.state = this.PAGE;
            this.sectionStart = this.index + 1;
        
        //: ...--!
        } else if (char === Character.EXCLAIMATION_MARK) {
            this.state = this.COMMENT_END_CLOSE;
        
        //: ...--a
        } else {
            this.state = this.COMMENT_END_OPEN;
            this.state(char);
        }
    }

    COMMENT_END_CLOSE(char) {
        //: ...--!>
        if (char === Character.GREATER_THAN) {
            this.parser.onComment?.(this.sectionStart, this.index - 3);
            this.state = this.PAGE;
            this.sectionStart = this.index + 1;
        
        //: ...--!a
        } else {
            this.state = this.COMMENT;
            this.state(char);
        }
    }

    CDATA_START(char) {
        //: <![cdata[...
        if (char === Character.OPEN_BRACKET) {
            this.state = this.CDATA;
            this.sectionStart = this.index + 1;
        
        //: <![cdataa...
        } else {
            this.state = this.DASHLESS_COMMENT;
            this.state(char);
        }
    }

    CDATA(char) {
        //: ...]
        if (char === Character.CLOSE_BRACKET) {
            this.state = this.CDATA_END_OPEN;
        }
    }

    CDATA_END_OPEN(char) {
        //: ...]]
        if (char === Character.CLOSE_BRACKET) {
            this.state = this.CDATA_END;
        
        //: ...]a
        } else {
            this.state = this.CDATA;
        }
    }

    CDATA_END(char) {
        //: ...]]>
        if (char === Character.GREATER_THAN) {
            this.parser.onCDATA?.(this.sectionStart, this.index - 2);
            this.state = this.PAGE;
            this.sectionStart = this.index + 1;
            this.sequence = null;
        
        //: ...]]a
        } else {
            this.state = this.CDATA_END_OPEN;
            this.state(char);
        }
    }

    DECLARATION(char) {
        //: ...>
        if (char === Character.GREATER_THAN) {
            this.parser.onDeclaration?.(this.sectionStart + 1, this.index);
            this.state = this.PAGE;
            this.sectionStart = this.index + 1;
            this.sequence = null;
        }
    }

    DASHLESS_COMMENT(char) {
        //: ...>
        if (char === Character.GREATER_THAN) {
            this.parser.onComment?.(this.sectionStart + 1, this.index);
            this.state = this.PAGE;
            this.sectionStart = this.index + 1;
        }
    }

    DIRECTIVE(char) {
        //: ...?
        if (char === Character.QUESTION_MARK){
            this.state = this.DIRECTIVE_END;
        
        //: ...>
        } else if (char === Character.GREATER_THAN) {
            this.parser.onDirective?.(this.sectionStart, this.index);
            this.state = this.PAGE;
            this.sectionStart = this.index + 1;
        }
    }

    DIRECTIVE_END(char) {
        //: ...?>
        if (char === Character.GREATER_THAN) {
            this.parser.onDirective?.(this.sectionStart, this.index - 1);
            this.state = this.PAGE;
            this.sectionStart = this.index + 1;
        
        //: ...??
        } else if (char === Character.QUESTION_MARK) {
            return;

        //: ...?a
        } else {
            this.state = this.DIRECTIVE;
        }
    }

    BEFORE_ATTRIBUTE_NAME(char) {
        //: <div ...
        if (isWhitespace(char)) {
            return;

        //: <img /...
        } else if (char === Character.SLASH) {
            this.state = this.SELF_CLOSING_TAG;

        //: <div >
        } else if (char === Character.GREATER_THAN) {
            this.parser.onStartTagClose?.();
            this.state = this.sequence ? this.RAW_TEXT : this.PAGE;
            this.sectionStart = this.index + 1;
 
        //: <div a... <div =... <div "... <div '... <div <...
        } else {
            this.state = this.ATTRIBUTE_NAME;
            this.sectionStart = this.index;
        }
    }

    ATTRIBUTE_NAME(char) {
        //: <div class=...
        if (char === Character.EQUALS) {
            this.parser.onAttributeName?.(this.sectionStart, this.index);
            this.state = this.BEFORE_ATTRIBUTE_VALUE;
        
        //: <script async ...
        } else if (isWhitespace(char)) {
            this.parser.onAttributeName?.(this.sectionStart, this.index);
            this.state = this.AFTER_ATTRIBUTE_NAME;

        //: <script async>
        } else if (char === Character.GREATER_THAN) {
            this.parser.onAttributeName?.(this.sectionStart, this.index);
            this.parser.onAttributeEnd?.();
            this.parser.onStartTagClose?.()
            this.state = this.sequence ? this.RAW_TEXT : this.PAGE;
            this.sectionStart = this.index + 1;

        //: <script async/...
        } else if (char === Character.SLASH) {
            this.parser.onAttributeName?.(this.sectionStart, this.index);
            this.parser.onAttributeEnd?.();
            this.state = this.SELF_CLOSING_TAG;
        }
    }

    AFTER_ATTRIBUTE_NAME(char) {
        //: <script async  ...
        if (isWhitespace(char)) {
            return;

        //: <script async /...
        } else if (char === Character.SLASH) {
            this.parser.onAttributeEnd?.();
            this.state = this.SELF_CLOSING_TAG;
        
            //: <script async >
        } else if (char === Character.GREATER_THAN) {
            this.parser.onAttributeEnd?.();
            this.parser.onStartTagClose?.()
            this.state = this.sequence ? this.RAW_TEXT : this.PAGE;
            this.sectionStart = this.index + 1;

        //: <div class =...
        } else if (char === Character.EQUALS) {
            this.state = this.BEFORE_ATTRIBUTE_VALUE;

        //: <script async d...
        } else {
            this.parser.onAttributeEnd?.();
            this.state = this.ATTRIBUTE_NAME;
            this.sectionStart = this.index;
        }
    }

    BEFORE_ATTRIBUTE_VALUE(char) {
        //: <div class= ...
        if (isWhitespace(char)) {
            return;

        //: <div class="...
        } else if (char === Character.QUOTATION_MARK) {
            this.state = this.DQ_ATTRIBUTE_VALUE;

        //: <div class='...
        } else if (char === Character.APOSTROPHE) {
            this.state = this.SQ_ATTRIBUTE_VALUE;

        //: <div class=>
        } else if (char === Character.GREATER_THAN) {
            this.parser.onAttributeEnd?.();
            this.parser.onStartTagClose?.();
            this.state = this.sequence ? this.RAW_TEXT : this.PAGE;
            
        //: <div class=a...
        } else {
            this.state = this.NQ_ATTRIBUTE_VALUE;
            this.sectionStart = this.index;
            return;
        }

        this.sectionStart = this.index + 1;
    }

    DQ_ATTRIBUTE_VALUE(char) {
        //: <div class="main"...
        if (char === Character.QUOTATION_MARK) {
            if (this.sectionStart !== this.index) {
                this.parser.onAttributeValue?.(this.sectionStart, this.index);
                this.parser.onAttributeEnd?.(Quote.DOUBLE);
            }

            this.state = this.BEFORE_ATTRIBUTE_NAME;

        //: <div class="&...
        } else if (char === Character.AMPERSAND) {
            this.previous = this.state;
            this.state = this.BEFORE_ATTRIBUTE_ENTITY;
        }
    }

    SQ_ATTRIBUTE_VALUE(char) {
        //: <div class='main'...
        if (char === Character.APOSTROPHE) {
            if (this.sectionStart !== this.index) {
                this.parser.onAttributeValue?.(this.sectionStart, this.index);
                this.parser.onAttributeEnd?.(Quote.SINGLE);
            }

            this.state = this.BEFORE_ATTRIBUTE_NAME;
        
        //: <div class='&...
        } else if (char === Character.AMPERSAND) {
            this.previous = this.state;
            this.state = this.BEFORE_ATTRIBUTE_ENTITY;
        }
    }

    NQ_ATTRIBUTE_VALUE(char) {
        //: <div class=main ...
        if (isWhitespace(char)) {
            if (this.sectionStart !== this.index) {
                this.parser.onAttributeValue?.(this.sectionStart, this.index);
                this.parser.onAttributeEnd?.(Quote.NULLUM);
            }

            this.state = this.BEFORE_ATTRIBUTE_NAME;
        
        //: <div class=&...
        } else if (char === Character.AMPERSAND) {
            this.previous = this.state;
            this.state = this.BEFORE_ATTRIBUTE_ENTITY;
        
        //: <div class=a>
        } else if (char === Character.GREATER_THAN) {
            if (this.sectionStart !== this.index) {
                this.parser.onAttributeValue?.(this.sectionStart, this.index);
                this.parser.onAttributeEnd?.();
            }

            this.parser.onStartTagClose?.();
            this.state = this.sequence ? this.RAW_TEXT : this.PAGE;
            this.sectionStart = this.index + 1;
        }

        //: Self-Closing case ignored.
    }

    BEFORE_ATTRIBUTE_ENTITY(char) {
        //: &a... &#...
        if (isAlphanumeric(char) || char === Character.NUMBER) {
            if (this.sectionStart !== this.index - 1) {
                this.parser.onAttributeValue?.(this.sectionStart, this.index - 1);
            }

            this.state = this.ATTRIBUTE_ENTITY;
            this.sectionStart = this.index;

        //: & ...
        } else {
            this.state = this.previous;
            this.state(char); 
        }
    }

    ATTRIBUTE_ENTITY(char) {
        //: &a...
        if (isAlphanumeric(char)) {
            return;

        } else {
            this.parser.onAttributeEntity?.(this.sectionStart, this.index);
            this.state = this.previous;

            //: &a;
            if (char === Character.SEMI_COLON) {
                this.sectionStart = this.index + 1;

            //: &a"...
            } else {
                this.sectionStart = this.index;
                this.state(char);
            }
        }
    }

    SELF_CLOSING_TAG(char) {
        //: <img/>
        if (char === Character.GREATER_THAN) {
            this.parser.onSelfClosingTag?.();
            this.parser.onStartTagClose?.(this.sectionStart, this.index - 1);
            this.state = this.PAGE;
            this.sectionStart = this.index + 1;

        //: <img/s...
        } else if (!isWhitespace(char)) {
            this.state = this.ATTRIBUTE_NAME;
            this.sectionStart = this.index;
        }
    }

    END_TAG_OPEN(char) {
        //: </d...
        if (isAlphabetic(char)) {
            if (this.sectionStart !== this.index - 2) {
                this.parser.onText?.(this.sectionStart, this.index - 2);
                this.parser.onTextEnd?.();
            }

            this.state = this.END_TAG_NAME;
            this.sectionStart = this.index;

        //: </<... </>... </0...
        } else if (!isWhitespace(char)) {
            this.state = this.TEXT;
        }
    }

    END_TAG_NAME(char) {
        //: </div>
        if (char === Character.GREATER_THAN) {
            this.parser.onEndTagName?.(this.sectionStart, this.index);
            this.state = this.PAGE;
            this.sectionStart = this.index + 1;

        //: </div ...
        } else if (isWhitespace(char)) {
            this.parser.onEndTagName?.(this.sectionStart, this.index);
            this.state = this.AFTER_END_TAG_NAME;
        }

        //: Self-Closing case ignored.
    }

    AFTER_END_TAG_NAME(char) {
        //: </div ...>
        if (char === Character.GREATER_THAN) {
            this.state = this.PAGE;
            this.sectionStart = this.index + 1;
        }
    }
}

//: FIXME Solve the code repetition while retaining performance. More prominently, across attribute states.
//: FIXME Try to eliminate the use of next state as it's only used in START_SEQUENCE_MATCH.
//: FIXME Rework decoding and try to short-circuit on reference match.
//: FIXME Decide on whether to switch to tree sequence matching or settle for additional states.
