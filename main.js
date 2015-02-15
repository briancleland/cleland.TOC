/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, brackets, $, window, Mustache */

define(function (require, exports, module) {
  'use strict';

  require("batch");

  var
    CommandManager = brackets.getModule("command/CommandManager"),
    EditorManager = brackets.getModule("editor/EditorManager"),
    DocumentManager = brackets.getModule("document/DocumentManager"),
    ProjectManager = brackets.getModule("project/ProjectManager"),
    PanelManager = brackets.getModule("view/PanelManager"),
    KeyBindingManager = brackets.getModule("command/KeyBindingManager"),
    ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
    Menus = brackets.getModule("command/Menus"),
    AppInit = brackets.getModule("utils/AppInit"),
    NativeApp = brackets.getModule("utils/NativeApp");

  var DO_TOC = "toc.run";
  var panelHtml = require("text!panel.html");
  var panel;


  var tocIcon = $("<a id='toc-toolbar-icon' class='fa fa-align-justify fa-lg' href='#'></a>")
    .appendTo($("#main-toolbar .buttons"));

  function paraSparkline(contents) {
    contents = contents.replace(/(^#.*)|(^`.*)/gm, ""); // remove headers and comments
    var paragraphs = contents.split("\n\n");
    var sparkline = "";
    paragraphs.forEach(function (paragraph) {
      var numWords = paragraph.split(/\s+/).length;
      if (numWords > 2) {
        var blockWidth = (numWords / 10);
        if (blockWidth < 2) {
          blockWidth = 2
        };
        var blockClass = "";
        var firstChar = paragraph.charAt(0);
        switch (firstChar) {
        case ">":
          blockClass = "quote";
          break;
        case "*":
          if (paragraph.charAt(1) == "*") {
            blockClass = "bold";
          } else {
            blockClass = "italic";
          }
          break;
        case "!":
          blockClass = "image";
          break;
        case "-":
          blockClass = "bullet";
          break;
        }
        sparkline += "<span class='" + blockClass + "' style='width:" + blockWidth + "px' ></span>";
      }
    });
    return sparkline;
  }

  function getTopicSentences(contents) {
    var topicSentences = [];
    var paragraphs = contents.split("\n");
    paragraphs.forEach(function (paragraph, index) {
      var sentence = paragraph.substr(0, paragraph.search(/\D\./) + 2);
      if (sentence != "") {
        if (sentence.length > 1) {
          topicSentences[index] = sentence;
        } else {
          if (sentence == "#") {
            topicSentences[index] = paragraph;
          }
        }
      }
    });
    return topicSentences;
  }

  function createTocDocument(allFiles) {
    var fileList = "";
    var mergedContent = "";
    var totalWords = 0;
    allFiles.sort(function (a, b) {
      return a.fileName.localeCompare(b.fileName)
    });
    allFiles.forEach(function (file) {
      var heading = file.fileName.replace(/\.md/g, "");
      if (file.fileName.charAt(2) == " ") {
        fileList += "<tr class='section-heading'>";
      } else {
        fileList += "<tr>";
      }
      fileList += "<td class='heading'>" + heading + "</td>";
      if (file.numWords != 0) {
        fileList += "<td class='numwords'>" + file.numWords + "</td>";
      } else {
        fileList += "<td class='numwords zerowords'>" + file.numWords + "</td>";
      }
      fileList += "<td class='sparkline'><span class='expected-length'></span>" + paraSparkline(file.fileContents) + "</td>";
      fileList += "</tr>";
      mergedContent += file.fileContents;
      totalWords += file.numWords;
    });
    var newContent = "<h3>TABLE OF CONTENTS</h3>";
    newContent += "<table>";
    newContent += fileList;
    newContent += "<td>TOTAL WORDS</td><td class='numwords'>" + totalWords + "</td>";
    newContent += "</table>";
    panel.show();
    $("#TOC").html(newContent);
  }

  function createSummaryDocument(allFiles) {
    var summary = "";
    allFiles.sort(function (a, b) {
      return a.fileName.localeCompare(b.fileName)
    });
    allFiles.forEach(function (file) {
      if (file.fileName.charAt(2) == " ") {
        summary += "<h1>" + file.fileName + "</h1>";
      } else {
        summary += "<h2>" + file.fileName + "</h2>";
      }
      summary += "<ul>";
      var topicSentences = getTopicSentences(file.fileContents);
      topicSentences.forEach(function (sentence) {
        summary += "<li>" + sentence + "</li>";
      });
      summary += "</ul>";
    });
    var summaryTitle = "<br><br><br><h3>SUMMARY OF CONTENTS</h3>";
    panel.show();
    $("#TOC").append(summaryTitle + summary);
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
              numWords: fileContents.replace(/(^#.*)|(^`.*)/gm, "").split(/\s+/).length - 1
            });
          });
        });
      }
    });
    var fileReadsBatch = new Batch(batchFunctions, function (allFiles) {
      createTocDocument(allFiles);
      createSummaryDocument(allFiles);
    });
    fileReadsBatch.execute();
  }


  function _handleFileToc() {
    if (panel.isVisible()) {
      panel.hide();
    } else {
      var editor = EditorManager.getCurrentFullEditor();
      var text = editor.document.getText();
      ProjectManager.getAllFiles().then(function (files) {
        readFiles(files);
      }, function (err) {
        console.log(err);
      });
    }
  }

  CommandManager.register("Project TOC", DO_TOC, _handleFileToc);

  AppInit.appReady(function () {
    KeyBindingManager.addBinding(DO_TOC, {
      key: "Alt-Cmd-t",
      displayKey: "Alt-Cmd-t"
    });
    var viewMenu = Menus.getMenu(Menus.AppMenuBar.VIEW_MENU);
    viewMenu.addMenuItem(DO_TOC);
    ExtensionUtils.loadStyleSheet(module, "css/TOC.css");
    ExtensionUtils.loadStyleSheet(module, "css/fa/css/font-awesome.css");
    panel = PanelManager.createBottomPanel(DO_TOC, $(panelHtml), 300);
    $("#toc-close-button").click(function () {
      panel.hide()
    });
    tocIcon.click(function(){
      _handleFileToc();
    });
  });


});