<!DOCTYPE HTML>
<html>
<head>
    <title>Galaxy of Instructables</title>
    <script type="text/javascript">
    paceOptions = {
        restartOnRequestAfter: false,
        ajax: true
    }
    </script>
    <script type="text/javascript" src="scripts/pace.min.js"></script>
    <link href="pace.bigcounter.css" rel="stylesheet" />

    <script type="text/javascript" src="scripts/head.load.min.js"></script>

    <link rel="stylesheet" type="text/css" href="bootstrap/css/bootstrap.min.css">
    <link rel="stylesheet" type="text/css" href="galaxy_styles.css">
    <link rel="stylesheet" type="text/css" href="scripts/onScreenKeyboard/onScreenKeyboard.css">
    <script type="x-shader/x-vertex" id="vertexshader">
        attribute float alpha;
        attribute float size;
        attribute vec3 ca;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
            vColor = ca;
            vAlpha = alpha;
            vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );

            gl_PointSize = size * (1.0+ 300.0 / length( mvPosition.xyz ) );
            gl_Position = projectionMatrix * mvPosition;
        }
    </script>

    <script type="x-shader/x-fragment" id="fragmentshader">
        uniform vec3 color;
        uniform sampler2D texture;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
            gl_FragColor = vec4( vColor, vAlpha );
            gl_FragColor = vAlpha * texture2D( texture, gl_PointCoord );
            //gl_FragColor = texture2D( texture, gl_PointCoord );
        }
    </script>
    <script type="text/template" id="template_toolbar"><!--jqfix-->
        <div id="toolbar" class="uiContainer">
            <!--<a href="#" id="backButton" class="toolbarButton left">back</a>-->
            <a href="#" id="searchButton" class="toolbarButton">search</a>
            <!--<a href="#" id="nextButton" class="toolbarButton right">next</a>-->
        </div>
    </script>
    <script type="text/template" id="template_searchType"><!--jqfix-->
        <div class="backdrop fade"></div>
        <div id="searchSelectionBox" class="uiContainer modalBox fade">
            <a href="#" id="searchByTitle" class="searchTypeButton">title</a>
            <a href="#" id="searchByAuthor" class="searchTypeButton">author</a>
            <a href="#" id="searchByCategory" class="searchTypeButton">category</a>
        </div>
    </script>
    <script type="text/template" id="template_categoryList"><!--jqfix-->
        <div class="backdrop fade"></div>
        <div class="uiContainer modalBox categoryList fade">
        </div>
    </script>
    <script type="text/html" id="template_textInputModal"><!--jqfix-->
        <div class="backdrop fade" style="top: 0px;"></div>
        <div class="uiContainer modalBox fade">
            <form id="searchForm">
                <div class="searchForm titleLine"></div>
			    <div class="searchForm promptLine"></div><input type="text" id="searchInput" class="osk-trigger" data-osk-options="disableSymbols">
            </form>
        </div>
    </script>
    <script type="text/template" id="template_project_description_title"><!--jqfix-->
        <img src="<%= square2Url %>" class='project-thumb' />
        <div class="project-title-box">
            <h4><%= title %></h4>
            <% if(window.TARGET === "web") { %>
            <a class="visitInstructable" href="http://www.instructables.com/id/<%= urlString %>" target="_blank">(visit link)</a> <br/>
            <% } else { %>
            <a class="emailInstructable" href="<%= id %>" urlString="<%= urlString %>">(email link)</a> <br/>
            <% } %>
            <a class="showCategory" href="<%= category %>"><%= categoryDisplay %></a> &gt; <a class="showChannel" href="<%= channel %>"><%= channelDisplay %></a> <br/>

            by <a class="showAuthor" href="<%= author.screenName %>"><%= author.screenName %></a></div>
    </script>
    <script type="text/template" id="template_project_description_content"><!--jqfix-->
        <div class="scrollable">
            <div class="slideshow">
                <%  _.each(steps,function(step){                                                    %>
                <%      _.each(step.files,function(file){                                           %>
                <%          if (file.image === true) {                                              %>
                              <img src='<%= file.mediumUrl %>' />
                <%          }                                                                       %>
                <%      });                                                                         %>
                <%  });                                                                             %>
            </div>
        <%= annotationText %>
        </div>
        <div class="btn-group btn-group-justified galaxy_button_bar">
            <a class="btn btn-default showRelations" href="<%= id %>">Related</a>
            <a class="btn btn-default showAuthor" href="<%= author.screenName %>">Author</a>
            <a class="btn btn-default showChannel" href="<%= channel %>"><%= channelDisplay %></a>
        </div>
    </script>
    <script type="text/template" id="template_project_tag_small">
        <div class="marker fade" id="tag_<%= id %>" cullings="0">
            <div class="title"><%= title %></div>
            <div class="centerer"></div>
            <img src="<%= squareUrl %>" class="coverImage" />
        </div>
    </script>
</head>
<!-- allow right-clicks only for debug mode -->
<?php
    if ($_GET["DEBUG"] == "true") {
        // debug allows context menu and cursor to show
        echo '<script>window.TARGET = "none";</script>';
        echo '<body> ';
    } else if ($_GET["TARGET"] == "web") {
        // web allows cursor but no context menu
        echo '<script>window.TARGET = "web";</script>';
        echo '<body> ';
    } else {
        // touch screen
        echo '<script>window.TARGET = "touch";</script>';
        echo '<body class="hiddenCursor" oncontextmenu="return false;"> ';
    }
?>
<div id="container"></div>
<canvas id="three-canvas" style="width: 100%; height: 100%;"></canvas>

    <script type="text/javascript">
    Pace.on('done', function(){Pace.off();});

    var scriptsList = [];
    <?php
        if ($_GET["DEBUG"] == "true") {
            echo 'scriptsList.push("/THREEJS/build/three.min.js");';
        } else {
            echo 'scriptsList.push("scripts/three.min.js");';
        }
    ?>

    scriptsList.push("https://www.youtube.com/iframe_api"); // iframe player, to support custom touch action for youtube vid's
    scriptsList.push("THREE-plugins/shaders/CopyShader.js");
    scriptsList.push("THREE-plugins/postprocessing/EffectComposer.js");
    scriptsList.push("THREE-plugins/postprocessing/RenderPass.js");
    scriptsList.push("THREE-plugins/postprocessing/ShaderPass.js");
    scriptsList.push("THREE-plugins/postprocessing/MaskPass.js");
    scriptsList.push("THREE-plugins/shaders/HorizontalBlurShader.js");
    scriptsList.push("THREE-plugins/shaders/VerticalBlurShader.js");
    scriptsList.push("THREE-plugins/shaders/CopyShader.js");
    scriptsList.push("THREE-plugins/shaders/BrightnessContrastShader.js");
    scriptsList.push("THREE-plugins/AdditiveBlendShader.js");

    scriptsList.push("scripts/TweenMax.min.js");
    scriptsList.push("scripts/kinetic-v4.5.4.min.js");
    scriptsList.push("scripts/tinyColor.js");
    scriptsList.push("scripts/jquery-1.11.0-beta3.js");
    scriptsList.push("scripts/jquery.overscroll.min.js");
    scriptsList.push("scripts/onScreenKeyboard/jquery.onScreenKeyboard.js");
    scriptsList.push("scripts/underscore-min.js");
    scriptsList.push("scripts/backbone-min.js");
    scriptsList.push("bootstrap/js/bootstrap.min.js");
    scriptsList.push("scripts/jquery.cycle2.min.js");

<?php
    $r = rand ( 0,999999 );
    $params = "";
    if ($_GET["DEBUG"] == "true") {
        $params = "?small=true&v=".$r;
    }
?>
    scriptsList.push("scripts/galaxy/galaxy_settings.js<?php echo $params; ?>");
    scriptsList.push("scripts/galaxy/galaxy_utils.js<?php echo $params; ?>");
    scriptsList.push("scripts/galaxy/kinetic_skyNode.js<?php echo $params; ?>");
    scriptsList.push("scripts/galaxy/galaxy_skyLayouter.js<?php echo $params; ?>");
    scriptsList.push("scripts/galaxy/galaxy_skymap.js<?php echo $params; ?>");
    scriptsList.push("scripts/galaxy/galaxy_cursor.js<?php echo $params; ?>");
    scriptsList.push("scripts/galaxy/galaxy_toolbar.js<?php echo $params; ?>");
    scriptsList.push("scripts/galaxy/galaxy_interactions.js<?php echo $params; ?>");
    scriptsList.push("scripts/galaxy/galaxy_cameraMotions.js<?php echo $params; ?>");
    scriptsList.push("scripts/galaxy/galaxy_projectTagManager.js<?php echo $params; ?>");
    scriptsList.push("scripts/galaxy/galaxy_constellationMaker3D.js<?php echo $params; ?>");

    <?php
        echo 'scriptsList.push("DATA/data.php'.$params.'");';
        echo 'scriptsList.push("scripts/galaxy/galaxy_main.js'.$params.'");';
        echo 'head.load(scriptsList);';
    ?>
    </script>

<!-- Main start script initializes both the webgl and canvas environments, including all the data preparation and necessaries -->

</body>

</html>