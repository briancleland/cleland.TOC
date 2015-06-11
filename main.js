/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, brackets, $, window, Mustache */

define(function (require, exports, module) {
  'use strict';

  require("lib/batch");
  require("lib/jsrender.min");
  require("lib/naturalSort");
  var _merge = require("lib/merge");

  var
    CommandManager = brackets.getModule("command/CommandManager"),
    Commands = brackets.getModule("command/Commands"),
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
  var concatHtml = require("text!tpl/concat.html");
  var vizHtml = require("text!tpl/viz.html");
  var viz2Html = require("text!tpl/viz2.html");
  var nomlHtml = require("text!tpl/noml.html");
  var panel;

  var tocIcon = $("<a id='toc-toolbar-icon' class='fa fa-align-justify fa-lg' href='#'></a>")
    .appendTo($("#main-toolbar .buttons"));
  
  function parseFile(contents) {
    var data = [];
    var paragraphs = contents.split(/\n\s*\n/);
    paragraphs.forEach(function (paragraph) {
      var thisPara = {};
      paragraph = paragraph.replace(/^\s+|\s+$/g, '');
      var firstChar = paragraph.charAt(0);
      switch (firstChar) {
      case ">":
        thisPara.type = "quote";
        break;
      case "!":
        thisPara.type = "image";
        thisPara.url = paragraph.match(/\]\((.*)\)/)[1];
        break;
      case "-":
        thisPara.type = "bullet";
        break;
      default: 
        thisPara.type = "normal";
      }
      thisPara.words = paragraph.split(/\s+/).length;
      var parts = paragraph.split("\n");
      if (parts[0].charAt(0) == "#") {
        thisPara.head = parts.shift();
        thisPara.head = thisPara.head.replace(/#/g,"").trim();
        if (parts[0] && parts[0].charAt(0) == "#") { 
          thisPara.subhead = parts.shift(); 
        }
      };
      thisPara.body = parts.join("<br>");
      data.push(thisPara);
    });
    return data;
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
              fileName: fileName.replace(/\.md/g, ""),
              fileNumber: fileName.match(/^[\d\.]+/)[0],
              fileContents: fileContents,
              numWords: fileContents.replace(/(^#.*)|(^`.*)/gm, "").split(/\s+/).length - 1,
              fileData: parseFile(fileContents),
              filePath: file._path
            });
          });
        });
      }
    });
    var fileReadsBatch = new Batch(batchFunctions, function (allFiles) {
      allFiles.sort(naturalSort);
      summary(allFiles);
      concat(allFiles);
      viz(allFiles);
      viz2(allFiles);
      noml(allFiles);
    });
    fileReadsBatch.execute();
  }
    
  function summary(files) {
    $("#overview-panel").append(summaryHtml);
    $("#summary").html(
      $.templates("#summaryTemplate").render(files)
    );    
    $("#summary .file-name").click(function () {
      console.log(path);
      $("#summary .file-name").removeClass("selected");
      $(this).addClass("selected");
      var path = $(this).data("path");
      CommandManager.execute(Commands.CMD_ADD_TO_WORKINGSET_AND_OPEN, {
        fullPath: path
      });
    })  
  }
    
  function concat(files) {
    $("#overview-panel").append(concatHtml);
    $("#concat").html(
      $.templates("#concatTemplate").render(files)
    );    
  }

  function viz(files) {
    $("#overview-panel").append(vizHtml);
    var file, totalWords = 0;
    for (file of files) {
      totalWords += file.numWords;
    }
    console.log(files);
    $("#viz").html(
//      $.templates("#vizTemplate").render(files, true)
      $.templates("#vizTemplate").render([files], {totalWords: totalWords})
    );    
  }

  function viz2(files) {
    $("#overview-panel").append(viz2Html);
    $("#viz2").html(
      $.templates("#viz2Template").render(files, true)
    );    
  }

  function noml(files) {
    $("#overview-panel").append(nomlHtml);
    $("#noml").html(
      $.templates("#nomlTemplate").render(files, true)
    );    
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
    ExtensionUtils.loadStyleSheet(module, "css/viz.css");
    ExtensionUtils.loadStyleSheet(module, "css/matrix.css");
    ExtensionUtils.loadStyleSheet(module, "css/concat.css");
    ExtensionUtils.loadStyleSheet(module, "css/summary.css");
    ExtensionUtils.loadStyleSheet(module, "css/fa/css/font-awesome.css");
    panel = PanelManager.createBottomPanel(DO_TOC, $(panelHtml), 300);
    DocumentManager.on('documentSaved', updatePanel);
    $("#overview-panel-close").click(function () {
      panel.hide()
    });
    tocIcon.click(function () {
      _handleFileToc();
    });
    $("#overview-panel #show-diagram").click(function () {
      _handleFileToc();
      $("#overview-panel .section").hide();
      $("#overview-panel #diagram").show();
    });
    $("#overview-panel #show-summary").click(function () {
      _handleFileToc();
      $("#overview-panel .section").hide();
      $("#overview-panel #summary").show();
    });
    $("#overview-panel #show-concat").click(function () {
      _handleFileToc();
      $("#overview-panel .section").hide();
      $("#overview-panel #concat").show();
    });
    $("#overview-panel #show-viz").click(function () {
      _handleFileToc();
      $("#overview-panel .section").hide();
      $("#overview-panel #viz").show();
    });
    $("#overview-panel #show-viz2").click(function () {
      _handleFileToc();
      $("#overview-panel .section").hide();
      $("#overview-panel #viz2").show();
    });
    $("#overview-panel #show-noml").click(function () {
      _handleFileToc();
      $("#overview-panel .section").hide();
      $("#overview-panel #noml").show();
    });
    $("#overview-panel #merge-files").click(function () {
      _merge.mergeFiles();
    });
  });


});