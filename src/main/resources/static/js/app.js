// function formatJson(value) {
//     const input = document.getElementById("input");
//     const output = document.getElementById("output");
//     const outputLines = document.getElementById("outputLines");
//
//     fetch("/data/parse", {
//         method: "POST",
//         headers: {
//             "Content-Type": "application/json"
//         },
//         body: JSON.stringify({
//             type: value,
//             data: input.value
//         })
//     })
//         .then(response => response.json())
//         .then(res => {
//             if (res.success) {
//
//                 output.textContent = addLineNumbers(res.parsedData);
//                 input.value= addLineNumbers(res.parsedData);
//                 syncInputLines();// IMPORTANT
//             } else {
//                 output.textContent = res.message;
//             }
//         })
//         .catch(err => {
//             output.textContent = "Error while formatting JSON";
//             outputLines.textContent = "";
//         });
// }
//
// function generateLineNumbers(text) {
//     const lines = text.split("\n").length;
//     return Array.from({ length: lines }, (_, i) => i + 1).join("\n");
// }
// function syncInputLines() {
//     const input = document.getElementById("input");
//     const lines = document.getElementById("inputLines");
//     lines.textContent = generateLineNumbers(input.value);
// }
//
const inputEl = document.getElementById("input");
const inputLines = document.getElementById("input-lines");
const outputEl = document.getElementById("output");
const outputLines = document.getElementById("output-lines");

/* -------- Line Number Logic -------- */

function updateLineNumbers(text, gutterEl) {
    const lines = text.split("\n").length;
    let nums = "";
    for (let i = 1; i <= lines; i++) {
        nums += i + "\n";
    }
    gutterEl.textContent = nums;
}

function syncScroll(textEl, gutterEl) {
    gutterEl.scrollTop = textEl.scrollTop;
}

/* -------- Input Events -------- */

inputEl.addEventListener("input", () => {
    updateLineNumbers(inputEl.value, inputLines);
});

inputEl.addEventListener("scroll", () => {
    syncScroll(inputEl, inputLines);
});

/* -------- Output Scroll Sync -------- */

outputEl.addEventListener("scroll", () => {
    syncScroll(outputEl, outputLines);
});

/* -------- Formatter Call -------- */

function formatData(type) {

    fetch("/data/parse", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            type: type,
            data: inputEl.value   // ✅ ALWAYS CLEAN DATA
        })
    })
        .then(res => res.json())
        .then(res => {
            if (res.success) {

                const formatted = res.parsedData.replace(/\r\n/g, "\n");

                // INPUT → clean formatted data
                inputEl.value = formatted;
                updateLineNumbers(formatted, inputLines);

                // OUTPUT → display formatted data
                outputEl.textContent = formatted;
                updateLineNumbers(formatted, outputLines);

            } else {
                outputEl.textContent = res.message;
                outputLines.textContent = "";
            }
        })
        .catch(() => {
            outputEl.textContent = "Error while formatting";
            outputLines.textContent = "";
        });
}

/* -------- Initial State -------- */
updateLineNumbers("", inputLines);
updateLineNumbers("", outputLines);
