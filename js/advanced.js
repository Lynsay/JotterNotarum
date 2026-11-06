/*
    Desc: Extra options for the Advanced page.  Once feedback has been generated it can be exported as a Word
          (.docx) file on the user's own computer: one file per student, or appended to a single combined file.
          Student names can be typed, or picked from a class list loaded from a text file.

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
        zip.file("[Content_Types].xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
            '<Default Extension="xml" ContentType="application/xml"/>' +
            '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
            '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
            "</Types>");
        zip.file("_rels/.rels",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
            "</Relationships>");
        zip.file("word/_rels/document.xml.rels",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
            "</Relationships>");
        zip.file("word/styles.xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<w:styles xmlns:w="' + W_NS + '"><w:docDefaults><w:rPrDefault><w:rPr>' +
            '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-GB"/>' +
            '</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
            '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>');
        zip.file("word/document.xml",
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
        zip.file("word/document.xml", xml.slice(0, at) + entryXml(name, feedback, hasContent) + xml.slice(at));
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

    function studentName() {
        return $.trim($("#studentName").val()).replace(/\s+/g, " ");
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
                afterExport(name, "Saved " + handle.name);
            } else {
                download(blob, filename);
                exportMessage("Downloaded " + filename, false);
                afterExport(name, "Downloaded " + filename);
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
            exportMessage("Enter the student's name first", true);
            $("#studentName").focus();
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
            var done = "Added " + name + " to " + combined.name + " (" + combined.added + " this session)";
            exportMessage(done, false);
            afterExport(name, done);
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

    //read a class list: one name per line
    function parseClassList(text) {
        var seen = {}, names = [];
        text.replace(/^﻿/, "").split(/\r?\n/).forEach(function (line) {
            var name = $.trim(line).replace(/^"(.*)"$/, "$1").replace(/\s+/g, " ");
            if (name && !seen[name]) { seen[name] = true; names.push(name); }
        });
        return names;
    }

    function setClassList(names) {
        classList = names;
        var $list = $("#studentList").empty();
        names.forEach(function (name) { $list.append($("<option></option>").attr("value", name)); });
        $("#nextOption").prop("hidden", !names.length);
        if (!names.length) { $("#autoNext").prop("checked", false); }
    }

    function setupClassList() {
        $("#classListFile").on("change", async function () {
            var file = this.files[0];
            this.value = "";
            if (!file) { return; }
            try {
                var names = parseClassList(await file.text());
                if (!names.length) { throw new Error("empty"); }
                setClassList(names);
                if (!studentName()) { $("#studentName").val(names[0]); }
                flashStatus("#classListStatus", names.length + " student" + (names.length === 1 ? "" : "s") + " loaded", false);
            } catch (e) {
                flashStatus("#classListStatus", "Could not read any names from that file", true);
            }
        });
    }

    //after an export: if asked to, clear the page and move on to the next name in the class list
    function afterExport(name, doneMessage) {
        if (!$("#autoNext").prop("checked") || !classList.length) { return; }
        var i = classList.indexOf(name);
        var next = i >= 0 ? classList[i + 1] : undefined;
        clearPage();
        $("#studentName").val(next || "");
        flashStatus("#exportStatus", next ? doneMessage + ".  Next student: " + next
                                          : doneMessage + ".  That was the end of the class list", false);
    }

    /* ---------- wiring ---------- */

    $(function () {
        setupClassList();
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
