let uniqueIDs = new Set();

document.getElementById('dropZone').addEventListener('click', () => {
    document.getElementById('fileInput').click();
});

document.getElementById('dropZone').addEventListener('dragover', (event) => {
    event.preventDefault();
    event.target.classList.add('drop-zone-active');
});

document.getElementById('dropZone').addEventListener('dragleave', (event) => {
    event.target.classList.remove('drop-zone-active');
});

document.getElementById('dropZone').addEventListener('drop', (event) => {
    event.preventDefault();
    event.target.classList.remove('drop-zone-active');
    const files = event.dataTransfer.files;
    document.getElementById('fileInput').files = files;
    updateFileList(files);
});

document.getElementById('fileInput').addEventListener('change', (event) => {
    updateFileList(event.target.files);
});

function updateFileList(files) {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = `<p>Выбрано файлов: ${files.length}</p>`;
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileItem = document.createElement('div');
        fileItem.textContent = file.name;
        fileList.appendChild(fileItem);
    }
}

function processFiles() {
    const fileInput = document.getElementById('fileInput');
    const output = document.getElementById('output');
    const files = fileInput.files;
    let fileCounter = 0;
    let supCounter = 0;
    let outputText = '';
    uniqueIDs.clear();

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        fileCounter++;
        outputText += `\n${file.name}\n`;

        const reader = new FileReader();
        reader.onload = function(event) {
            const xmlString = event.target.result;
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlString, "text/xml");

            const products = xmlDoc.querySelectorAll("Product");

            products.forEach(product => {
                const pickingZone = product.querySelector("Values > Value[AttributeID='atr_picking_zone']");
                if (!pickingZone || pickingZone.textContent.length === 0) {
                    supCounter++;
                    const name = product.querySelector("Name").textContent;
                    const productId = product.getAttribute("ID");
                    outputText += `${productId} ${name}\n`;
                    uniqueIDs.add(productId);
                }
            });

            output.textContent = outputText;
            output.textContent += `\n${fileCounter} файла, ${supCounter} позиций\n`;

            // Show the copy button
            document.getElementById('copyBtn').style.display = 'inline';
        };

        reader.readAsText(file);
    }
}

function copyUniqueIDs() {
    const idsArray = Array.from(uniqueIDs);
    const idsString = idsArray.join('\n');
    navigator.clipboard.writeText(idsString).then(() => {
        
    }, () => {
        alert('Ошибка при копировании');
    });
}