/*
    Desc: Extra options for the Advanced page.  Once feedback has been generated it can be exported as a Word
          (.docx) file on the user's own computer: one file per student, or appended to a single combined file.
          Student names come from a list loaded from a text file and shown in a small scrollable box.

          Everything happens in the browser: nothing is uploaded, and the class list is kept in memory only.
          Relies on script.js (flashStatus, clearPage, feedbackToPlainText) and on JSZip (js/jszip.min.js).

    Author: Lynsay A. Shepherd

    Date: November 2026
*/

(function () {
    "use strict";

    var DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    var W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

    var classList = [];                                     //student names, in the order they were loaded
    var combined = { handle: null, name: "", zip: null, added: 0 };     //the combined Word file (handle where the browser allows it, else held in memory)

    /* ---------- building Word XML ---------- */

    function xmlEscape(text) {
        return String(text)
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")     //characters XML can't hold
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    //one paragraph of feedback; single newlines become line breaks inside the paragraph
    function paragraphXml(text, pageBreakBefore) {
        var runs = text.split("\n").map(function (line) {
            return '<w:t xml:space="preserve">' + xmlEscape(line) + "</w:t>";
        }).join("<w:br/>");
        var props = pageBreakBefore ? "<w:pPr><w:pageBreakBefore/></w:pPr>" : "";
        return "<w:p>" + props + "<w:r>" + runs + "</w:r></w:p>";
    }

    //one student's entry: their name as a bold heading (shows in Word's navigation pane), then the feedback
    function entryXml(name, feedback, pageBreakBefore) {
        var xml = "";
        if (name) {
            xml += "<w:p><w:pPr><w:keepNext/>" + (pageBreakBefore ? "<w:pageBreakBefore/>" : "") +
                   '<w:spacing w:before="0" w:after="200"/><w:outlineLvl w:val="0"/></w:pPr>' +
                   '<w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t xml:space="preserve">' + xmlEscape(name) + "</w:t></w:r></w:p>";
        }
        feedbackToPlainText(feedback).split(/\n{2}/).forEach(function (paragraph, i) {
            xml += paragraphXml(paragraph, !name && i === 0 && pageBreakBefore);
        });
        return xml;
    }

    //a brand-new, minimal Word document (A4, Calibri 11)
    function newDocZip(bodyXml) {
        var zip = new JSZip();
        var add = function (path, data) { zip.file(path, data, { createFolders: false }); };   //no separate folder entries: Word is fussy about them
        add("[Content_Types].xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
            '<Default Extension="xml" ContentType="application/xml"/>' +
            '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
            '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
            "</Types>");
        add("_rels/.rels",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
            "</Relationships>");
        add("word/_rels/document.xml.rels",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
            "</Relationships>");
        add("word/styles.xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<w:styles xmlns:w="' + W_NS + '"><w:docDefaults><w:rPrDefault><w:rPr>' +
            '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-GB"/>' +
            '</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
            '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>');
        add("word/document.xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<w:document xmlns:w="' + W_NS + '"><w:body>' + (bodyXml || "") +
            '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>' +
            "</w:body></w:document>");
        return zip;
    }

    //add a student's entry to the end of an existing Word document (everything else in the file is left alone)
    async function appendEntry(zip, name, feedback) {
        var part = zip.file("word/document.xml");
        if (!part) { throw new Error("not-word"); }
        var xml = await part.async("string");
        var bodyStart = xml.indexOf("<w:body");
        var end = xml.lastIndexOf("</w:body>");
        if (bodyStart < 0 || end < 0) { throw new Error("not-word"); }
        bodyStart = xml.indexOf(">", bodyStart) + 1;

        //insert before the document's final section settings (or at the very end if there are none)
        var at = end;
        var sect = xml.lastIndexOf("<w:sectPr", end);
        if (sect >= 0 && xml.slice(sect, end).indexOf("</w:p>") < 0) { at = sect; }

        //start each student after the first on a new page (an empty document doesn't need a page break)
        var hasContent = /<w:t[\s>]|<w:tbl[\s>]|<w:drawing|<w:pict/.test(xml.slice(bodyStart, at));
        zip.file("word/document.xml", xml.slice(0, at) + entryXml(name, feedback, hasContent) + xml.slice(at), { createFolders: false });
        return zip;
    }

    function zipToBlob(zip) {
        return zip.generateAsync({ type: "blob", mimeType: DOCX_TYPE, compression: "DEFLATE" });
    }

    /* ---------- files on the user's computer ---------- */

    function download(blob, filename) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }

    async function ensureWritable(handle) {
        var opts = { mode: "readwrite" };
        if (handle.queryPermission && (await handle.queryPermission(opts)) !== "granted") {
            if ((await handle.requestPermission(opts)) !== "granted") { throw new Error("permission denied"); }
        }
    }

    async function writeHandle(handle, blob) {
        await ensureWritable(handle);
        var writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
    }

    function docxPickerTypes() {
        var accept = {};
        accept[DOCX_TYPE] = [".docx"];
        return [{ description: "Word document", accept: accept }];
    }

    function isAbort(e) { return e && e.name === "AbortError"; }

    function safeFileName(text) {
        return text.replace(/[\\\/:*?"<>|\u0000-\u001F]+/g, "").replace(/\s+/g, " ").trim().substring(0, 80);
    }

    /* ---------- reading the page ---------- */

    //the name selected in the student list ("" if no list has been loaded)
    function studentName() {
        return $("#studentBox input:checked").val() || "";
    }

    //the feedback to export, or null (after telling the user) if there isn't any yet
    function feedbackToExport() {
        var text = $("#feedbackText").val();
        if (!$.trim(text)) {
            exportMessage("Generate some feedback first", true);
            $("#generate").focus();
            return null;
        }
        return text;
    }

    function exportMessage(message, isError) {
        flashStatus("#exportStatus", message, isError);
    }

    /* ---------- one Word file for this student ---------- */

    async function exportIndividual() {
        var feedback = feedbackToExport();
        if (feedback === null) { return; }
        var name = studentName();
        var filename = (name ? "Feedback - " + safeFileName(name) : "Feedback") + ".docx";

        try {
            var blob = await zipToBlob(newDocZip(entryXml(name, feedback, false)));
            if (window.showSaveFilePicker) {
                var handle = await window.showSaveFilePicker({ suggestedName: filename, types: docxPickerTypes() });
                await writeHandle(handle, blob);
                exportMessage("Saved " + handle.name, false);
            } else {
                download(blob, filename);
                exportMessage("Downloaded " + filename, false);
            }
        } catch (e) {
            if (isAbort(e)) { return; }                     //the user closed the save dialog
            exportMessage("Could not save the Word file", true);
        }
    }

    /* ---------- one combined Word file ---------- */

    function showCombined() {
        $("#combinedName").text(combined.name ? "Combined file: " + combined.name : "No combined file chosen yet");
    }

    //pick a combined file that already exists
    async function chooseCombined() {
        if (!window.showOpenFilePicker) { $("#combinedFile").click(); return; }     //other browsers: see the change handler below
        try {
            var handles = await window.showOpenFilePicker({ multiple: false, types: docxPickerTypes() });
            var file = await handles[0].getFile();
            await JSZip.loadAsync(await file.arrayBuffer());                        //check it really is a .docx
            await ensureWritable(handles[0]);
            combined = { handle: handles[0], name: file.name, zip: null, added: 0 };
            showCombined();
            exportMessage("Combined file chosen", false);
        } catch (e) {
            if (isAbort(e)) { return; }
            exportMessage("That doesn't look like a Word (.docx) file", true);
        }
    }

    //start a new combined file
    async function newCombined() {
        if (!window.showSaveFilePicker) {
            combined = { handle: null, name: "Feedback.docx", zip: newDocZip(""), added: 0 };
            showCombined();
            exportMessage("New combined file started", false);
            return;
        }
        try {
            var handle = await window.showSaveFilePicker({ suggestedName: "Feedback.docx", types: docxPickerTypes() });
            combined = { handle: handle, name: handle.name, zip: null, added: 0 };
            showCombined();
            exportMessage("Combined file chosen", false);
        } catch (e) {
            if (isAbort(e)) { return; }
            exportMessage("Could not create the file", true);
        }
    }

    //browsers that can't write to an existing file: read the chosen .docx and keep it in memory
    function setupCombinedFallback() {
        $("#combinedFile").on("change", async function () {
            var file = this.files[0];
            this.value = "";
            if (!file) { return; }
            try {
                var zip = await JSZip.loadAsync(await file.arrayBuffer());
                if (!zip.file("word/document.xml")) { throw new Error("not-word"); }
                combined = { handle: null, name: file.name, zip: zip, added: 0 };
                showCombined();
                exportMessage("Combined file loaded", false);
            } catch (e) {
                exportMessage("That doesn't look like a Word (.docx) file", true);
            }
        });
    }

    async function addToCombined() {
        var feedback = feedbackToExport();
        if (feedback === null) { return; }
        var name = studentName();
        if (!name) {
            exportMessage("Load a student list and select a student first (Step 1)", true);
            return;
        }
        if (!combined.handle && !combined.zip) {
            exportMessage("Choose or start a combined file first", true);
            return;
        }

        try {
            var zip, blob;
            if (combined.handle) {
                //read the file again each time, so anything changed in it since is kept
                var file = await combined.handle.getFile();
                zip = file.size === 0 ? newDocZip("") : await JSZip.loadAsync(await file.arrayBuffer());
                await appendEntry(zip, name, feedback);
                blob = await zipToBlob(zip);
                await writeHandle(combined.handle, blob);
            } else {
                await appendEntry(combined.zip, name, feedback);
                blob = await zipToBlob(combined.zip);
                download(blob, combined.name);
            }
            combined.added++;
            exportMessage("Added " + name + " to " + combined.name + " (" + combined.added + " this session)", false);
        } catch (e) {
            if (e && e.message === "not-word") {
                exportMessage("That file doesn't look like a Word document I can add to", true);
            } else if (combined.handle) {
                exportMessage("Could not write to the file.  If it is open in Word, close it and try again", true);
            } else {
                exportMessage("Could not add to the Word file", true);
            }
        }
    }

    /* ---------- student names ---------- */

    //read a student list: one name per line
    function parseClassList(text) {
        var seen = {}, names = [];
        text.replace(/^﻿/, "").split(/\r?\n/).forEach(function (line) {
            var name = $.trim(line).replace(/^"(.*)"$/, "$1").replace(/\s+/g, " ");
            if (name && !seen[name]) { seen[name] = true; names.push(name); }
        });
        return names;
    }

    //problems in the contents of a class list.  A comments file chosen by mistake is the likely one.
    function classListProblem(text) {
        if (looksBinary(text)) { return "That doesn't look like a plain text file"; }
        var lines = nonBlankLines(text);
        if (!lines.length) { return "That file is empty"; }
        var marked = lines.filter(function (l) { return l.charAt(0) === "#" || l.charAt(0) === "*"; }).length;
        var sentences = lines.filter(function (l) { return /[.!?]\s*$/.test(l) && l.split(/\s+/).length > 6; }).length;
        var long = lines.filter(function (l) { return l.length > 100; }).length;
        if (marked > 0 || sentences > lines.length / 4 || long > 0) {
            return "That looks like a feedback comments file, not a class list. Use it in Step 2 instead";
        }
        if (!parseClassList(text).length) { return "Could not read any names from that file"; }
        return "";
    }

    //show the selected student's name in the export section
    function showSelectedStudent() {
        $(".selected-student").text(studentName() || "none selected");
    }

    //keep the selected row inside the 5-row scrolling box
    function scrollToSelected() {
        var box = document.getElementById("studentBox");
        var input = box.querySelector("input:checked");
        if (!input) { return; }
        var row = input.parentNode;
        if (row.offsetTop < box.scrollTop) { box.scrollTop = row.offsetTop; }
        else if (row.offsetTop + row.offsetHeight > box.scrollTop + box.clientHeight) {
            box.scrollTop = row.offsetTop + row.offsetHeight - box.clientHeight;
        }
    }

    function selectStudent(input) {
        input.checked = true;
        showSelectedStudent();
        scrollToSelected();
    }

    //draw the list as a group of radio buttons (native keyboard use: arrow keys move through the names)
    function setClassList(names) {
        classList = names;
        var $box = $("#studentBox").empty();
        names.forEach(function (name) {
            var $label = $("<label class='student-row'></label>");
            $label.append($("<input type='radio' name='student' class='sr-only-input'>").val(name));
            $label.append($("<span></span>").text(name));
            $box.append($label);
        });
        $("#nextOption").prop("hidden", !names.length);
        var previous = currentStudent;
        if (names.length) { selectStudent($box.find("input")[0]); }
        showSelectedStudent();

        //first list: whatever is on the page already belongs to the first student.  Later lists: keep the
        //previous student's work as a draft and show the new first student's.
        if (previous) { storeDraft(previous); }
        currentStudent = studentName();
        if (previous) { applyDraft(currentStudent); }
        refreshBadges();
        refreshSteps();
    }

    function setupClassList() {
        $("#classListFile").on("change", async function () {
            var file = this.files[0];
            this.value = "";
            if (!file) { return; }
            var problem = fileProblem(file);
            var text = "";
            if (!problem) {
                try { text = await file.text(); } catch (e) { problem = "Error reading file"; }
            }
            if (!problem) { problem = classListProblem(text); }
            if (problem) { flashStatus("#classListStatus", problem, true); return; }

            var names = parseClassList(text);
            setClassList(names);
            flashStatus("#classListStatus", names.length + " student" + (names.length === 1 ? "" : "s") + " loaded", false);
        });

        $("#studentBox").on("change", "input", function () {
            showSelectedStudent();
            scrollToSelected();
            switchStudent();
        });
    }

    //"Clear feedback" (handled by script.js) also moves on to the next student, if the box is ticked
    function setupClearNext() {
        $("#clearFeedback").on("click", function () {
            delete drafts[currentStudent];                          //cleared on purpose, so there is no draft to keep
            if (!$("#autoNext").prop("checked") || !classList.length) { refreshBadges(); refreshSteps(); return; }
            var inputs = $("#studentBox input").toArray();
            var i = inputs.findIndex(function (el) { return el.checked; });
            if (i >= 0 && i + 1 < inputs.length) {
                selectStudent(inputs[i + 1]);
                currentStudent = studentName();
                applyDraft(currentStudent);                         //the next student may already have a draft
                flashStatus("#classListStatus", "Next student: " + inputs[i + 1].value, false);
            } else if (i >= 0) {
                flashStatus("#classListStatus", "That was the last student in your list", false);
            }
            refreshBadges();
            refreshSteps();
        });
    }

    /* ---------- steps in order ----------
       Step 2 opens once there is a student list, step 3 once there are comments, step 4 once something is
       ticked (or text is already there), and step 5 once there is feedback.  A locked step says why, in words,
       and its controls cannot be reached until the step before it is done. */
    var STEP_RULES = {
        2: { note: "Locked until you load your student list in Step 1.",
             open: function () { return classList.length > 0; } },
        3: { note: "Locked until you load your feedback comments file in Step 2.",
             open: function () { return feedbackModel.some(function (e) { return e.type === "phrase"; }); } },
        4: { note: "Locked until you tick at least one feedback phrase in Step 3.",
             open: function () { return $('input[name="feedback"][data-entry]:checked').length > 0 || $.trim($("#feedbackText").val()) !== ""; } },
        5: { note: "Locked until feedback has been generated in Step 4.",
             open: function () { return $.trim($("#feedbackText").val()) !== ""; } }
    };

    function prepareSteps() {
        $(".instructionHeader").each(function () {
            var $h = $(this);
            var n = parseInt($h.find(".step-badge").text(), 10);
            var $card = $h.closest(".roundedCornerDiv").addClass("step-card").attr("data-step", n);
            $h.attr("tabindex", "-1");                              //so focus can be put here when a step locks
            if (STEP_RULES[n]) {
                $h.nextAll().wrapAll("<div class='step-body'></div>");
                $("<p class='step-locked-note' hidden></p>").text(STEP_RULES[n].note).insertAfter($h);
            }
        });
    }

    function refreshSteps() {
        var locked = {};
        Object.keys(STEP_RULES).forEach(function (n) { locked[n] = !STEP_RULES[n].open(); });

        $(".step-card").each(function () {
            var n = parseInt($(this).attr("data-step"), 10);
            if (!STEP_RULES[n]) { return; }
            var $card = $(this);
            if (locked[n] && !$card.hasClass("locked") && $.contains(this, document.activeElement)) {
                //the focused control is about to become unreachable: move focus to the nearest earlier step that is open
                var k = n - 1;
                while (k > 1 && locked[k]) { k--; }
                $('.step-card[data-step="' + k + '"] .instructionHeader').focus();
            }
            $card.toggleClass("locked", locked[n]);
            $card.find(".step-body").first().prop("inert", locked[n]);
            $card.find(".step-locked-note").first().prop("hidden", !locked[n]);
        });
    }

    /* ---------- drafts ----------
       Unfinished feedback is kept for each student while the page is open, so you can move between
       students without losing anything.  It lives in memory only: it is never saved or sent anywhere,
       and it is gone when the page is closed. */
    var drafts = {};            //student name -> { text, checked: {checkbox id: true}, choices: {entry id: [..]} }
    var currentStudent = "";    //the student whose feedback is on the page right now

    function captureState() {
        var checked = {}, any = false;
        $('input[name="feedback"]:checked').each(function () { checked[this.id] = true; any = true; });
        return {
            text: $("#feedbackText").val() || "",
            checked: checked,
            choices: JSON.parse(JSON.stringify(modChoice)),
            any: any
        };
    }

    function stateIsEmpty(st) { return !st.any && !st.text.trim(); }

    function storeDraft(name) {
        if (!name) { return; }
        var st = captureState();
        if (stateIsEmpty(st)) { delete drafts[name]; } else { drafts[name] = st; }
    }

    //put a student's draft (or a blank page) on the screen
    function applyDraft(name) {
        var d = drafts[name];
        $('input[name="feedback"]').prop("checked", false);
        modChoice = d ? JSON.parse(JSON.stringify(d.choices)) : {};
        if (d) {
            Object.keys(d.checked).forEach(function (id) { $("#" + id).prop("checked", true); });
        }
        if (feedbackModel.length) { renderFeedbackList(); }         //redraws the drop-downs from the saved choices
        $("#feedbackText").val(d ? d.text : "");
        updateWordCount();
        refreshSteps();
    }

    //a "draft" label (words, not just colour) next to each student with unfinished feedback
    function refreshBadges() {
        $("#studentBox .student-row").each(function () {
            var $row = $(this);
            var name = $row.find("input").val();
            var has = !!drafts[name] || (name === currentStudent && !stateIsEmpty(captureState()));
            $row.find(".draft-badge").remove();
            if (has) { $row.find("span").first().append($("<em class='draft-badge'></em>").text("draft")); }
        });
    }

    function hasUnfinished() {
        return Object.keys(drafts).length > 0 || (classList.length > 0 && !stateIsEmpty(captureState()));
    }

    function switchStudent() {
        storeDraft(currentStudent);                                 //the page still shows the previous student
        currentStudent = studentName();
        applyDraft(currentStudent);
        refreshBadges();
    }

    function setupDrafts() {
        $("#checkboxList").on("change", function () { refreshBadges(); refreshSteps(); });
        $("#feedbackText").on("input", function () { refreshBadges(); refreshSteps(); });
        $("#generate").on("click", function () { setTimeout(function () { refreshBadges(); refreshSteps(); }, 0); });
        $(document).on("fb:list-rendered fb:file-loaded", refreshSteps);

        //a new comments file means new checkboxes: keep the written feedback, drop old ticks and choices
        $(document).on("fb:file-loaded", function () {
            Object.keys(drafts).forEach(function (n) {
                drafts[n].checked = {};
                drafts[n].choices = {};
                drafts[n].any = false;
                if (!drafts[n].text.trim()) { delete drafts[n]; }
            });
            refreshBadges();
        });

        //an edited or deleted comment: forget choices made for its old wording in the other drafts
        $(document).on("fb:comment-changed", function (e, id, deleted) {
            Object.keys(drafts).forEach(function (n) {
                delete drafts[n].choices[id];
                if (deleted) { delete drafts[n].checked["check" + id]; }
            });
        });

        window.addEventListener("beforeunload", function (e) {
            if (hasUnfinished()) { e.preventDefault(); e.returnValue = ""; }
        });
    }

    /* ---------- wiring ---------- */

    $(function () {
        setupClassList();
        setupClearNext();
        prepareSteps();
        setupDrafts();
        refreshSteps();
        setupCombinedFallback();
        showCombined();

        $("#exportIndividual").on("click", exportIndividual);
        $("#chooseCombined").on("click", chooseCombined);
        $("#newCombined").on("click", newCombined);
        $("#addCombined").on("click", addToCombined);

        if (!window.showOpenFilePicker) {
            $("#combinedNote").prop("hidden", false);
        }
    });
})();
