const terminalInput = document.getElementById('terminal-input');
const commandInput = document.getElementById('commandInput');
const terminalPInput = document.getElementById('prompt-user');

const fileInput = document.getElementById('fileInput');

let currentUser = "guest";
let globalKey = null;

let temp_name = "";
let temp_data = "";

let oldCommands = [];
let oldCommandsIndex = -1;

document.addEventListener("click", function () {if (terminalInput.style.display != "none") commandInput.focus()});


function sendCommand(element){
    let command = element.value;
    commandInput.value = "";

    processCommand(command);
}

function navigateHistory(direction) {
    if (oldCommands.length === 0) return;
    oldCommandsIndex += direction;
    if (oldCommandsIndex < 0) oldCommandsIndex = 0;
    if (oldCommandsIndex >= oldCommands.length) {
        oldCommandsIndex = oldCommands.length;
        commandInput.value = "";
        return;
    }
    commandInput.value = oldCommands[oldCommandsIndex];
    commandInput.setSelectionRange(commandInput.value.length, commandInput.value.length);
}


function processCommand(command) {
    // Save command to history
    if (command.trim() !== "") {
        oldCommands.push(command);
        oldCommandsIndex = oldCommands.length;
    }
    // Login command
    if (command.startsWith("login")) {
        let keyInput = command.split(" ")[1];
        if (keyInput != null) {
            fetch(`/login?key=${encodeURIComponent(keyInput)}`, {
                method: 'POST',
            })
            .then(async response => {
                if (response.status == 200) {
                    let reqJson = await response.json();
                    globalKey = reqJson.key; 
                    // Change input User
                    currentUser = "admin";
                    terminalPInput.innerHTML = `<span style="color:#2bff00;">${currentUser}@panel</span>:<span style="color:#162dd8;">~ $</span>`;

                    printToTerminal(`Logged in with key: ${keyInput}`, command);
                }
                else {
                    printToTerminal(`Login failed: incorrect key`, command);
                }
            })
        } else {
            printToTerminal(`Please provide a key, example: login 1234`, command);
        }
    }

    // *Reset Attempts
    else if (globalKey != null && command == "reset_attempts") {
        fetch(`/reset_attempts?key=${globalKey}`, {
            method: 'POST',
        })
        .then(response => {
            if (response.status == 200) {
                printToTerminal(`Attempts reseted successfully`, command);
            }
            else if (response.status == 401) {
                printToTerminal(`Error: Invalid key`, command);
            }
            else {
                printToTerminal(`Error: Unable to reset attempts`, command);
            }
        })
    }

    // *Logout
    else if (globalKey != null && command == "logout") {
        globalKey = null;
        currentUser = "guest";
        // Change input User
        terminalPInput.innerHTML = `<span style="color:#2bff00;">${currentUser}@panel</span>:<span style="color:#162dd8;">~ $</span>`;
        
        printToTerminal(`Logged out`, command);
    }

    // *Search
    else if (globalKey != null && command.startsWith("search")) {
        let searchTerm = command.split(" ").slice(1).join(" ");
        if (searchTerm == "") {
            printToTerminal(`Please provide a search term, example: search example`, command);
        }
        else {
            fetch(`/search?key=${encodeURIComponent(globalKey)}&query=${encodeURIComponent(searchTerm)}`, {
                method: 'POST',
            })
            .then(async response => {
                if (response.status == 200) {
                    let reqJson = await response.json();

                    let results = "";
                    (reqJson.results).forEach(reorder); 
                    function reorder(item, index) {
                        results += `<br>${index+1}. ${item}`;
                    }
                    if (results == "") results = "No Results found";
                    printToTerminal(`Search results: ${results}`, command);
                }
                else if (response.status == 401) {
                    printToTerminal(`Login failed: incorrect key`, command);
                }
                else {
                    printToTerminal(`Error: Unable to perform search`, command);
                }
            })
        }
    }

    // *Data
    else if (globalKey != null && command.startsWith("data")) {
        let args = (command.match(/'[^']*'|"[^"]*"|\S+/g) || []).map(a => a.replace(/^['"]|['"]$/g, ""));
        if (args[1] == "-e") {
            if (args[2] == null || args[3] == null) {
                printToTerminal(`Error: Provide the old and new Data Folder names`, command);
            }
            else {
                fetch(`/data_edit?key=${encodeURIComponent(globalKey)}&old_name=${encodeURIComponent(args[2])}&new_name=${encodeURIComponent(args[3])}`, {
                    method: 'POST',
                })
                .then(async response => {
                    if (response.status == 200) {
                        printToTerminal(`Data renamed from '${args[2]}' to '${args[3]}'`, command);
                    } else if (response.status == 401) {
                        printToTerminal(`Error: Invalid key`, command);
                    }
                    else if (response.status == 404) {
                        printToTerminal(`Error: Unable to find the Data Folder with this name '${args[2]}'`, command);
                    }
                    else if (response.status == 409) {
                        printToTerminal(`Error: There is already a Data Folder with this name '${args[3]}'`, command);
                    }
                    else {
                        printToTerminal(`Error: Unable to edit the Data Folders name`, command);
                    }
                })
            }
        }
        else if (args[1] == "-rm") {
            if (args[2] == null) {
                printToTerminal(`Error: Provide the Data Folder name`, command);
            }
            else {
                fetch(`/data_remove?key=${encodeURIComponent(globalKey)}&name=${encodeURIComponent(args[2])}`, {
                    method: 'POST',
                })
                .then(async response => {
                    if (response.status == 200) {
                        printToTerminal(`The Data Folder '${args[2]}' has been removed`, command);
                    } else if (response.status == 401) {
                        printToTerminal(`Error: Invalid key`, command);
                    }
                    else if (response.status == 404) {
                        printToTerminal(`Error: Unable to find a Data Folder with this name '${args[2]}'`, command);
                    }
                    else {
                        printToTerminal(`Error: Unable to remove the Data Folder`, command);
                    }
                })
            }
        }
        else if (args[1] == "-c") {
            if (args[2] == null) {
                printToTerminal(`Error: Provide the Data Folder name`, command);
            }
            else {
                fetch(`/data_create?key=${encodeURIComponent(globalKey)}&name=${encodeURIComponent(args[2])}`, {
                    method: 'POST',
                })
                .then(async response => {
                    if (response.status == 200) {
                        printToTerminal(`The Data Folder '${args[2]}' has been created`, command);
                    } else if (response.status == 401) {
                        printToTerminal(`Error: Invalid key`, command);
                    }
                    else if (response.status == 409) {
                        printToTerminal(`Error: A Data Folder with this name already exists`, command);
                    }
                    else {
                        printToTerminal(`Error: Unable to create the Data Folder`, command);
                    }
                })
            }
        }
        else if (args[1] == "-ls") {
            fetch(`/data_list?key=${encodeURIComponent(globalKey)}`, {
                method: 'POST',
            })
            .then(async response => {
                let reqJson = await response.json();
                if (response.status == 200) {
                    let results = "";
                    
                    let maxSpaceR = [0,0,0];
                    let indexR = 0;
                    function get_reorder_data(item, index) {
                        if (indexR === 3) {
                        indexR = 0;
                        }
                        if (item.length + 4 > maxSpaceR[indexR]) 
                        maxSpaceR[indexR] = item.length + 4;
                        indexR++;
                    }
                    let indexRG = 0;
                    function reorder_items(item, index) {
                    if (indexRG === 3) {
                        indexRG = 0;
                        results += "<br>"
                    }
                    results += item.padEnd(maxSpaceR[indexRG], " ");
                    indexRG++;
                    }

                    (reqJson.message).forEach(get_reorder_data); 
                    (reqJson.message).forEach(reorder_items); 

                    if (results == "") results = "No Data Folders found";
                    printToTerminal(`Data Folders: <br>${results}`, command);
                } else if (response.status == 401) {
                    printToTerminal(`Error: Invalid key`, command);
                }
                else {
                    printToTerminal(`Error: Unable to get the Data Folders`, command);
                }
            })
        }
        // Help Version
        else {
            printToTerminal(`Data Commands:<br>- Edit a Data Folder: data -e <old_name> <new_name><br>- Remove a Data Folder: data -rm <name><br>- Create a Data Folder: data -c <name><br>- See all Data Folders: data -ls`, command);
        }
    }

    // *File
    else if (globalKey != null && command.startsWith("file")) {
        let args = (command.match(/'[^']*'|"[^"]*"|\S+/g) || []).map(a => a.replace(/^['"]|['"]$/g, ""));
        if (args[1] == "-a") {
            if (args[2] != null) {
                temp_name = args[2]
                fileInput.click();
                printToTerminal(`I opened the window to add files '${args[2]}'`, command, true);
            }
            else {
                printToTerminal(`Error: Provide the Data Folder Name`, command);
            }
        }
        else if (args[1] == "-ls") {
            if (args[2] != null) {
                fetch(`/file_list?key=${encodeURIComponent(globalKey)}&name=${encodeURIComponent(args[2])}`, {
                    method: 'POST',
                })
                .then(async response => {
                    let reqJson = await response.json();
                    if (response.status == 200) {
                        let results = "";

                        let maxSpaceR = [0,0,0];
                        let indexR = 0;
                        function get_reorder_data(item, index) {
                            if (indexR === 3) {
                            indexR = 0;
                            }
                            if (item.length + 4 > maxSpaceR[indexR]) 
                            maxSpaceR[indexR] = item.length + 4;
                            indexR++;
                        }
                        let indexRG = 0;
                        function reorder_items(item, index) {
                        if (indexRG === 3) {
                            indexRG = 0;
                            results += "<br>"
                        }
                        results += item.padEnd(maxSpaceR[indexRG], " ");
                        indexRG++;
                        }

                        (reqJson.message).forEach(get_reorder_data); 
                        (reqJson.message).forEach(reorder_items); 

                        if (results == "") results = "No Files found";
                        printToTerminal(`Files in '${args[2]}': <br>${results}`, command);
                    }
                    else if (response.status == 404) {
                        printToTerminal(`Error: Data Folder with this name doesn't exists`);
                    }
                    else if (response.status == 401) {
                        printToTerminal(`Error: Invalid key`, command);
                    }
                    else {
                        printToTerminal(`Error: Unable to get the Files from the Data Folders`);
                    }
                })
            } 
            else {
                printToTerminal(`Error: Provide the Data Folder Name`, command);
            }
        }
        else if (args[1] == "-rm") {
            if (args[2] == null || args[3] == null) {
                printToTerminal(`Error: Provide the Data Folder name and the File name`, command);
            }
            else {
                fetch(`/file_remove?key=${encodeURIComponent(globalKey)}&name=${encodeURIComponent(args[2])}&file_name=${encodeURIComponent(args[3])}`, {
                    method: 'POST',
                })
                .then(async response => {
                    if (response.status == 200) {
                        printToTerminal(`The file '${args[3]}' in the Data Folder '${args[2]}' has been removed`, command);
                    } else if (response.status == 401) {
                        printToTerminal(`Error: Invalid key`, command);
                    }
                    else if (response.status == 404) {
                        printToTerminal(`Error: Unable to find a Data Folder with this name '${args[2]}'`, command);
                    }
                    else if (response.status == 406) {
                        printToTerminal(`Error: No file found with this name in the Data Folder '${args[3]}'`, command);
                    }
                    else {
                        printToTerminal(`Error: Unable to remove the Data Folder`, command);
                    }
                })
            }
        }
        else if (args[1] == "-r") {
            if (args[2] == null || args[3] == null || args[4] == null) {
                printToTerminal(`Error: Provide the Data Folder name, the old file name and the new file name`, command);
            }
            else {
                fetch(`/file_rename?key=${encodeURIComponent(globalKey)}&name=${encodeURIComponent(args[2])}&old_file_name=${encodeURIComponent(args[3])}&new_file_name=${encodeURIComponent(args[4])}`, {
                    method: 'POST',
                })
                .then(async response => {
                    if (response.status == 200) {
                        printToTerminal(`The file '${args[3]}' in the Data Folder '${args[2]}' has been renamed to ${args[4]}`, command);
                    } else if (response.status == 401) {
                        printToTerminal(`Error: Invalid key`, command);
                    }
                    else if (response.status == 404) {
                        printToTerminal(`Error: Unable to find a Data Folder with this name '${args[2]}'`, command);
                    }
                    else if (response.status == 406) {
                        printToTerminal(`Error: No file found with this name in the Data Folder '${args[3]}'`, command);
                    }
                    else if (response.status == 409) {
                        printToTerminal(`Error: A file with the name '${args[4]}' already exists in the Data Folder`, command);
                    }
                    else {
                        printToTerminal(`Error: Unable to change the rename a file in the Data Folder`, command);
                    }
                })
            }
        }
        else if (args[1] == "-d") {
            if (args[2] == null || args[3] == null) {
                printToTerminal(`Error: Provide the Data Folder name and the file name`, command);
            }
            else {
                printToTerminal(`Loading...`, command);
                fetch(`/file_download?key=${encodeURIComponent(globalKey)}&name=${encodeURIComponent(args[2])}&file_name=${encodeURIComponent(args[3])}`, {
                    method: 'POST',
                })
                .then(async response => {
                    if (response.status == 200) {
                        let blob = await response.blob();
                        let url_blob = URL.createObjectURL(blob);
                        var fileLink = document.createElement('a');
                        fileLink.href = url_blob;
                        fileLink.download = args[3];
                        fileLink.click();
                        fileLink.remove();

                        printToTerminal(`The file '${args[3]}' from the Data Folder '${args[2]}' is being downloaded`, "", false);
                    } else if (response.status == 401) {
                        printToTerminal(`Error: Invalid key`, "", false);
                    }
                    else if (response.status == 404) {
                        printToTerminal(`Error: Unable to find the file or the Data Folder`, "", false);
                    }
                    else {
                        printToTerminal(`Error: Unable to download the file from the Data Folder`, "", false);
                    }
                })
            }
        }
        else if (args[1] == "-e") {
            if (args[2] == null || args[3] == null) {
                printToTerminal(`Error: Provide the Data Folder name and the file name`, command);
            }
            else {
                fetch(`/file_get?key=${encodeURIComponent(globalKey)}&name=${encodeURIComponent(args[2])}&file_name=${encodeURIComponent(args[3])}`, {
                    method: 'POST',
                })
                .then(async response => {
                    if (response.status == 200) {
                        let content = await response.json();
                        temp_name = args[3]
                        temp_data = args[2]

                        printToTerminal("", command);
                        // Open editor
                        pPropmptContainer = document.createElement("div");
                        pPropmptContainer.id = "edit-propt-container"
                        document.body.insertBefore(pPropmptContainer, terminalInput);

                        let pPropmptTitle = document.createElement("div");
                        pPropmptTitle.innerHTML = `D.T.A. Editor - Modifica il file '${args[3]}' per la data folder '${args[2]}'`;
                        pPropmptTitle.className = "file-edit-title";
                        pPropmptContainer.appendChild(pPropmptTitle);

                        let pPropmpt = document.createElement("div");
                        pPropmpt.className = "file-edit-textarea";
                        pPropmpt.contentEditable = "true";
                        pPropmpt.setAttribute("onkeydown", "if (event.altKey && event.key === 's') {closeEditor()}");
                        pPropmptContainer.appendChild(pPropmpt);
                        pPropmpt.innerText = content.content;
                        pPropmpt.id = "file-edit-textarea-id"
                        pPropmpt.focus();

                        let pPropmptEnd = document.createElement("div");
                        pPropmptEnd.innerHTML = `Press <a onclick="closeEditor()">[ALT + S]</a> to save and exit`;
                        pPropmptEnd.className = "file-edit-title";
                        pPropmptContainer.appendChild(pPropmptEnd);

                        terminalInput.style.display = "none";


                    } else if (response.status == 401) {
                        printToTerminal(`Error: Invalid key`, command);
                    }
                    else if (response.status == 404) {
                        printToTerminal(`Error: Unable to find a file name '${args[3]}' in the Data folder '${args[2]}'`, command);
                    }
                    else {
                        printToTerminal(`Error: Unable to change the rename a file in the Data Folder`, command);
                    }
                })
            }

        }
        // Help Version
        else {
            printToTerminal(`File Commands:<br>- Add files: file -a <data_folder_name><br>- See all files: file -ls <data_folder_name><br>- Remove a file: file -rm <data_folder_name> <file_name><br>- Rename a file: file -r <data_folder_name> <old_file_name> <new_file_name><br>- Download a file: file -d <data_folder_name> <file_name><br>- Edit a file: file -e <data_folder_name> <file_name>`, command);
        }
    }

    // Clear / CLS
    else if (command.startsWith("cls") || command.startsWith("clear")) {
        for (let i = document.body.children.length - 1; i >= 0; i--) {
            let child = document.body.children[i];
            if (child.id != "terminal-input" && child.tagName.toLowerCase() === "div") {
                document.body.removeChild(child);
            }
        }
    }

    // Help
    else if (command == "help" || command == "h" || command == "?") {
        printToTerminal(`Available Commands:<br>- login &lt;key&gt;<br>- *logout<br>- *reset_attempts<br>- *search &lt;term&gt;<br>- *data [options] (type 'data' for more info)<br>- *file [options] (type 'file' for more info)<br>- cls / clear<br>- help<br><br>Commands with * require to be logged in the administrator account`, command);
    }

    // Command Not Found
    else if (command != ""){
        printToTerminal(`Command not found: ${command}`, command);
    }
}


function closeEditor() {
    function getEditableText(el) {
        let html = el.innerHTML;

        html = html.replace(/<div><br><\/div>/g, "\n"); 
        html = html.replace(/<div>/g, "\n");           
        html = html.replace(/<\/div>/g, "");
        html = html.replace(/<br>/g, "\n");
        html = html.replace(/^\n+|\n+$/g, "");

        return html;
    }

    var innerText = getEditableText(document.getElementById('file-edit-textarea-id'));
    fetch(`/file_edit?key=${encodeURIComponent(globalKey)}&name=${encodeURIComponent(temp_data)}&file_name=${encodeURIComponent(temp_name)}&content=${encodeURIComponent(innerText)}`, {
        method: 'POST',
    })
    .then(async response => {
        if (response.status == 200) {
            printToTerminal(`File edited successfully`, "", false);
        }
        else if (response.status == 401) {
            printToTerminal(`Error: Invalid key`, "", false);
        }
        else if (response.status == 404) {
            printToTerminal(`Error: Unable to find a Data Folder with this name '${temp_name}'`, "", false);
        }
        else {
            printToTerminal(`Error: Unable to edit the file`, "", false);
        }
    })

    document.getElementById("edit-propt-container").remove();
    terminalInput.style.display = "flex";
    commandInput.focus();

}



fileInput.addEventListener('change', () => {
    terminalInput.style.display = "none";

    var data = new FormData()
    for (const file of fileInput.files) {
        data.append('files',file,file.name)
    }
    fetch(`/file_add?key=${encodeURIComponent(globalKey)}&name=${encodeURIComponent(temp_name)}`, {
        method: 'POST',
        body: data
    })
    .then(response => {

        if (response.status == 200) {
            printToTerminal(`File caricati con successo`, "", false);
        } 
        else if (response.status == 401) {
            printToTerminal(`Error: Invalid key`, "", false);
        }
        else if (response.status == 404) {
            printToTerminal(`Error: Unable to find a Data Folder with this name '${temp_name}'`, "", false);
        }
        else {
            printToTerminal(`Error: Unable to upload files`, "", false);
        }
        // Reset
        temp_name = "";
        terminalInput.style.display = "flex";
        commandInput.focus();
    })
});




function printToTerminal(text, command="", newLine=true) {
    let divInput = document.createElement("div");
    document.body.insertBefore(divInput, terminalInput);
    if (newLine) {
        let pInput = document.createElement("p");
        pInput.innerHTML = `<span style="color:#2bff00;">${currentUser}@panel</span>:<span style="color:#162dd8;">~ $</span> ${command}`;
        divInput.appendChild(pInput);
        if (command != "" && newLine == false) {console.log("Error: You cannot add a command if you don't want a new line")};
    }
    let pResponse = document.createElement("p");
    pResponse.className = "p-spaced"
    pResponse.innerHTML = text;
    divInput.appendChild(pResponse);
    divInput.appendChild(document.createElement("br"));
    window.scrollTo({top: document.body.scrollHeight, behavior: 'smooth'});

}

