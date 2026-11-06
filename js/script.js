/*
    Desc: JavaScript code which will act as a simple feedback generator.  Gets the values from checkboxes and places them in a textarea.  This feedback can then be placed into My Learning Space.

    Author: Lynsay A. Shepherd

    Date: October 2019

*/


//wait for page to be ready
$( document ).ready(function() {

    //enable the option to copy the text
    setupClipboard();

    //Generate feedback- call function onclick
    $( "#generate" ).click(function() {
        try {
            generateFeedback();
          }
          catch(e) {

            generateFeedbackError();
          }
    });//close generator button click function


    //make sure line breaks survive copying into rich-text editors (see setupFeedbackCopyFormats)
    setupFeedbackCopyFormats();

    //Clear the page
    $('#clearFeedback').click(function() {
        clearPage();
    });

    //read file contents.  Where the browser supports it (Chrome/Edge) the file is opened with the
    //File System Access API so that added comments can be saved straight back to it; otherwise the
    //normal file input is used and the updated file is offered as a download.
    $('#fileSelector').click(function(e) {
        if (window.showOpenFilePicker) {
            e.preventDefault();
            openWithPicker();
        } else {
            readFileContents();
        }
    });

    //adding comments to a section (delegated: the list is rebuilt whenever it changes)
    setupAddComments();

    //fallback save (download) button
    $('#saveFile').click(function() {
        saveFeedbackFile(true);
    });

    //don't lose unsaved comments by accident
    window.addEventListener('beforeunload', function(e) {
        if (unsavedChanges) { e.preventDefault(); e.returnValue = ''; }
    });

    //deal with scroll to top
    $('.scrollButton').click(function() {
        scrollPage();
    });

});//close document.ready



/*
    Additional functions
*/


//show a short status pill in the given element, then fade it away (styling lives in override.css)
function flashStatus(selector, message, isError){
    var cls = isError ? "status-error" : "status-ok";
    //quick fade in, stay fully visible long enough to read (4s), then fade out
    $(selector).stop(true).css("opacity", 0).text(message)
        .removeClass("status-ok status-error").addClass(cls)
        .animate({opacity:1}, 300)
        .delay(4000)
        .animate({opacity:0}, 800, function(){
            $(this).text("").removeClass("status-ok status-error").css("opacity", 1);
        });
}

//Copying: put the feedback on the clipboard as plain text AND as HTML.  Rich-text editors (like the one in
//My Learning Space) use the HTML, in which each blank-line break is a real paragraph, so the breaks aren't
//lost when pasting.  Plain-text targets get the same breaks, minus stray spaces left at the end of lines.
function feedbackToPlainText(text){
    return text.replace(/\r\n?/g, "\n")
               .replace(/[ \t]+\n/g, "\n")      //spaces left on the end of a line
               .replace(/\n{3,}/g, "\n\n")      //never more than one blank line between paragraphs
               .trim();
}

function feedbackToHtml(text){
    function esc(t){ return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
    return feedbackToPlainText(text).split(/\n{2}/).map(function(paragraph){
        return "<p>" + esc(paragraph).replace(/\n/g, "<br>") + "</p>";
    }).join("");
}

function setupFeedbackCopyFormats(){
    var copyingFeedback = false;

    //runs before clipboard.js (which listens on the document), so the flag is set in time
    $("#copyToClipboard").on("click", function(){
        copyingFeedback = true;
        setTimeout(function(){ copyingFeedback = false; }, 0);
    });

    //the copy event fires while clipboard.js copies the textarea; swap in both formats
    document.addEventListener("copy", function(e){
        if (!copyingFeedback || !e.clipboardData) { return; }
        var text = $("#feedbackText").val();
        e.clipboardData.setData("text/plain", feedbackToPlainText(text));
        e.clipboardData.setData("text/html", feedbackToHtml(text));
        e.preventDefault();
    });
}

//setup the clipboard- allow users to copy from the textarea
function setupClipboard(){
    //setup clipboard
    var clipboard = new ClipboardJS('#copyToClipboard');

    clipboard.on('success', function(e) {
        flashStatus("#fadeCopyClearText", "Feedback copied", false);
    });

    clipboard.on('error', function(e) {
        flashStatus("#fadeCopyClearText", "Error copying feedback", true);
    
    });  
}


//generate the feedback from the selected checkboxes.
function generateFeedback(){
    //check if boxes are selected
    var fullText="";
    $('input[name="feedback"]:checked').each(function() {
        fullText=fullText + this.value;
    });
    $('#feedbackText').val(fullText);

    flashStatus("#fadeGenerateText", "Feedback generated", false);
}



//generate feedback error
function generateFeedbackError(){
    flashStatus("#fadeGenerateText", "Error generating feedback", true);
}

//clear the page and start again
function clearPage(){
    //location.reload(true);
    $('input[name="feedback"]').each(function() 
    { 
            this.checked = false; 
    }); 
    $('#feedbackText').val('');
    scrollPage();
}


/*
    Feedback file model.
    The file is parsed into a list of entries (so it can be edited and written back out exactly as it
    was), and the checkbox list is drawn from that list.
      type: 'blank' | 'heading' | 'break' | 'phrase'
*/
var feedbackModel = [];     //entries, in file order
var nextEntryId = 0;
var fileEol = "\n";         //line ending used by the loaded file, kept when saving
var fileName = "feedback.txt";
var fileHandle = null;      //set when opened via the File System Access API
var unsavedChanges = false;

//turn the text of a file into the model
function parseFeedback(text){
    fileEol = text.indexOf("\r\n") !== -1 ? "\r\n" : "\n";
    feedbackModel = text.split(/\r?\n/).map(function(line){
        var type = "phrase", value = line;
        if (line.charAt(0) === "")       { type = "blank"; }
        else if (line.charAt(0) === "#") { type = "heading"; value = line.substr(1); }
        else if (line.charAt(0) === "*") { type = "break"; }
        return { id: nextEntryId++, type: type, text: value, raw: line };
    });
}

//turn the model back into the text of a file
function serializeFeedback(){
    return feedbackModel.map(function(entry){ return entry.raw; }).join(fileEol);
}

//a freshly parsed file has nothing waiting to be saved
function loadFeedbackText(text, name){
    fileName = name || "feedback.txt";
    unsavedChanges = false;
    updateSaveButton();
    parseFeedback(text);
    renderFeedbackList();
}

//draw the checkbox list from the model (keeps ticked boxes ticked)
function renderFeedbackList(focusId){
    var checked = {};
    $('input[name="feedback"]:checked').each(function(){ checked[this.id] = true; });

    var $list = $("#checkboxList").empty();
    var openHeading = null;     //heading entry of the section we're currently inside

    function addCommentRow(heading){
        var inputId = "addInput" + heading.id;
        var $row = $("<li class='add-comment'></li>").attr("data-heading", heading.id);
        $row.append($("<button type='button' class='btn btn-link add-comment-toggle' aria-expanded='false'></button>")
            .text("+ Add a comment to this section")
            .attr("aria-label", "Add a comment to section " + heading.text.trim()));
        var $form = $("<form class='add-comment-form' hidden></form>");
        $form.append($("<label class='sr-only'></label>").attr("for", inputId).text("New comment for " + heading.text.trim()));
        $form.append($("<input type='text' class='form-control'>").attr({id: inputId, placeholder: "Type a new comment"}));
        $form.append("<button type='submit' class='btn btn-primary'>Add</button>");
        $form.append("<button type='button' class='btn btn-secondary add-comment-cancel'>Cancel</button>");
        $row.append($form);
        $list.append($row);
    }

    feedbackModel.forEach(function(entry){
        if (entry.type === "blank") { return; }                     //blank lines are ignored

        if (entry.type === "heading") {
            if (openHeading) { addCommentRow(openHeading); }        //close off the previous section
            openHeading = entry;
            $list.append($("<li></li>").append($("<h5 class='listSectionHeader'></h5>").text(entry.text)));
        }
        else if (entry.type === "break") {
            if (openHeading) { addCommentRow(openHeading); openHeading = null; }
            $list.append(checkboxRow(entry, "\n\n", $("<i></i>").text("Insert line break in feedback text")));
        }
        else {
            $list.append(checkboxRow(entry, entry.text + " ", document.createTextNode(entry.text)));
        }
    });
    if (openHeading) { addCommentRow(openHeading); }                //file ended inside a section

    function checkboxRow(entry, value, labelContent){
        var id = "check" + entry.id;
        var $li = $("<li></li>");
        $li.append($("<input type='checkbox' class='checkbox-larger alignCheck' name='feedback'>").attr("id", id).val(value).prop("checked", !!checked[id]));
        $li.append($("<label class='alignCheckLabel'></label>").attr("for", id).append(labelContent));
        return $li;
    }

    if (focusId) { $("#check" + focusId).focus(); }
}

//open the file with the File System Access API (keeps a handle so we can write back to it)
async function openWithPicker(){
    try {
        var handles = await window.showOpenFilePicker({
            multiple: false,
            types: [{ description: "Text files", accept: { "text/plain": [".txt"] } }]
        });
        var handle = handles[0];
        var file = await handle.getFile();
        var text = await file.text();
        fileHandle = handle;
        loadFeedbackText(text, file.name);
        flashStatus("#fadeFileText", "File read", false);
    } catch (e) {
        if (e && e.name === "AbortError") { return; }               //the user just closed the dialog
        flashStatus("#fadeFileText", "Error reading file", true);
    }
}

//read contents of file (browsers without the File System Access API)
function readFileContents(){

    document.getElementById('fileSelector').onchange = function(){
        var file = this.files[0];
        if (!file) { return; }
        var reader = new FileReader();
        reader.onload = function(){
            fileHandle = null;                                      //no way to write back, so saving is a download
            loadFeedbackText(this.result, file.name);
        };
        try{
            reader.readAsText(file);
            flashStatus("#fadeFileText", "File read", false);
        }
        catch(e){
            flashStatus("#fadeFileText", "Error reading file", true);
        }
    };

}

//make sure a typed comment is a single line that the file format will read back as a phrase
function cleanComment(text){
    text = text.replace(/[\r\n]+/g, " ").trim();
    text = text.replace(/^[#*\s]+/, "");                            //# and * at the start have special meaning in the file
    if (text && !/[.!?]$/.test(text)) { text += "."; }              //the instructions ask for each line to end in a full stop
    return text;
}

//insert a new phrase at the end of a section
function addCommentToSection(headingId, text){
    var h = -1;
    feedbackModel.some(function(entry, i){ if (entry.id === headingId) { h = i; return true; } return false; });
    if (h < 0) { return null; }
    var i = h + 1;
    while (i < feedbackModel.length && feedbackModel[i].type !== "heading" && feedbackModel[i].type !== "break") { i++; }
    while (i - 1 > h && feedbackModel[i - 1].type === "blank") { i--; }   //keep blank lines after the phrases
    var entry = { id: nextEntryId++, type: "phrase", text: text, raw: text };
    feedbackModel.splice(i, 0, entry);
    return entry;
}

function setupAddComments(){
    var $list = $("#checkboxList");

    $list.on("click", ".add-comment-toggle", function(){
        var $row = $(this).closest(".add-comment");
        $(this).attr("aria-expanded", "true").hide();
        $row.find(".add-comment-form").prop("hidden", false).find("input").focus();
    });

    function closeForm($row){
        $row.find(".add-comment-form").prop("hidden", true).find("input").val("");
        $row.find(".add-comment-toggle").attr("aria-expanded", "false").show().focus();
    }

    $list.on("click", ".add-comment-cancel", function(){ closeForm($(this).closest(".add-comment")); });
    $list.on("keydown", ".add-comment-form input", function(e){
        if (e.key === "Escape") { closeForm($(this).closest(".add-comment")); }
    });

    $list.on("submit", ".add-comment-form", async function(e){
        e.preventDefault();
        var $row = $(this).closest(".add-comment");
        var text = cleanComment($(this).find("input").val());
        if (!text) {
            flashStatus("#fadeListText", "Please type a comment first", true);
            $(this).find("input").focus();
            return;
        }
        var entry = addCommentToSection(parseInt($row.attr("data-heading"), 10), text);
        if (!entry) { flashStatus("#fadeListText", "Could not add comment", true); return; }
        unsavedChanges = true;
        renderFeedbackList(entry.id);
        await saveFeedbackFile(false);
    });
}

//write the model back to the file the user loaded.
//   with a file handle: overwrite that file.  Otherwise (or if that fails / forced) download the updated file.
async function saveFeedbackFile(forceDownload){
    var text = serializeFeedback();

    if (fileHandle && !forceDownload) {
        try {
            var opts = { mode: "readwrite" };
            if (fileHandle.queryPermission && (await fileHandle.queryPermission(opts)) !== "granted") {
                if ((await fileHandle.requestPermission(opts)) !== "granted") { throw new Error("permission denied"); }
            }
            var writable = await fileHandle.createWritable();
            await writable.write(text);
            await writable.close();
            unsavedChanges = false;
            updateSaveButton();
            flashStatus("#fadeListText", "Comment added and saved to " + fileName, false);
            return;
        } catch (e) {
            unsavedChanges = true;
            updateSaveButton(true);
            flashStatus("#fadeListText", "Comment added, but the file could not be saved. Use \"Save updated file\"", true);
            return;
        }
    }

    //no file handle (browser can't write back): wait until the user asks for the download
    if (!fileHandle && !forceDownload) {
        updateSaveButton();
        flashStatus("#fadeListText", "Comment added. Use \"Save updated file\" to keep it", false);
        return;
    }

    //download the updated file
    var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);

    unsavedChanges = false;
    updateSaveButton();
    flashStatus("#fadeListText", "Updated file downloaded", false);
}

//show the "Save updated file" button only when there is something that hasn't been written to a file
function updateSaveButton(show){
    $("#saveFile").prop("hidden", !(unsavedChanges && (show || !fileHandle)));
}

    //scroll to the top of the page- and scroll the phrase list back to its top too
    function scrollPage(){
        $("html, body").animate({
            scrollTop: 0
        }, 600);
        $("#checkboxList").animate({
            scrollTop: 0
        }, 600);
        return false;
    }

    //control fading text