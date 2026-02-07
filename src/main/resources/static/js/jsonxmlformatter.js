 let currentData = null;
 let selectedType="JSON";
    let expandedStates = {};
    let foldStates = {};
    let foldHierarchy = {}; // Track parent-child relationships

    const codeEditor = document.getElementById('codeEditor');

    codeEditor.addEventListener('input', updateLineNumbers);
    codeEditor.addEventListener('scroll', syncScroll);
    codeEditor.addEventListener('paste', handlePaste);

    function handlePaste(e) {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
}

    function syncScroll() {
    document.getElementById('lineNumbers').scrollTop = codeEditor.scrollTop;
    document.getElementById('foldIcons').scrollTop = codeEditor.scrollTop;
}

    function updateLineNumbers() {
    const text = codeEditor.textContent || codeEditor.innerText || '';
    const lines = text.split('\n').length;
    let numbers = '';
    for (let i = 1; i <= lines; i++) {
    numbers += i + '\n';
}
    document.getElementById('lineNumbers').textContent = numbers;

    if (Object.keys(foldHierarchy).length === 0) {
    document.getElementById('foldIcons').innerHTML = '';
}
}

//     function toggleFold(foldId) {
//     foldStates[foldId] = !foldStates[foldId];
//
//     const arrow = document.getElementById('arrow_' + foldId);
//     if (foldStates[foldId]) {
//     arrow.textContent = '▶';
//     hideAllDescendants(foldId);
// } else {
//     arrow.textContent = '▼';
//     showDirectChildren(foldId);
// }
// }

    function hideAllDescendants(foldId) {
    // Hide all direct children lines
    document.querySelectorAll(`[data-parent="${foldId}"]`).forEach(el => {
        el.style.display = 'none';
    });

    // Recursively hide all nested folds
    if (foldHierarchy[foldId]) {
    foldHierarchy[foldId].forEach(childId => {
    const childArrow = document.getElementById('arrow_' + childId);
    if (childArrow) {
    childArrow.style.display = 'none';
}
    hideAllDescendants(childId);
});
}
}

    function showDirectChildren(foldId) {
    // Show all direct children
    document.querySelectorAll(`[data-parent="${foldId}"]`).forEach(el => {
        el.style.display = 'block';
    });

    // Show direct child fold arrows
    if (foldHierarchy[foldId]) {
    foldHierarchy[foldId].forEach(childId => {
    const childArrow = document.getElementById('arrow_' + childId);
    if (childArrow) {
    childArrow.style.display = 'block';
}
    // Don't show nested children if child is folded
    if (!foldStates[childId]) {
    showDirectChildren(childId);
}
});
}
}

    function renderColoredCode(json) {
    const lines = json.split('\n');
    let codeHtml = '';
    let numbersHtml = '';
    let iconsHtml = '';
    let foldId = 0;
    let stack = [];
    foldHierarchy = {};

    lines.forEach((line, idx) => {
    const trimmed = line.trim();
    const indent = line.length - line.trimLeft().length;
    const spaces = ' '.repeat(indent);
    const lineNum = idx + 1;

    const currentParent = stack.length > 0 ? stack[stack.length - 1] : null;

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const id = 'fold_' + (foldId++);
    stack.push(id);

    // Track hierarchy
    if (currentParent) {
    if (!foldHierarchy[currentParent]) {
    foldHierarchy[currentParent] = [];
}
    foldHierarchy[currentParent].push(id);
}

    // Code line
    if (currentParent) {
    codeHtml += `<div class="code-line" data-parent="${currentParent}">${spaces}${highlightSyntax(trimmed)}</div>`;
} else {
    codeHtml += `<div class="code-line">${spaces}${highlightSyntax(trimmed)}</div>`;
}

    // Number line
    if (currentParent) {
    numbersHtml += `<div class="code-line" data-parent="${currentParent}">${lineNum}</div>`;
} else {
    numbersHtml += `<div class="code-line">${lineNum}</div>`;
}

    // Icon with fold arrow
//     if (currentParent) {
//     iconsHtml += `<div class="fold-arrow" data-parent="${currentParent}" id="arrow_${id}" onclick="toggleFold('${id}')">▼</div>`;
// } else {
//     iconsHtml += `<div class="fold-arrow" id="arrow_${id}" onclick="toggleFold('${id}')">▼</div>`;
// }

} else if (trimmed === '}' || trimmed === '},' || trimmed === ']' || trimmed === '],') {
    stack.pop();
    const newParent = stack.length > 0 ? stack[stack.length - 1] : null;

    if (newParent) {
    codeHtml += `<div class="code-line" data-parent="${newParent}">${spaces}${highlightSyntax(trimmed)}</div>`;
    numbersHtml += `<div class="code-line" data-parent="${newParent}">${lineNum}</div>`;
    iconsHtml += `<div class="fold-arrow" data-parent="${newParent}"></div>`;
} else {
    codeHtml += `<div class="code-line">${spaces}${highlightSyntax(trimmed)}</div>`;
    numbersHtml += `<div class="code-line">${lineNum}</div>`;
    iconsHtml += `<div class="fold-arrow"></div>`;
}
} else {
    if (currentParent) {
    codeHtml += `<div class="code-line" data-parent="${currentParent}">${spaces}${highlightSyntax(trimmed)}</div>`;
    numbersHtml += `<div class="code-line" data-parent="${currentParent}">${lineNum}</div>`;
    iconsHtml += `<div class="fold-arrow" data-parent="${currentParent}"></div>`;
} else {
    codeHtml += `<div class="code-line">${spaces}${highlightSyntax(trimmed)}</div>`;
    numbersHtml += `<div class="code-line">${lineNum}</div>`;
    iconsHtml += `<div class="fold-arrow"></div>`;
}
}
});

    return { code: codeHtml, numbers: numbersHtml, icons: iconsHtml };
}

    function highlightSyntax(text) {
    return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"([^"]+)":/g, '<span class="key">"$1"</span>:')
    .replace(/:\s*"([^"]*)"/g, ': <span class="string">"$1"</span>')
    .replace(/:\s*(\d+\.?\d*)/g, ': <span class="number">$1</span>')
    .replace(/:\s*(true|false)/g, ': <span class="boolean">$1</span>')
    .replace(/:\s*(null)/g, ': <span class="null">$1</span>')
    .replace(/([{}\[\]])/g, '<span class="bracket">$1</span>')
    .replace(/,(?![^"]*")/g, '<span class="bracket">,</span>');
}

 // function highlightXMLLine(line) {
 //     let result = line
 //         .replace(/&/g, '&amp;')
 //         .replace(/</g, '&lt;')
 //         .replace(/>/g, '&gt;');
 //
 //     // XML declaration: <?xml ... ?>
 //     result = result.replace(/(&lt;\?xml\s+)(.*?)(\?&gt;)/g, function(match, start, attrs, end) {
 //         let highlighted = '<span class="xml-tag">' + start + '</span>';
 //         highlighted += attrs.replace(/([\w:-]+)\s*=\s*"([^"]*)"/g, '<span class="xml-attr">$1</span>=<span class="xml-attr-value">"$2"</span>');
 //         highlighted += '<span class="xml-tag">' + end + '</span>';
 //         return highlighted;
 //     });
 //
 //     // Opening and self-closing tags
 //     result = result.replace(/(&lt;)([\w:-]+)((?:\s+[\w:-]+\s*=\s*"[^"]*")*)\s*(\/?)(&gt;)/g, function(match, lt, tagName, attrs, slash, gt) {
 //         let highlighted = '<span class="bracket">&lt;</span><span class="xml-tag">' + tagName + '</span>';
 //         if (attrs.trim()) {
 //             highlighted += attrs.replace(/([\w:-]+)\s*=\s*"([^"]*)"/g, ' <span class="xml-attr">$1</span>=<span class="xml-attr-value">"$2"</span>');
 //         }
 //         if (slash) {
 //             highlighted += '<span class="bracket">/</span>';
 //         }
 //         highlighted += '<span class="bracket">&gt;</span>';
 //         return highlighted;
 //     });
 //
 //     // Closing tags: </tagName>
 //     result = result.replace(/(&lt;\/)([\w:-]+)(&gt;)/g, '<span class="bracket">&lt;/</span><span class="xml-tag">$2</span><span class="bracket">&gt;</span>');
 //
 //     // Text content between tags
 //     result = result.replace(/(&gt;)([^&<]+)(&lt;)/g, function(match, gt, content, lt) {
 //         if (content.trim()) {
 //             return gt + '<span class="xml-text">' + content + '</span>' + lt;
 //         }
 //         return match;
 //     });
 //
 //     return result;
 // }

 // function highlightXMLLine(line) {
 //     let result = line
 //         .replace(/&/g, '&amp;')
 //         .replace(/</g, '&lt;')
 //         .replace(/>/g, '&gt;');
 //
 //     // XML declaration: <?xml ... ?>
 //     result = result.replace(/(&lt;\?xml\s+)(.*?)(\?&gt;)/g, function(match, start, attrs, end) {
 //         let highlighted = '<span class="xml-tag">' + start + '</span>';
 //         highlighted += attrs.replace(/([\w:-]+)\s*=\s*"([^"]*)"/g, '<span class="xml-attr">$1</span>=<span class="xml-attr-value">"$2"</span> ');
 //         highlighted += '<span class="xml-tag">' + end + '</span>';
 //         return highlighted;
 //     });
 //
 //     // Opening and self-closing tags
 //     result = result.replace(/(&lt;)([\w:-]+)((?:\s+[\w:-]+\s*=\s*"[^"]*")*)\s*(\/?)(&gt;)/g, function(match, lt, tagName, attrs, slash, gt) {
 //         let highlighted = '<span class="bracket">&lt;</span><span class="xml-tag">' + tagName + '</span>';
 //         if (attrs.trim()) {
 //             // Clean up and format attributes properly
 //             const cleanAttrs = attrs.trim().replace(/\s+/g, ' ');
 //             highlighted += ' ' + cleanAttrs.replace(/([\w:-]+)\s*=\s*"([^"]*)"/g, '<span class="xml-attr">$1</span>=<span class="xml-attr-value">"$2"</span>');
 //         }
 //         if (slash) {
 //             highlighted += '<span class="bracket">/</span>';
 //         }
 //         highlighted += '<span class="bracket">&gt;</span>';
 //         return highlighted;
 //     });
 //
 //     // Closing tags: </tagName>
 //     result = result.replace(/(&lt;\/)([\w:-]+)(&gt;)/g, '<span class="bracket">&lt;/</span><span class="xml-tag">$2</span><span class="bracket">&gt;</span>');
 //
 //     // Text content between tags
 //     result = result.replace(/(&gt;)([^&<]+)(&lt;)/g, function(match, gt, content, lt) {
 //         if (content.trim()) {
 //             return gt + '<span class="xml-text">' + content + '</span>' + lt;
 //         }
 //         return match;
 //     });
 //
 //     return result;
 // }
 function validateXML(xml) {
     const parser = new DOMParser();
     const doc = parser.parseFromString(xml, 'text/xml');

     // Check for parsing errors
     const parseError = doc.querySelector('parsererror');
     if (parseError) {
         return {
             valid: false,
             error: parseError.textContent || 'XML syntax error'
         };
     }

     // Check for unclosed tags manually
     const openTags = [];
     const tagRegex = /<\/?[\w:-]+[^>]*>/g;
     const matches = xml.match(tagRegex);

     if (matches) {
         for (let tag of matches) {
             if (tag.startsWith('<?') || tag.startsWith('<!')) continue; // Skip declarations
             if (tag.endsWith('/>')) continue; // Skip self-closing

             const tagName = tag.match(/<\/?([^\s>]+)/)[1];

             if (tag.startsWith('</')) {
                 // Closing tag
                 if (openTags.length === 0 || openTags[openTags.length - 1] !== tagName) {
                     return {
                         valid: false,
                         error: `Missing opening tag for </${tagName}>`
                     };
                 }
                 openTags.pop();
             } else {
                 // Opening tag
                 openTags.push(tagName);
             }
         }
     }

     if (openTags.length > 0) {
         return {
             valid: false,
             error: `Missing closing tag for <${openTags[openTags.length - 1]}>`
         };
     }

     return { valid: true };
 }

 function highlightXMLLine(line) {
     let result = line
         .replace(/&/g, '&amp;')
         .replace(/</g, '&lt;')
         .replace(/>/g, '&gt;');

     // XML declaration: <?xml ... ?>
     // result = result.replace(/(&lt;\?xml)(\s+.*?)(\?&gt;)/g, function(match, start, attrs, end) {
     //     let highlighted = '<span class="bracket">&lt;?</span><span class="xml-tag">xml</span>';
     //     if (attrs.trim()) {
     //         const formattedAttrs = attrs.replace(/([\w:-]+)\s*=\s*"([^"]*)"/g, ' <span class="xml-attr">$1</span>=<span class="xml-attr-value">"$2"</span>');
     //         highlighted += formattedAttrs;
     //     }
     //     highlighted += '<span class="bracket">?&gt;</span>';
     //     return highlighted;
     // });
     result = result.replace(/(&lt;\?xml\s+)(.*?)(\?&gt;)/g, function(match, start, attrs, end) {
         let highlighted = '<span class="bracket">&lt;?</span><span class="xml-tag">xml</span> ';
         const formattedAttrs = attrs.trim().replace(/([\w:-]+)\s*=\s*"([^"]*)"/g, '<span class="xml-attr">$1</span>=<span class="xml-attr-value">"$2"</span>');
         highlighted += formattedAttrs;
         highlighted += ' <span class="bracket">?&gt;</span>';
         return highlighted;
     });

     // Opening and self-closing tags
     result = result.replace(/(&lt;)([\w:-]+)((?:\s+[\w:-]+\s*=\s*"[^"]*")*)\s*(\/?)(&gt;)/g, function(match, lt, tagName, attrs, slash, gt) {
         let highlighted = '<span class="bracket">&lt;</span><span class="xml-tag">' + tagName + '</span>';
         if (attrs.trim()) {
             const cleanAttrs = attrs.trim();
             highlighted += ' ' + cleanAttrs.replace(/([\w:-]+)\s*=\s*"([^"]*)"/g, '<span class="xml-attr">$1</span>=<span class="xml-attr-value">"$2"</span>');
         }
         if (slash) {
             highlighted += '<span class="bracket">/</span>';
         }
         highlighted += '<span class="bracket">&gt;</span>';
         return highlighted;
     });

     // Closing tags: </tagName>
     result = result.replace(/(&lt;\/)([\w:-]+)(&gt;)/g, '<span class="bracket">&lt;/</span><span class="xml-tag">$2</span><span class="bracket">&gt;</span>');

     // Text content between tags
     result = result.replace(/(&gt;)([^&<]+)(&lt;)/g, function(match, gt, content, lt) {
         if (content.trim()) {
             return gt + '<span class="xml-text">' + content + '</span>' + lt;
         }
         return match;
     });
     // XML declaration: <?xml ... ?>


     return result;
 }
    function formatCode(isConverterReq,data,convertedTye) {
        let input;
        let type;
        if(isConverterReq){
           input=data;
           type=convertedTye;
        }else{
            input= (codeEditor.textContent || codeEditor.innerText || '').trim();
            type = document.getElementById('formatType').value;
        }
    const inputStatus = document.getElementById('inputStatus');

    if (!input) {
    inputStatus.innerHTML = '<span class="warning">Please enter some code first!</span>';
    return;
}

    try {
    if (type === 'json') {
    let parsed = JSON.parse(input);
    currentData = parsed;
        if (typeof parsed === "string") {
            parsed = JSON.parse(parsed);
        }
    const formatted = JSON.stringify(parsed, null, 2);

    const rendered = renderColoredCode(formatted);
    codeEditor.innerHTML = rendered.code;
    document.getElementById('lineNumbers').innerHTML = rendered.numbers;
    // document.getElementById('foldIcons').innerHTML = rendered.icons;

    foldStates = {};
    renderTree(parsed);

    inputStatus.innerHTML = '<span class="success">✓ JSON formatted successfully!</span>';
    document.getElementById('outputStatus').innerHTML = '<span class="success">✓ Tree view generated</span>';
} else if(type === 'xml'){
        if(input.startsWith('"{') || input.startsWith('{') || input.startsWith('[') || input.startsWith('"[')){
            document.getElementById('treeView').innerHTML = '<span class="error">Invalid XML</span>';
        return;
        }
        const validation = validateXML(input);
        const formatted = formatXML(input);
    // codeEditor.textContent = formatted;
        const lines = formatted.split('\n');let codeHtml = '';
        let numbersHtml = '';
        lines.forEach((line, idx) => {
            const highlighted = highlightXMLLine(line);  // ← YE CALL
            codeHtml += `<div class="code-line">${highlighted}</div>`;
            numbersHtml += `<div class="code-line">${idx + 1}</div>`;
        });
        codeEditor.innerHTML = codeHtml;  // ← YE IMPORTANT
        document.getElementById('lineNumbers').innerHTML = numbersHtml;
        document.getElementById('foldIcons').innerHTML = '';
        foldHierarchy = {};

    // updateLineNumbers();
    // foldHierarchy = {};
    // document.getElementById('foldIcons').innerHTML = '';
    const parsed = parseXMLToObject(input);
    currentData = parsed;
    renderTree(parsed);
        if (!validation.valid) {
            inputStatus.innerHTML = `<span style="color: #ff6b6b">✗ ${validation.error}</span>`;
            document.getElementById('treeView').innerHTML = `<div class="error">${validation.error}</div>`;
            // document.getElementById('outputStatus').innerHTML = '<span class="error">${validation.error}</span>';
            return;
        }
    inputStatus.innerHTML = '<span class="success">✓ XML formatted successfully!</span>';
    document.getElementById('outputStatus').innerHTML = '<span class="success">✓ Tree view generated</span>';
} else{
    codeEditor.innerHTML = input;
    document.getElementById('treeView').innerHTML = input;
}
} catch (e) {
    inputStatus.innerHTML = '<span style="color: #ff6b6b">✗ Error: ' + e.message + '</span>';
    document.getElementById('treeView').innerHTML = '<div class="error">Parse Error: ' + e.message + '</div>';
}
}

    function minifyCode() {
    const input = (codeEditor.textContent || codeEditor.innerText || '').trim();
    const type = document.getElementById('formatType').value;
    const inputStatus = document.getElementById('inputStatus');

    if (!input) {
    inputStatus.innerHTML = '<span class="warning">Please enter some code first!</span>';
    return;
}

    try {
    if (type === 'json') {
    const parsed = JSON.parse(input);
    const minified = JSON.stringify(parsed);
    codeEditor.textContent = minified;
    foldHierarchy = {};
    document.getElementById('foldIcons').innerHTML = '';
    updateLineNumbers();

    currentData = parsed;
    renderTree(parsed);

    inputStatus.innerHTML = '<span class="success">✓ JSON minified successfully!</span>';
    document.getElementById('outputStatus').innerHTML = '<span class="success">✓ Tree view updated</span>';
} else {
    const minified = input.replace(/>\s+</g, '><').trim();
    codeEditor.textContent = minified;
    foldHierarchy = {};
    document.getElementById('foldIcons').innerHTML = '';
    updateLineNumbers();
    inputStatus.innerHTML = '<span class="success">✓ XML minified successfully!</span>';
}
} catch (e) {
    inputStatus.innerHTML = '<span style="color: #ff6b6b">✗ Error: ' + e.message + '</span>';
}
}

    function repairCode() {
    const input = (codeEditor.textContent || codeEditor.innerText || '').trim();
    const type = document.getElementById('formatType').value;
    const inputStatus = document.getElementById('inputStatus');

    if (!input) {
    inputStatus.innerHTML = '<span class="warning">Please enter some code first!</span>';
    return;
}

    try {
    if (type === 'json') {
    let repaired = input
    .replace(/,(\s*[}\]])/g, '$1')
    .replace(/([{,]\s*)(\w+)(\s*):/g, '$1"$2"$3:')
    .replace(/'([^']*)'/g, '"$1"');

    const parsed = JSON.parse(repaired);
    const formatted = JSON.stringify(parsed, null, 2);

    const rendered = renderColoredCode(formatted);
    codeEditor.innerHTML = rendered.code;
    document.getElementById('lineNumbers').innerHTML = rendered.numbers;
    document.getElementById('foldIcons').innerHTML = rendered.icons;

    foldStates = {};
    currentData = parsed;
    renderTree(parsed);

    inputStatus.innerHTML = '<span class="success">✓ JSON repaired and formatted!</span>';
    document.getElementById('outputStatus').innerHTML = '<span class="success">✓ Tree view updated</span>';
} else {
    const formatted = formatXML(input);
    // codeEditor.textContent = formatted;
    // updateLineNumbers();
        const lines = formatted.split('\n');let codeHtml = '';
        let numbersHtml = '';
        // lines.forEach((line, idx) => {
        //     const highlighted = highlightXMLLine(line);  // ← YE CALL
        //     codeHtml += `<div class="code-line">${highlighted}</div>`;
        //     numbersHtml += `<div class="code-line">${idx + 1}</div>`;
        // });
        lines.forEach((line, idx) => {
            // Get indentation
            const indent = line.length - line.trimLeft().length;
            const spaces = '&nbsp;'.repeat(indent);  // Non-breaking spaces for HTML
            const trimmedLine = line.trim();

            const highlighted = highlightXMLLine(trimmedLine);
            codeHtml += `<div class="code-line">${spaces}${highlighted}</div>`;
            numbersHtml += `<div class="code-line">${idx + 1}</div>`;
        });


        codeEditor.innerHTML = codeHtml;  // ← YE IMPORTANT
        document.getElementById('lineNumbers').innerHTML = numbersHtml;
        document.getElementById('foldIcons').innerHTML = '';
        foldHierarchy = {};
    inputStatus.innerHTML = '<span class="success">✓ XML repaired and formatted!</span>';
}
} catch (e) {
    inputStatus.innerHTML = '<span style="color: #ff6b6b">✗ Could not repair: ' + e.message + '</span>';
}
}

    function formatXML(xml) {
    let formatted = '';
    let indent = '';
    xml.split(/>\s*</).forEach(function(node) {
    if (node.match(/^\/\w/)) indent = indent.substring(2);
    formatted += indent + '<' + node + '>\n';
    if (node.match(/^<?\w[^>]*[^\/]$/)) indent += '  ';
});
    return formatted.substring(1, formatted.length - 2);
}

    function parseXMLToObject(xml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');

    function xmlToJson(node) {
    if (node.nodeType === 3) return node.nodeValue.trim();
    let obj = {};
    if (node.attributes && node.attributes.length > 0) {
    for (let i = 0; i < node.attributes.length; i++) {
    obj['@' + node.attributes[i].name] = node.attributes[i].value;
}
}
    if (node.hasChildNodes()) {
    for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    const name = child.nodeName;
    if (child.nodeType === 3) {
    const text = child.nodeValue.trim();
    if (text) return text;
} else {
    if (typeof obj[name] === 'undefined') {
    obj[name] = xmlToJson(child);
} else {
    if (!Array.isArray(obj[name])) obj[name] = [obj[name]];
    obj[name].push(xmlToJson(child));
}
}
}
}
    return obj;
}
    return { [doc.documentElement.nodeName]: xmlToJson(doc.documentElement) };
}

    function renderTree(data) {
    const treeView = document.getElementById('treeView');
    treeView.innerHTML = '';

    function renderNode(obj, parent, key = 'root', level = 0, path = '') {
    const nodeId = path + '_' + key;

    if (Array.isArray(obj)) {
    const count = obj.length;
    const isExpanded = expandedStates[nodeId] !== false;

    const toggle = document.createElement('span');
    toggle.className = 'tree-expand';
    toggle.textContent = isExpanded ? '▼' : '▶';
    toggle.onclick = function() {
    expandedStates[nodeId] = !isExpanded;
    renderTree(currentData);
};

    const line = document.createElement('div');
    line.style.marginLeft = (level * 20) + 'px';
    line.appendChild(toggle);

    const keySpan = document.createElement('span');
    keySpan.className = 'tree-key';
    keySpan.textContent = key;
    line.appendChild(keySpan);

    line.appendChild(document.createTextNode(' : ['));

    const countSpan = document.createElement('span');
    countSpan.className = 'tree-count';
    countSpan.textContent = count + ' items';
    line.appendChild(countSpan);

    line.appendChild(document.createTextNode(' ]'));
    parent.appendChild(line);

    if (isExpanded) {
    obj.forEach((item, index) => {
    renderNode(item, parent, index.toString(), level + 1, nodeId);
});
}
} else if (typeof obj === 'object' && obj !== null) {
    const keys = Object.keys(obj);
    const count = keys.length;
    const isExpanded = expandedStates[nodeId] !== false;

    const toggle = document.createElement('span');
    toggle.className = 'tree-expand';
    toggle.textContent = isExpanded ? '▼' : '▶';
    toggle.onclick = function() {
    expandedStates[nodeId] = !isExpanded;
    renderTree(currentData);
};

    const line = document.createElement('div');
    line.style.marginLeft = (level * 20) + 'px';
    line.appendChild(toggle);

    const keySpan = document.createElement('span');
    keySpan.className = 'tree-key';
    keySpan.textContent = key;
    line.appendChild(keySpan);

    line.appendChild(document.createTextNode(' : {'));

    const countSpan = document.createElement('span');
    countSpan.className = 'tree-count';
    countSpan.textContent = count + ' props';
    line.appendChild(countSpan);

    line.appendChild(document.createTextNode(' }'));
    parent.appendChild(line);

    if (isExpanded) {
    keys.forEach(k => {
    renderNode(obj[k], parent, k, level + 1, nodeId);
});
}
} else {
    const line = document.createElement('div');
    line.style.marginLeft = (level * 20) + 'px';
    line.textContent = '  ';

    const keySpan = document.createElement('span');
    keySpan.className = 'tree-key';
    keySpan.textContent = key;
    line.appendChild(keySpan);

    line.appendChild(document.createTextNode(' : '));

    const valueSpan = document.createElement('span');
    if (typeof obj === 'string') {
    valueSpan.className = 'tree-string';
    valueSpan.textContent = '"' + obj + '"';
} else if (typeof obj === 'number') {
    valueSpan.className = 'tree-number';
    valueSpan.textContent = obj;
} else if (typeof obj === 'boolean') {
    valueSpan.className = 'tree-boolean';
    valueSpan.textContent = obj;
} else if (obj === null) {
    valueSpan.className = 'tree-null';
    valueSpan.textContent = 'null';
}
    line.appendChild(valueSpan);
    parent.appendChild(line);
}
}

    renderNode(data, treeView);
}

    function clearAll() {
    codeEditor.textContent = '';
    document.getElementById('foldIcons').innerHTML = '';
    document.getElementById('treeView').innerHTML = '<div style="padding: 20px; color: #858585;">Tree view will appear here after formatting</div>';
    updateLineNumbers();
    currentData = null;
    expandedStates = {};
    foldStates = {};
    foldHierarchy = {};
    document.getElementById('inputStatus').textContent = 'Cleared';
    document.getElementById('outputStatus').textContent = 'Cleared';
}

    function loadSample() {
      let type=  document.getElementById('formatType').value;
        let sample;
        if(type==='json') {
            sample   = `{
  "customer": {
    "id": "55000",
    "name": "Charter Group",
    "address": [
      {
        "street": "100 Main",
        "city": "Framingham",
        "state": "MA",
        "zip": "01701"
      },
      {
        "street": "720 Prospect",
        "city": "Framingham",
        "state": "MA",
        "zip": "01701"
      },
      {
        "street": "120 Ridge",
        "state": "MA",
        "zip": "01760"
      }
    ]
    }
    }`;
            formatCode(true,sample,'json');
        }else{
        sample=    '<?xml version="1.0"?>\n' +
            '<customers>\n' +
            '   <customer id="55000">\n' +
            '      <name>Charter Group</name>\n' +
            '      <address>\n' +
            '         <street>100 Main</street>\n' +
            '         <city>Framingham</city>\n' +
            '         <state>MA</state>\n' +
            '         <zip>01701</zip>\n' +
            '      </address>\n' +
            '      <address>\n' +
            '         <street>720 Prospect</street>\n' +
            '         <city>Framingham</city>\n' +
            '         <state>MA</state>\n' +
            '         <zip>01701</zip>\n' +
            '      </address>\n' +
            '      <address>\n' +
            '         <street>120 Ridge</street>\n' +
            '         <state>MA</state>\n' +
            '         <zip>01760</zip>\n' +
            '      </address>\n' +
            '   </customer>\n' +
            '</customers>'
            formatCode(true,sample,'xml');
        }
    // codeEditor.textContent = sample;
    // updateLineNumbers();
    // document.getElementById('inputStatus').innerHTML = '<span class="success">✓ Sample loaded - Click Format</span>';
}

    // Initialize
    updateLineNumbers();
    document.getElementById('treeView').innerHTML = '<div style="padding: 20px; color: #858585;">Tree view will appear here after formatting</div>';

    function selectedTypeShouldBeCorrect(type,inputData){
    if(type==="JSON" && inputData.startsWith("<") || inputData.startsWith('"<')){
    alert("Invalid JSON");
    } else if(type==="XML" && inputData.startsWith("{") || inputData.startsWith('"{')){
        alert("Invalid XML");
    }


}

 function formatData(type) {
     const selectedtype = document.getElementById('formatType').value;
     input= (codeEditor.textContent || codeEditor.innerText || '').trim();
     if(type==='REPAIR'){
         type = (selectedtype==='xml') ? "XML_FORMAT" : "JSON_FORMAT"
     }
     if(type === 'TOML' || type === 'YAML' || type === 'CSV') {
         type = selectedtype.toUpperCase() + "_TO_" + type;
     }
     fetch("/data/parse", {
         method: "POST",
         headers: {
             "Content-Type": "application/json"
         },
         body: JSON.stringify({
             type: type,
             data: input   // ✅ ALWAYS CLEAN DATA
         })
     })
         .then(res => res.json())
         .then(res => {
             if (res.success) {
                let format = 'json';
                if(type==='XML_FORMAT' || type==='JSON_TO_XML' || type==='XML_SORT') {
                    format = 'xml';
                }else if(type==='JSON_TO_YAML' || type==='XML_TO_YAML') {
                    format = 'yaml';
                }else if(type==='JSON_TO_TOML' || type==='XML_TO_TOML') {
                    format = 'toml';
                }else if(type==='JSON_TO_CSV' || type==='XML_TO_CSV') {
                    format = 'csv';
                }

                 const formatted = res.parsedData.replace(/\r\n/g, "\n");
                 formatCode(true,formatted, format);

             } else {
                 if(type==='XML_TO_JSON' || type=== 'JSON_TO_XML'){
                     document.getElementById('treeView').innerHTML = '<div class="error">Failed to convert: ' + res.message + '</div>';
                 }else{
                     document.getElementById('treeView').innerHTML = '<div class="error">Failed to repair: ' + res.message + '</div>';
                 }
             }
         })
         .catch(() => {
             outputEl.textContent = "Error while formatting";
             outputLines.textContent = "";
         });
 }

 let expandedPanel = null;

 function toggleExpand(side) {
   const container = document.getElementById('mainContainer');
   const leftPanel = document.getElementById('leftPanel');
   const middleControls = document.getElementById('middleControls');
   const rightPanel = document.getElementById('rightPanel');
   const leftIcon = document.getElementById('leftExpandIcon');
   const rightIcon = document.getElementById('rightExpandIcon');

   if (expandedPanel === side) {
     // Collapse - return to normal view
     container.classList.remove('expanded-left', 'expanded-right');
     leftPanel.classList.remove('hidden');
     middleControls.classList.remove('hidden');
     rightPanel.classList.remove('hidden');
     leftIcon.textContent = '⛶';
     rightIcon.textContent = '⛶';
     expandedPanel = null;
   } else {
     // Expand selected panel
     container.classList.remove('expanded-left', 'expanded-right');

     if (side === 'left') {
       container.classList.add('expanded-left');
       middleControls.classList.add('hidden');
       rightPanel.classList.add('hidden');
       leftIcon.textContent = '⛶';
       rightIcon.textContent = '⛶';
       expandedPanel = 'left';
     } else {
       container.classList.add('expanded-right');
       leftPanel.classList.add('hidden');
       middleControls.classList.add('hidden');
       leftIcon.textContent = '⛶';
       rightIcon.textContent = '⛶';
       expandedPanel = 'right';
     }
   }
 }