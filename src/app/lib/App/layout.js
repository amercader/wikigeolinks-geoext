/*
 * @include OpenLayers/Map.js
 * @include OpenLayers/Projection.js
 * @include OpenLayers/Filter.js
 * @include OpenLayers/Rule.js
 * @include OpenLayers/StyleMap.js
 * @include OpenLayers/Renderer/SVG.js
 * @include OpenLayers/Renderer/VML.js
 * @include OpenLayers/Renderer/Canvas.js
 * @include OpenLayers/Protocol/HTTP.js
 * @include OpenLayers/Format/GeoJSON.js
 * @include OpenLayers/Control/Attribution.js
 * @include OpenLayers/Control/SelectFeature.js
 * @include OpenLayers/Control/Navigation.js
 * @include OpenLayers/Control/NavigationHistory.js
 * @include OpenLayers/Handler/Click.js
 * @include OpenLayers/Layer/Vector.js
 * @include OpenLayers/Layer/WMS.js
 * @include OpenLayers/Layer/Bing.js
 * @include OpenLayers/Layer/SphericalMercator.js
 * @include GeoExt/data/LayerStore.js
 * @include GeoExt/widgets/MapPanel.js
 * @include GeoExt/widgets/Action.js
 * @include GeoExt/widgets/ZoomSlider.js
 * @include GeoExt/widgets/Popup.js
 * @include GeoExt/widgets/tips/ZoomSliderTip.js
 * @include GeoExt/widgets/tree/LayerContainer.js
 * @include App/spatial_query.js
 */

Ext.namespace("App");


App.layout = (function() {
    /*
     * Private
     */

    var createMap = function() {
        return new OpenLayers.Map({
            projection: new OpenLayers.Projection("EPSG:900913"),
            displayProjection: new OpenLayers.Projection("EPSG:4326"),
            units: "m",
            numZoomLevels: 18,
            maxResolution: 156543.0339,
            maxExtent: new OpenLayers.Bounds(-20037508, -20037508, 20037508, 20037508.34),
            controls: [ new OpenLayers.Control.Attribution()],
            theme: OpenLayers.ThemePath
            });
    };

    var createLayers = function() {

        // We'll keep a reference to the most used layers
        var layers = App.main.layers;

        var styles = {
            "articles":{
                graphicWidth:20,
                graphicHeight:20,
                strokeColor: "black",
                externalGraphic:'app/img/icon_wiki.png',
                cursor: "pointer"
            },
            "lines":{
                strokeColor:"red",
                strokeWidth:2
            },
            "linkedArticles":{
                "default":OpenLayers.Util.applyDefaults(
                {
                    strokeColor:"black",
                    fillOpacity:1,
                    pointRadius: 4,
                    cursor: "pointer"
                },OpenLayers.Feature.Vector.style["default"]),
                "select":{
                    fillColor: "yellow",
                    strokeColor: "grey",
                    strokeWidth: 2

                }
            },
            "linkedLines":{
                "default":{
                    strokeColor:"gray",
                    strokeWidth:1
                },
                "select":{
                    strokeWidth:2
                }
            }
        }

        var defaultStyle = new OpenLayers.Style(styles.linkedArticles['default'])
        defaultStyle.addRules([
            new OpenLayers.Rule({
                filter: new OpenLayers.Filter.Comparison({
                    type: OpenLayers.Filter.Comparison.GREATER_THAN,
                    property: "links_count",
                    value: 0
                }),
                symbolizer: {
                    fillColor: "#00bb33"
                }
            }),
            new OpenLayers.Rule({
                filter: new OpenLayers.Filter.Comparison({
                    type: OpenLayers.Filter.Comparison.EQUAL_TO,
                    property: "links_count",
                    value: 0
                }),
                symbolizer: {
                    fillColor: "#ff6655"
                }
            })
            ]);

        var styleMap = new OpenLayers.StyleMap({
            "default" : defaultStyle,
            "select" : new OpenLayers.Style(styles.linkedArticles['select'])
        });

        // Points that show the articles linked to the selected article
        layers.linkedArticles = new OpenLayers.Layer.Vector("Linked Articles", {
            projection: new OpenLayers.Projection("EPSG:4326"),
            styleMap: styleMap
        });

        // Lines that link the selected article with the linked articles
        layers.linkedLines = new OpenLayers.Layer.Vector("Linked Lines", {
            projection: new OpenLayers.Projection("EPSG:4326"),
            styleMap: new OpenLayers.StyleMap(styles.linkedLines)
        })

        // Lines that link the selected article to the previously selected article
        layers.lines = new OpenLayers.Layer.Vector("Lines", {
            projection: new OpenLayers.Projection("EPSG:4326"),
            styleMap: new OpenLayers.StyleMap(new OpenLayers.Style(styles.lines))
        })

        // Selected articles
        layers.articles = new OpenLayers.Layer.Vector("Articles", {
            projection: new OpenLayers.Projection("EPSG:4326"),
            styleMap: new OpenLayers.StyleMap(new OpenLayers.Style(styles.articles))
        });

        layers.linkedArticles.events.register("featureselected",this,
            function(event){
                //console.log("on Feature selected");
                App.main.avoidSpatialQuery = true;

                App.main.currentArticle = event.feature.clone();

                //Request new links
                App.main.requestLinks(event.feature.fid);
            });

        layers.linkedArticles.events.register("featuresremoved",this,hidePopUp);
        
        layers.osm = new OpenLayers.Layer.OSM("OSM");
        layers.bing = new OpenLayers.Layer.Bing({
            key: "AjtIygmd5pYzN3AaY3l_wLlbM2rW5CxbFaLzjxksZptvovvMVAKFwmJ_NDSVcfQu",
            type: "Aerial"
        });

        return [
            layers.osm,
            layers.bing,
            layers.lines,
            layers.linkedLines,
            layers.articles,
            layers.linkedArticles
        ];
    };

    var showPopUp = function(event){
        if (!App.layout.popup){
            App.layout.popup = new GeoExt.Popup({
                map: event.object.map,
                width:200,
                closeAction: 'hide',
                maximizable: false,
                collapsible: false,
                unpinnable: false,
                closable: true,
                anchored: true,
                resizable: false


            });
        }

        var popup = App.layout.popup;

        if (popup.items) popup.removeAll();
        popup.add({
            xtype: "box",
            cls: "popup-link",
            autoEl: {
                html: "<img src=\"app/img/icon_wiki.png\" alt=\"Wikipedia article\" />" +
                        "<a href=\"http://en.wikipedia.org/wiki/" + formatLink(event.feature.attributes.title) +
                        "\" target=\"_blank\" title=\"Wikipedia article for '" + event.feature.attributes.title + "'\">"
                        + event.feature.attributes.title + "</a>"
            }
        });


        popup.doLayout();

        popup.location = event.feature.geometry.getBounds().getCenterLonLat();
        popup.show();

        if (event.feature.linked_line)
            select_lines_control.select(event.feature.linked_line);

    }

    var formatLink = function(string){
        return encodeURIComponent(string.replace(" ","_","g"));
    }

    var hidePopUp = function(event){
        var popup = App.layout.popup;
        if (popup) popup.hide()
        if (event.feature && event.feature.linked_line)
            select_lines_control.unselect(event.feature.linked_line);
    }


    var createLayerStore = function(map, layers) {
        return new GeoExt.data.LayerStore({
            map: map,
            layers: layers
        });
    };

    var createTbarItems = function(map) {
        var actions = [];
        actions.push(new GeoExt.Action({
            iconCls: "pan",
            map: map,
            pressed: true,
            toggleGroup: "tools",
            allowDepress: false,
            tooltip: "Navigate",
            control: new OpenLayers.Control.Navigation()
        }));
        actions.push(new GeoExt.Action({
            iconCls: "zoomin",
            map: map,
            toggleGroup: "tools",
            allowDepress: false,
            tooltip: "Zoom in",
            control: new OpenLayers.Control.ZoomBox({
                out: false
            })
        }));
        
        actions.push(new Ext.Action({
            iconCls: "maxextent",
            tooltip: "Zoom to Max Extent",
            handler: function() {
                var map = App.main.map;
                map.setCenter(map.maxExtent.getCenterLonLat());
                map.zoomTo(2);
            }
        }));

        var ctrl = new OpenLayers.Control.NavigationHistory();
        map.addControl(ctrl);
        actions.push(new GeoExt.Action({
            control: ctrl.previous,
            iconCls: "back",
            tooltip: "Previous Extent",
            disabled: true
        }));
        actions.push(new GeoExt.Action({
            control: ctrl.next,
            iconCls: "next",
            tooltip: "Next Extent",
            disabled: true
        }));

        // Separator
        actions.push("-");

        actions.push(new Ext.Action({
            text: "Clear",
            tooltip: "Clear articles and links",
            iconCls: "clear",
            handler: function() {
                App.main.clear();
            }
        }));
        
        actions.push("-");

        actions.push(new Ext.Action({
            text: "Map (OSM)",
            tooltip: "Switch to OSM background",
            iconCls: "bg_map",
            toggleGroup: "bg",
            pressed: true,
            handler: function() {
                App.main.map.setBaseLayer(App.main.layers.osm);
            }
        }));

        actions.push(new Ext.Action({
            text: "Satellite (Bing)",
            tooltip: "Switch to Bing background",
            iconCls: "bg_sat",
            toggleGroup: "bg",
            handler: function() {
                 App.main.map.setBaseLayer(App.main.layers.bing);
            }
        }));

        // Fill space to right
        actions.push("->");
       
        actions.push(new Ext.Action({
            text: "Random article",
            iconCls: "random",
            handler: function() {
                App.main.randomArticle(true);
            }
        }));

        actions.push("-");

        actions.push("Search georeferenced articles:");
        var search = createSearchBox();
        actions.push(search);

        actions.push("-");

        actions.push(new Ext.Action({
            text: "About / Help",
            iconCls: "help",
            handler: function() {
                App.layout.aboutWindow.show();
            }
        }));

        return actions;
    };

    var createSearchBox = function(){

        var ds = new GeoExt.data.FeatureStore({
            fields: [
                {name: 'fid', type: 'integer'},
                {name: 'title', type: 'string'},
                {name: 'links_count',type: 'integer'}
                ],
              proxy: new GeoExt.data.ProtocolProxy({
                    protocol: new OpenLayers.Protocol.HTTP({
                        url: App.main.serviceURL,
                        params: {
                            attrs: "id,title,links_count",
                            queryable: "title",
                            order_by: "links_count",
                            dir: "desc",
                            limit: 30

                        },
                        format: new OpenLayers.Format.GeoJSON()
                    })
                }),
                autoLoad:false
            } );

        var resultTpl = new Ext.XTemplate(
            '<tpl for="."><div class="search-item">',
            '<span class="search-item-title">{[this.f(values.title)]}</span><span class="search-item-links">({links_count})</span>',
            '</div></tpl>',
            {
                f: function(title){
                    var re = new RegExp(this.query,"gi");
                    return title.replace(re, function(m){
                            return "<span class='search-item-highlight'>" + m + "</span>"
                        });
                }
            }
        );

        var combo = new Ext.form.ComboBox({
            store: ds,
            displayField:'title',
            queryParam: 'title__ilike',
            typeAhead: false,
            loadingText: 'Searching...',
            width: 250,
            hideTrigger:true,
            tpl: resultTpl,
            itemSelector: 'div.search-item'
        });

        combo.on("beforequery",function(query){
            this.tpl.query = query.query;

            query.query = "%" + query.query + "%";
            return query;
        });

        combo.on("select",function(combo,record,index){

            App.main.clear();

            var feature = record.data.feature;
            feature.geometry.transform(new OpenLayers.Projection("EPSG:4326"),new OpenLayers.Projection("EPSG:900913"))

                App.main.currentArticle = feature;
            App.main.requestLinks(record.get("fid"),true);

        });
        

        return combo;
    }
    
    var select_lines_control;
    var aboutWindow;
    /*
     * Public
     */
    return {
        popup:null,
        aboutWindow:  new Ext.Window({
            applyTo:'about',
            layout:'fit',
            width:600,
            height:450,
            closeAction:'hide',
            items: new Ext.TabPanel({
                applyTo: 'about_content',
                deferredRender:false,
                activeTab: 0,
                autoTabs: true,
                border:false,
                defaults: {
                    autoScroll: true
                }
            }),

            buttons: [{
                text: 'Close',
                handler: function(){
                    App.layout.aboutWindow.hide();
                }
            }]
        }),

        init: function() {

            map = createMap();
            var layers = createLayers(map);
            var layerStore = createLayerStore(map, layers);

            map.addLayers(layers);

            var selectControls = [
            // Hover over articles and linked articles
            new OpenLayers.Control.SelectFeature(
                [App.main.layers.linkedArticles,App.main.layers.articles],
                {
                    hover: true,
                    highlightOnly:true,
                    multiple: false,
                    eventListeners: {
                        featurehighlighted: showPopUp,
                        featureunhighlighted: hidePopUp
                    }

                }
                ),
            // Click over linked articles
            new OpenLayers.Control.SelectFeature(
                App.main.layers.linkedArticles,
                {
                    hover: false,
                    multiple: false
                })
            ];

            for (var i = 0; i < selectControls.length; i++){
                map.addControl(selectControls[i]);
                selectControls[i].activate();
            }

            // Highlight linked lines
            select_lines_control = new OpenLayers.Control.SelectFeature(
                App.main.layers.linkedLines,
                {
                    hover: false,
                    multiple: false
                });
            map.addControl(select_lines_control);
            
            // Spatial Query
            var query = new App.SpatialQuery();
            map.addControl(query);
            query.activate()


            // create map panel
            var mapPanel = new GeoExt.MapPanel({
                region: "center",
                xtype: "gx_mappanel",
                id: "map",
                map: map,
                layers: layerStore,
                split: true,
                zoom: 2,
                items: [{
                    xtype: "gx_zoomslider",
                    aggressive: true,
                    vertical: true,
                    height: 100,
                    x: 10,
                    y: 20,
                    plugins: new GeoExt.ZoomSliderTip({
                        template: "Scale: 1 : {scale}<br>Resolution: {resolution}"
                    })
                }],
                tbar: createTbarItems(map)
            });

            new Ext.Viewport({
                layout: "border",
                items: [mapPanel]
            });

            this.aboutWindow.show(this);

            App.main.map = map;

        }

    };
})();
