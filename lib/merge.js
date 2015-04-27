define(function (require, exports, module) {
  'use strict';
  
  var
    CommandManager = brackets.getModule("command/CommandManager"),
    EditorManager = brackets.getModule("editor/EditorManager"),
    DocumentManager = brackets.getModule("document/DocumentManager"),
    ProjectManager = brackets.getModule("project/ProjectManager"),
    KeyBindingManager = brackets.getModule("command/KeyBindingManager"),
    ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
    Menus = brackets.getModule("command/Menus"),
    AppInit = brackets.getModule("utils/AppInit"),
    NativeApp = brackets.getModule("utils/NativeApp");

  //commands
  var DO_MERGE = "filemerge.run";

  function createMergedDocument(allFiles) {
    var fileList = "";
    var mergedContent = "";
    var doc = DocumentManager.createUntitledDocument("MergedContents", ".md");
    allFiles.sort(function (a, b) {
      return a.fileName.localeCompare(b.fileName)
    });
    allFiles.forEach(function(file) {
      fileList += file.fileName + " *" + file.numWords + "*\n";
      var contents = file.fileContents;
      contents = contents.replace(/(^#.*)|(^`.*)|(^\*\*.*)/gm,""); // remove headers and comments
      if (file.fileName.charAt(2) == " ") {
        mergedContent += "\n\n# "; 
      } else {
        mergedContent += "\n\n## ";
      }
      mergedContent += file.fileName.replace(/\.md/g,"") + "\n";
      mergedContent += contents;
    });
    mergedContent = mergedContent.replace(/\n\n+/g,"\n\n"); // remove excess newlines
    mergedContent = "**TABLE OF CONTENTS**\n" + fileList + "\n\n" + mergedContent;
    doc.setText(mergedContent); // add merged content to new document 
    DocumentManager.setCurrentDocument(doc); // switch to merged document
  }

  function readFiles(files) {
    var readRequest;
    var batchFunctions = [];
    $.each(files, function (index, file) {
      var path = file._path;
      var fileName = path.split("/").pop();
      var startsWithNumber = !isNaN(parseInt(fileName.charAt(0)));
      if (startsWithNumber) {
        batchFunctions.push(function (batch) {
          file.read(function (success, fileContents, stats) {
            batch.done({
              fileName: fileName,
              fileContents: fileContents,
              numWords: fileContents.split(/\s+/).length
            });
          });
        });
      }
    });
    var fileReadsBatch = new Batch(batchFunctions, function (results) {
      createMergedDocument(results);
    });
    fileReadsBatch.execute();
  }

  function mergeFiles() {
    var editor = EditorManager.getCurrentFullEditor();
    var text = editor.document.getText();
    ProjectManager.getAllFiles().then(function (files) {
      readFiles(files);
    }, function (err) {
      console.log(err);
    });
  }
  
  exports.mergeFiles = mergeFiles;

});