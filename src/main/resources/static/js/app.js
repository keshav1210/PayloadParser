const inputEl = document.getElementById("input");
const inputLines = document.getElementById("input-lines");
const outputEl = document.getElementById("output");
const outputLines = document.getElementById("output-lines");

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

inputEl.addEventListener("input", () => {
    updateLineNumbers(inputEl.value, inputLines);
});

inputEl.addEventListener("scroll", () => {
    syncScroll(inputEl, inputLines);
});

outputEl.addEventListener("scroll", () => {
    syncScroll(outputEl, outputLines);
});

function formatData(type) {

    fetch("/data/parse", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            type: type,
            data: inputEl.value
        })
    })
        .then(res => res.json())
        .then(res => {
            if (res.success) {

                const formatted = res.parsedData.replace(/\r\n/g, "\n");

                inputEl.value = formatted;
                updateLineNumbers(formatted, inputLines);

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

updateLineNumbers("", inputLines);
updateLineNumbers("", outputLines);
