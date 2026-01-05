function formatJson() {
    const input = document.getElementById("input").value;
    const output = document.getElementById("output");


    fetch("/data/parse", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            type: "JSON_FORMAT",
            data: input
        })
    })
        .then(response => response.json())
        .then(res => {
            if (res.success) {
                output.textContent = res.parsedData; // IMPORTANT
            } else {
                output.textContent = res.message;
            }
        })
        .catch(err => {
            output.textContent = "Error while formatting JSON";
        });
}
