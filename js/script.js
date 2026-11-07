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

    //modifiers, editing / deleting comments, word count
    setupModifiers();
    setupEditComments();
    setupAddSections();
    setupWordCount();

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
    var fullText = "";
    var $unresolved = $();

    $('input[name="feedback"]:checked').each(function() {
        var entry = this.getAttribute("data-entry") ? entryById(parseInt(this.getAttribute("data-entry"), 10)) : null;
        if (entry && entryHasModifiers(entry)) {
            var value = phraseValue(entry);
            if (value === null) {
                $unresolved = $unresolved.add($('select.modifier[data-entry="' + entry.id + '"]').filter(function(){ return this.value === ""; }));
            } else {
                fullText += value;
            }
        } else {
            fullText += this.value;
        }
    });

    //a ticked comment still has a choice to make (e.g. [excellent, good]): don't guess, point to it
    if ($unresolved.length) {
        $("select.modifier").removeClass("needs-choice").removeAttr("aria-invalid");
        $unresolved.addClass("needs-choice").attr("aria-invalid", "true");
        flashStatus("#fadeGenerateText", "Choose an option for the highlighted comment" + ($unresolved.length > 1 ? "s" : "") + " first", true);
        $unresolved.first().focus();
        return;
    }

    $("select.modifier").removeClass("needs-choice").removeAttr("aria-invalid");
    $('#feedbackText').val(fullText);
    updateWordCount();

    flashStatus("#fadeGenerateText", "Feedback generated", false);
}



//generate feedback error
function generateFeedbackError(){
    flashStatus("#fadeGenerateText", "Error generating feedback", true);
}

//clear the page and start again
function clearPage(){
    $('input[name="feedback"]').each(function() 
    { 
            this.checked = false; 
    }); 
    modChoice = {};
    $("select.modifier").val("").removeClass("needs-choice").removeAttr("aria-invalid");
    $('#feedbackText').val('');
    updateWordCount();
    scrollPage();
}


/*
    Word count
*/
function countWords(text){
    return text.trim().split(/\s+/).filter(Boolean).length;
}

function updateWordCount(){
    var n = countWords($("#feedbackText").val() || "");
    $("#wordCount").text(n + (n === 1 ? " word" : " words"));
}

function setupWordCount(){
    $("#feedbackText").on("input", updateWordCount);
    updateWordCount();
}


/*
    Modifiers.  A comment can hold choices such as  [excellent, very good, good]  (or [a|b, c|d] when an
    option needs a comma in it).  The file keeps the comment exactly as typed; the choice is made in the
    list and only the chosen word ends up in the feedback.  A bracket with fewer than two options (such as
    a [1] reference) is left as ordinary text.
*/
var modChoice = {};         //entry id -> chosen option index for each modifier in the comment (-1 = not chosen)

function parseModifiers(text){
    var parts = [], re = /\[([^\[\]]+)\]/g, last = 0, m;
    while ((m = re.exec(text)) !== null) {
        var opts = (m[1].indexOf("|") !== -1 ? m[1].split("|") : m[1].split(","))
            .map(function(o){ return o.trim(); })
            .filter(function(o){ return o !== ""; });
        if (opts.length < 2) { continue; }
        if (m.index > last) { parts.push({ text: text.slice(last, m.index) }); }
        parts.push({ options: opts });
        last = m.index + m[0].length;
    }
    if (last < text.length) { parts.push({ text: text.slice(last) }); }
    return parts;
}

function entryParts(entry){
    if (!entry.parts) { entry.parts = parseModifiers(entry.text); }
    return entry.parts;
}

function entryHasModifiers(entry){
    return entryParts(entry).some(function(p){ return p.options; });
}

function entryById(id){
    for (var i = 0; i < feedbackModel.length; i++) { if (feedbackModel[i].id === id) { return feedbackModel[i]; } }
    return null;
}

//the text of a comment with the chosen options filled in, or null if a choice is still to be made
function phraseValue(entry){
    var choices = modChoice[entry.id] || [], k = 0, out = "";
    var parts = entryParts(entry);
    for (var i = 0; i < parts.length; i++) {
        if (parts[i].options) {
            var c = choices[k++];
            if (c === undefined || c < 0 || c >= parts[i].options.length) { return null; }
            out += parts[i].options[c];
        } else {
            out += parts[i].text;
        }
    }
    return out + " ";
}

function setupModifiers(){
    $("#checkboxList").on("change", "select.modifier", function(){
        var id = parseInt(this.getAttribute("data-entry"), 10);
        var entry = entryById(id);
        if (!entry) { return; }
        var choices = [];
        $('select.modifier[data-entry="' + id + '"]').each(function(){
            choices.push(this.value === "" ? -1 : parseInt(this.value, 10));
        });
        modChoice[id] = choices;
        $(this).removeClass("needs-choice").removeAttr("aria-invalid");
        if (this.value !== "") { $("#check" + id).prop("checked", true); }     //choosing means you want it
    });
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
    modChoice = {};
    editingId = null;
    confirmDeleteId = null;
    parseFeedback(text);
    $("input[name=feedback]").prop("checked", false);
    renderFeedbackList();
    $(document).trigger("fb:file-loaded");
}

//draw the checkbox list from the model (keeps ticked boxes ticked).
//focus: an entry id (focus its checkbox) or a jQuery selector string
var editMode = false;
var editingId = null;           //entry being edited, if any
var confirmDeleteId = null;     //entry waiting for "delete?" confirmation, if any

function renderFeedbackList(focus){
    var checked = {};
    $('input[name="feedback"]:checked').each(function(){ checked[this.id] = true; });

    var $list = $("#checkboxList");
    var scrollTop = $list.scrollTop();
    $list.empty().toggleClass("edit-mode", editMode);
    var openHeading = null;     //heading entry of the section we're currently inside

    function addCommentRow(heading){
        var inputId = "addInput" + heading.id;
        var $row = $("<li class='add-comment'></li>").attr("data-heading", heading.id);
        $row.append($("<button type='button' class='btn btn-link add-comment-toggle' aria-expanded='false'></button>").attr("id", "addToggle" + heading.id)
            .text("+ Add a comment to this section")
            .attr("aria-label", "Add a comment to section " + heading.text.trim()));
        var $form = $("<form class='add-comment-form' hidden></form>");
        $form.append($("<label class='sr-only'></label>").attr("for", inputId).text("New comment for " + heading.text.trim()));
        $form.append($("<input type='text' class='form-control' spellcheck='true'>").attr({id: inputId, placeholder: "Type a new comment"}));
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
            $list.append($("<li></li>").append($("<h3 class='listSectionHeader'></h3>").text(entry.text)));
        }
        else if (entry.type === "break") {
            if (openHeading) { addCommentRow(openHeading); openHeading = null; }
            $list.append(checkboxRow(entry, "\n\n", $("<i></i>").text("Insert line break in feedback text")));
        }
        else if (editingId === entry.id) {
            $list.append(editRow(entry));
        }
        else {
            $list.append(phraseRow(entry));
        }
    });
    if (openHeading) { addCommentRow(openHeading); }                //file ended inside a section
    if (feedbackModel.some(function(e){ return e.type !== "blank"; })) { addSectionRow(); }

    function addSectionRow(){
        var $row = $("<li class='add-section'></li>");
        $row.append($("<button type='button' class='btn btn-link add-section-toggle' id='addSectionToggle' aria-expanded='false'></button>").text("+ Add a new section"));
        var $form = $("<form class='add-section-form' hidden></form>");
        $form.append($("<label class='sr-only' for='addSectionInput'></label>").text("Heading for the new section"));
        $form.append($("<input type='text' class='form-control' id='addSectionInput' spellcheck='true' placeholder='Type a section heading'>"));
        $form.append("<button type='submit' class='btn btn-primary'>Add section</button>");
        $form.append("<button type='button' class='btn btn-secondary add-section-cancel'>Cancel</button>");
        $row.append($form);
        $list.append($row);
    }

    function checkboxRow(entry, value, labelContent){
        var id = "check" + entry.id;
        var $li = $("<li></li>");
        $li.append($("<input type='checkbox' class='checkbox-larger alignCheck' name='feedback'>").attr("id", id).val(value).prop("checked", !!checked[id]));
        $li.append($("<label class='alignCheckLabel'></label>").attr("for", id).append(labelContent));
        return $li;
    }

    //a comment: plain text, or text with a drop-down wherever it has a [modifier]
    function phraseRow(entry){
        var id = "check" + entry.id;
        var parts = entryParts(entry);
        var $li = $("<li></li>");

        if (!entryHasModifiers(entry)) {
            $li = checkboxRow(entry, entry.text + " ", document.createTextNode(entry.text));
            $li.find("input").attr("data-entry", entry.id);
        } else {
            $li.addClass("has-modifier");
            var $box = $("<input type='checkbox' class='checkbox-larger alignCheck' name='feedback'>")
                .attr({id: id, "data-entry": entry.id}).val(entry.text + " ").prop("checked", !!checked[id]);
            var $text = $("<span class='alignCheckLabel phrase-text'></span>");
            var names = [], k = 0, choices = modChoice[entry.id] || [];
            parts.forEach(function(part, i){
                if (part.options) {
                    var selId = "mod" + entry.id + "-" + k;
                    var $sel = $("<select class='modifier'></select>")
                        .attr({id: selId, "data-entry": entry.id, "data-index": k,
                               "aria-label": "Choose one of: " + part.options.join(", ")});
                    $sel.append($("<option value=''></option>").text("choose…"));
                    part.options.forEach(function(o, j){ $sel.append($("<option></option>").val(j).text(o)); });
                    if (choices[k] !== undefined && choices[k] >= 0) { $sel.val(String(choices[k])); }
                    $text.append($sel);
                    names.push(selId);
                    k++;
                } else {
                    var lblId = "lbl" + entry.id + "-" + i;
                    $text.append($("<label></label>").attr({id: lblId, "for": id}).text(part.text));
                    names.push(lblId);
                }
            });
            $box.attr("aria-labelledby", names.join(" "));
            $li.append($box).append($text);
        }

        if (editMode) { $li.append(rowActions(entry)); }
        if (confirmDeleteId === entry.id) { $li.addClass("confirming").append(confirmBox(entry)); }
        return $li;
    }

    function short(entry){
        var t = entry.text.replace(/\s+/g, " ");
        return t.length > 50 ? t.slice(0, 50) + "…" : t;
    }

    function rowActions(entry){
        var $a = $("<span class='row-actions'></span>");
        $a.append($("<button type='button' class='btn btn-sm btn-outline-secondary edit-comment'></button>")
            .attr({id: "editBtn" + entry.id, "data-entry": entry.id, "aria-label": "Edit comment: " + short(entry)}).text("Edit"));
        $a.append($("<button type='button' class='btn btn-sm btn-outline-secondary delete-comment'></button>")
            .attr({id: "delBtn" + entry.id, "data-entry": entry.id, "aria-label": "Delete comment: " + short(entry)}).text("Delete"));
        return $a;
    }

    function confirmBox(entry){
        var $c = $("<div class='delete-confirm' role='group'></div>").attr("aria-label", "Confirm delete");
        $c.append($("<span></span>").text("Delete this comment?"));
        $c.append($("<button type='button' class='btn btn-sm btn-primary delete-yes'></button>").attr("data-entry", entry.id).text("Yes, delete"));
        $c.append($("<button type='button' class='btn btn-sm btn-secondary delete-no' id='deleteNo'></button>").attr("data-entry", entry.id).text("Cancel"));
        return $c;
    }

    function editRow(entry){
        var inputId = "editInput" + entry.id;
        var $li = $("<li class='edit-row'></li>");
        var $form = $("<form class='edit-comment-form'></form>").attr("data-entry", entry.id);
        $form.append($("<label class='sr-only'></label>").attr("for", inputId).text("Edit comment"));
        $form.append($("<input type='text' class='form-control' spellcheck='true'>").attr("id", inputId).val(entry.text));
        $form.append("<button type='submit' class='btn btn-primary'>Save</button>");
        $form.append("<button type='button' class='btn btn-secondary edit-cancel'>Cancel</button>");
        return $li.append($form);
    }

    $list.scrollTop(scrollTop);
    var showButton = feedbackModel.some(function(e){ return e.type === "phrase"; });
    $("#editModeToggle").prop("hidden", !showButton);

    if (typeof focus === "number") { $("#check" + focus).focus(); }
    else if (focus) { $(focus).focus(); }
    $(document).trigger("fb:list-rendered");
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

/*
    Editing and deleting comments.  "Edit comments" shows an Edit and a Delete button on every comment.
*/
function setupEditComments(){
    var $list = $("#checkboxList");

    $("#editModeToggle").on("click", function(){
        editMode = !editMode;
        editingId = null;
        confirmDeleteId = null;
        $(this).attr("aria-pressed", editMode ? "true" : "false");
        renderFeedbackList();
    });

    $list.on("click", ".edit-comment", function(){
        editingId = parseInt($(this).attr("data-entry"), 10);
        confirmDeleteId = null;
        renderFeedbackList("#editInput" + editingId);
    });

    function stopEditing(id){
        editingId = null;
        renderFeedbackList("#editBtn" + id);
    }

    $list.on("click", ".edit-cancel", function(){ stopEditing(editingId); });
    $list.on("keydown", ".edit-comment-form input", function(e){
        if (e.key === "Escape") { stopEditing(editingId); }
    });

    $list.on("submit", ".edit-comment-form", async function(e){
        e.preventDefault();
        var id = parseInt($(this).attr("data-entry"), 10);
        var entry = entryById(id);
        var text = cleanComment($(this).find("input").val());
        if (!entry) { return; }
        if (!text) {
            flashStatus("#fadeListText", "A comment can't be empty. Use Delete to remove it", true);
            $(this).find("input").focus();
            return;
        }
        if (text !== entry.text) {
            entry.text = text;
            entry.raw = text;
            entry.parts = null;
            delete modChoice[id];
            unsavedChanges = true;
            editingId = null;
            renderFeedbackList("#editBtn" + id);
            $(document).trigger("fb:comment-changed", [id, false]);
            await saveFeedbackFile(false, "updated");
        } else {
            stopEditing(id);
        }
    });

    $list.on("click", ".delete-comment", function(){
        confirmDeleteId = parseInt($(this).attr("data-entry"), 10);
        editingId = null;
        renderFeedbackList("#deleteNo");
    });

    $list.on("click", ".delete-no", function(){
        var id = confirmDeleteId;
        confirmDeleteId = null;
        renderFeedbackList("#delBtn" + id);
    });

    $list.on("click", ".delete-yes", async function(){
        var id = parseInt($(this).attr("data-entry"), 10);
        var at = -1;
        feedbackModel.forEach(function(en, i){ if (en.id === id) { at = i; } });
        if (at < 0) { return; }

        //work out where focus goes afterwards: the next comment's Edit button, else the previous one's
        var next = null, i;
        for (i = at + 1; i < feedbackModel.length && !next; i++) { if (feedbackModel[i].type === "phrase") { next = feedbackModel[i]; } }
        for (i = at - 1; i >= 0 && !next; i--) { if (feedbackModel[i].type === "phrase") { next = feedbackModel[i]; } }

        feedbackModel.splice(at, 1);
        delete modChoice[id];
        confirmDeleteId = null;
        unsavedChanges = true;
        renderFeedbackList(next ? "#editBtn" + next.id : "#editModeToggle");
        $(document).trigger("fb:comment-changed", [id, true]);
        await saveFeedbackFile(false, "deleted");
    });
}

//add an empty section (a heading and its closing *) at the end of the file
function cleanHeading(text){
    return text.replace(/[\r\n]+/g, " ").replace(/^[#*\s]+/, "").trim();
}

function addSectionToModel(title){
    var at = feedbackModel.length;
    while (at > 0 && feedbackModel[at - 1].type === "blank") { at--; }      //stay above any blank lines at the end of the file
    var heading = { id: nextEntryId++, type: "heading", text: title, raw: "#" + title };
    var items = [
        { id: nextEntryId++, type: "blank", text: "", raw: "" },
        heading,
        { id: nextEntryId++, type: "break", text: "*", raw: "*" }
    ];
    feedbackModel.splice.apply(feedbackModel, [at, 0].concat(items));
    return heading;
}

function setupAddSections(){
    var $list = $("#checkboxList");

    function closeForm($row){
        $row.find(".add-section-form").prop("hidden", true).find("input").val("");
        $row.find(".add-section-toggle").attr("aria-expanded", "false").show().focus();
    }

    $list.on("click", ".add-section-toggle", function(){
        $(this).attr("aria-expanded", "true").hide();
        $(this).closest(".add-section").find(".add-section-form").prop("hidden", false).find("input").focus();
    });
    $list.on("click", ".add-section-cancel", function(){ closeForm($(this).closest(".add-section")); });
    $list.on("keydown", ".add-section-form input", function(e){
        if (e.key === "Escape") { closeForm($(this).closest(".add-section")); }
    });

    $list.on("submit", ".add-section-form", async function(e){
        e.preventDefault();
        var title = cleanHeading($(this).find("input").val());
        if (!title) {
            flashStatus("#fadeListText", "Please type a section heading first", true);
            $(this).find("input").focus();
            return;
        }
        var heading = addSectionToModel(title);
        unsavedChanges = true;
        renderFeedbackList("#addToggle" + heading.id);                  //ready to add its first comment
        await saveFeedbackFile(false, "added", "Section");
    });
}

//write the model back to the file the user loaded.
//   with a file handle: overwrite that file.  Otherwise (or if that fails / forced) download the updated file.
async function saveFeedbackFile(forceDownload, what, noun){
    what = what || "added";
    noun = noun || "Comment";
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
            flashStatus("#fadeListText", noun + " " + what + " and saved to " + fileName, false);
            return;
        } catch (e) {
            unsavedChanges = true;
            updateSaveButton(true);
            flashStatus("#fadeListText", noun + " " + what + ", but the file could not be saved. Use \"Save updated file\"", true);
            return;
        }
    }

    //no file handle (browser can't write back): wait until the user asks for the download
    if (!fileHandle && !forceDownload) {
        updateSaveButton();
        flashStatus("#fadeListText", noun + " " + what + ". Use \"Save updated file\" to keep it", false);
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