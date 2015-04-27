/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, brackets, $, window, Mustache */

define(function (require, exports, module) {
  'use strict';

  require("lib/batch");
  var _merge = require("lib/merge");

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

  function getHeadings(contents) {
    var headings = contents.match(/##[^\n]*?\n/g);
    if (headings) {
      for (var i = 0; i < headings.length; i++) {
        headings[i] = headings[i].replace(/##([^#]*)/, "<b>$1</b>");
        if (headings[i + 1] && headings[i + 1].indexOf("###") != -1) {
          headings[i] = headings[i] + " - " + headings[i + 1].replace(/###/, "");
          headings.splice(i + 1, 1);
        }
      }
    }
    return headings;
  }

  function createToc(allFiles) {
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
    $("#toc").html(newContent);
  }

  function createSummary(allFiles) {
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
      var headings = getHeadings(file.fileContents);
      if (headings) {
        headings.forEach(function (heading) {
          summary += "<li>" + heading + "</li>";
        });
      }
      summary += "</ul>";
    });
    $("#summary").html(summary);
  }

  
  function createNode(allFiles, sectionNumber) {
//    var thisNode = "";
//    // get subsections
//    allFiles.forEach(function (file) {
//      var  regex = RegExp.new("^" + sectionNumber + "\.\d");
//      if file.fileName.match(regex) {
//        thisNode += "[" + file.fileName + " | ";
//        var headings = getHeadings(file.fileContents);
//        if (headings) {
//          headings.forEach(function (heading) {
//            diagram += heading + " | ";
//          });
//        }
//       
//      } 
//      thisNode += 
//    }
  }
  
  function createDiagram(allFiles) {
    var diagram = "";
    allFiles.sort(function (a, b) {
      return a.fileName.localeCompare(b.fileName)
    });
    allFiles.forEach(function (file) {
      if (file.fileName.charAt(2) == " ") {
        diagram += "[" + file.fileName + " |<br>";
        var sectionNumber = file.fileName[0];
        allFiles.forEach(function (file2) {
          if (file2.fileName.charAt(2) != " " && file2.fileName[0] == sectionNumber) {
            diagram += file2.fileName + " | ";
          }
        });
        diagram += "]<br>";
        // iterate thru all files 
        // get files which match higher level heading
      } else {
//        diagram += "[" + file.fileName + "<br>";
      }
//      diagram += " | ";
//      var headings = getHeadings(file.fileContents);
//      if (headings) {
//        headings.forEach(function (heading) {
//          diagram += heading + " | ";
//        });
//      }
//      diagram += "]<br>";
    });
    $("#diagram").html(diagram);
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
      createToc(allFiles);
      createSummary(allFiles);
      createDiagram(allFiles);
    });
    fileReadsBatch.execute();
  }


  function _handleFileToc() {
    panel.show();
    var editor = EditorManager.getCurrentFullEditor();
    var text = editor.document.getText();
    ProjectManager.getAllFiles().then(function (files) {
      readFiles(files);
    }, function (err) {
      console.log(err);
    });
  }

  CommandManager.register("Project Overview", DO_TOC, _handleFileToc);

  AppInit.appReady(function () {
    KeyBindingManager.addBinding(DO_TOC, {
      key: "Alt-Cmd-t",
      displayKey: "Alt-Cmd-t"
    });
    var viewMenu = Menus.getMenu(Menus.AppMenuBar.VIEW_MENU);
    viewMenu.addMenuItem(DO_TOC);
    ExtensionUtils.loadStyleSheet(module, "css/overview.css");
    ExtensionUtils.loadStyleSheet(module, "css/fa/css/font-awesome.css");
    panel = PanelManager.createBottomPanel(DO_TOC, $(panelHtml), 300);
    $("#overview-panel-close").click(function () {
      panel.hide()
    });
    tocIcon.click(function () {
      _handleFileToc();
    });
    $("#overview-panel #show-toc").click(function () {
      _handleFileToc();
      $("#overview-panel #toc").show();
      $("#overview-panel #summary").hide();
      $("#overview-panel #diagram").hide();
    });
    $("#overview-panel #show-summary").click(function () {
      _handleFileToc();
      $("#overview-panel #toc").hide();
      $("#overview-panel #summary").show();
      $("#overview-panel #diagram").hide();
    });
    $("#overview-panel #show-diagram").click(function () {
      _handleFileToc();
      $("#overview-panel #toc").hide();
      $("#overview-panel #summary").hide();
      $("#overview-panel #diagram").show();
    });
    $("#overview-panel #merge-files").click(function () {
      _merge.mergeFiles();
    });
  });


});