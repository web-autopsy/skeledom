const clean = /(?<=>)\s+|\s+(?=<)/g; // Whitespace after or before a tag.
const sweep = /(?<=>)\s+(?=<)/g;     // Whitespace between two tags.

export function minify(data, { strip = true } = {}) {
    // Remove extra whitespaces that are otherwise unintentionally parsed as data nodes.
    // Strip mode trims text fields.

    return data.replace(strip ? clean : sweep, '');
}

export default function energize(prototype) {
    Object.assign(prototype, {
        *posterity({ skip = 0, last = Infinity, inclusive = false, leaf = false } = {}) {
            // Depth-first n-ary tree traverser.
            // Levels index starts with the root node.
            // Inclusive mode includes absolute leaves (text fields) in the yield.
            // Leaf mode yields leaves only (respects inclusive mode).
        
            if (!last) return;
            const stack = [{ ancestor: this, index: 0 }];
            // Retained ancestry path (ancestors with unvisited children).
            // An array was used instead of the stack data structure to utilize spacial locality.
            
            for (let level = 1; stack.length; null) {
                // The retention (two-pass) approach was preferred over the traditional look-ahead (single-pass) approach for effective depth limiting.
    
                const top = stack[stack.length - 1]; // Peek at the closest unvisited ancestor.
                const { ancestor: { children: branch }, index } = top;
    
                let next = 0;
                if (++top.index === branch.length) {
                    // Ancestry augmentation stage (ancestor parenthood check).
                    // Release the ancestor if it has no pending children.
    
                    stack.pop();         // Release ancestor.
                    next = stack.length; // Next level, to be updated before the next iteration.
                }
                
                const { children } = branch[index];
                if (level < last && children?.length && (inclusive || children.length !== 1 || children[0].type !== 'text')) {
                    // Retention stage (node internity check).
                    // Release the node if it's either a data node or a tag node without children.
                    // Outside the inclusive mode, also release the node if it contains only a text field for a child (relative leaf).
                    
                    stack.push({ ancestor: branch[index], index: 0 }); // Retain node.
                    ++level;
                    if (leaf) continue; // Skip the yielding stage in the case of an internal node, when in leaf mode.
                }
    
                if (level > skip) yield branch[index];
                if (next) level = next;
            }
        },
        
        *descendants({ skip = 0, last = Infinity, inclusive = false, leaf = false } = {}) {
            // Breadth-first n-ary tree traverser.
            // Levels index starts with the root node.
            // Inclusive mode includes absolute leaves (text fields) in the yield.
            // Leaf mode yields leaves only (respects inclusive mode).
    
            if (!last) return;
            let queue = [this];
            // Retained nodes for the next level's reference (internal nodes only, leaves aren't retained).
            // An array was used instead of the queue data structure to utilize spacial locality.
        
            for (let level = 1 ;queue.length; ++level) {
                // The following implementation alternates between two arrays to avoid the cost of frequent unshift operations.
                // The retention (two-pass) approach was preferred over the traditional look-ahead (single-pass) approach for effective depth limiting.
        
                const ceiling = queue;  // Set the current breadth as the retained nodes.
                queue = [];             // Clear retained nodes.
                const retain = level < last;
                const submit = level > skip;
        
                for (let i = 0; i < ceiling.length; ++i) {   // Iterate over ceiling nodes.
                    const { children: branch } = ceiling[i]; // Get the branches of the current breadth.
        
                    for (let j = 0; j < branch.length; ++j) {
                        // All branch nodes are yielded but only some are released (yielded but not retained for next level).
                        // Branch nodes are inspected against a criteria and are released if they fail.
        
                        const { children } = branch[j];
                        if (retain && children?.length && (inclusive || children.length !== 1 || children[0].type !== 'text')) {
                            // Retention stage (node internity check).
                            // Release leaf nodes (all data nodes & tag nodes without children).
                            // Outside the inclusive mode, also release nodes that contain only a text field for a child (relative leaves).
        
                            queue.push(branch[j]); // Retain node.
                            if (leaf) continue;    // Skip the yielding stage in the case of an internal node, when in leaf mode.
                        }
        
                        if (submit) yield branch[j];
                    }
                }
            }
        },
    });
}
