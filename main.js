/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, brackets, $, window, Mustache */

define(function (require, exports, module) {
  'use strict';

  require("lib/batch");
  require("lib/jsrender.min");
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
  var summaryHtml = require("text!tpl/summary.html");
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
  
  function parseFile(contents) {
    var data = [];
    var paragraphs = contents.split("\n\n");
    paragraphs.forEach(function (paragraph) {
      var thisPara = {};
      paragraph = paragraph.replace(/^\s+|\s+$/g, '');
      thisPara.words = paragraph.split(/\s+/).length;
      var parts = paragraph.split("\n");
      if (parts[0].charAt(0) == "#") { 
        thisPara.head = parts.shift(); 
        if (parts[0] && parts[0].charAt(0) == "#") { 
          thisPara.subhead = parts.shift(); 
        }
      };
      thisPara.body = parts.join("<br>");
      data.push(thisPara);
    });
    return data;
  } 

  function createToc(allFiles) {
    var fileList = "";
    var mergedContent = "";
    var totalWords = 0;
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
              numWords: fileContents.replace(/(^#.*)|(^`.*)/gm, "").split(/\s+/).length - 1,
              fileData: parseFile(fileContents)
            });
          });
        });
      }
    });
    var fileReadsBatch = new Batch(batchFunctions, function (allFiles) {
      allFiles.sort(function (a, b) {
        return a.fileName.localeCompare(b.fileName)
      });      
      createToc(allFiles);
      createSummary(allFiles);
      jsRender(allFiles);
    });
    fileReadsBatch.execute();
  }
    
  function jsRender(files) {
    $("#overview-panel").append(summaryHtml);
    var template = $.templates("#summaryTemplate");
    var content = template.render(files);
    $("#jsrender").html(content);    
    console.log(files);
  }

  function updatePanel() {
    ProjectManager.getAllFiles().then(function (files) {
      readFiles(files);
    }, function (err) {
      console.log(err);
    });
  }
  

  function _handleFileToc() {
    panel.show();
    updatePanel();
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
    DocumentManager.on('documentSaved', updatePanel);
    $("#overview-panel-close").click(function () {
      panel.hide()
    });
    tocIcon.click(function () {
      _handleFileToc();
    });
    $("#overview-panel #show-toc").click(function () {
      _handleFileToc();
      $("#overview-panel .section").hide();
      $("#overview-panel #toc").show();
    });
    $("#overview-panel #show-summary").click(function () {
      _handleFileToc();
      $("#overview-panel .section").hide();
      $("#overview-panel #summary").show();
    });
    $("#overview-panel #show-diagram").click(function () {
      _handleFileToc();
      $("#overview-panel .section").hide();
      $("#overview-panel #diagram").show();
    });
    $("#overview-panel #show-jsrender").click(function () {
      _handleFileToc();
      $("#overview-panel .section").hide();
      $("#overview-panel #jsrender").show();
    });
    $("#overview-panel #merge-files").click(function () {
      _merge.mergeFiles();
    });
  });


});