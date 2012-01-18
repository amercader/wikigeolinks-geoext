/*
 * @include App/layout.js
 * @include OpenLayers/Projection.js
 * @include OpenLayers/Format/GeoJSON.js
 * @include OpenLayers/Layer/Vector.js
 */

Ext.namespace("App");

App.main = (function() {

    /* Global settings 
     *
     * You will probably need to modify the articlesServiceURL variable to
     * point to your GeoJSON articles service or a proxy
     *
     * You probably don't need to worry about the OpenLayers paths.
     */

    articlesServiceURL = "proxy.php?url=http://localhost:5000/articles"

    OpenLayers.ImgPath = "lib/openlayers/img/";

    OpenLayers.ThemePath = "lib/openlayers/theme/default/style.css";


    Ext.QuickTips.init();


    var onLinkedArticlesReceived = function(request,zoom,repeat){

        var self = App.main;
        var layers = self.layers;
        
        var geojson = new OpenLayers.Format.GeoJSON({
            internalProjection: new OpenLayers.Projection("EPSG:900913"),
            externalProjection: new OpenLayers.Projection("EPSG:4326")
        });

        var features = geojson.read(request.responseText);

        var currentArticle = self.currentArticle;

        
        var articles = layers.articles;
        if (features && features.length){

            var linkedArticles = layers.linkedArticles;
            linkedArticles.destroyFeatures()

            var flines = [];
            var line;

            self.addArticle(currentArticle);                

            for (var i=0;i<features.length;i++){

                line = new OpenLayers.Feature.Vector(
                    new OpenLayers.Geometry.LineString(
                        [
                        new OpenLayers.Geometry.Point(currentArticle.geometry.x,currentArticle.geometry.y),
                        new OpenLayers.Geometry.Point(features[i].geometry.x,features[i].geometry.y)
                        ]
                        )
                    )
                features[i].linked_line = line;
                flines.push(line)
            }
            var linkedLines = layers.linkedLines;
            linkedLines.destroyFeatures()
            linkedLines.addFeatures(flines)

            linkedArticles.addFeatures(features);

            if (zoom){
                var extent =  linkedArticles.getDataExtent();
                if (!extent.contains(currentArticle.geometry.x,currentArticle.geometry.y)){
                    extent.extend(currentArticle.geometry)
                }
                self.map.zoomToExtent(extent);
            }

        } else {
            if (repeat){
                App.main.randomArticle(zoom);
            } else {
                alert("Sorry, no links for this article");
            }
        }
    }
    

    return {
        /*
         * Public methods
         */
        map:null,

        layers:{},

        serviceURL: articlesServiceURL,

        currentArticle: null,

        requestArticle: function(id,zoom,repeat){
            OpenLayers.Request.GET({
                url: App.main.serviceURL + "/" + id + ".json",
                callback: function(request){
                    var self = App.main;

                    var geojson = new OpenLayers.Format.GeoJSON({
                        internalProjection: new OpenLayers.Projection("EPSG:900913"),
                        externalProjection: new OpenLayers.Projection("EPSG:4326")
                    });
                    var features = geojson.read(request.responseText);

                    if (features) {
                        self.currentArticle = features[0];

                        self.requestLinks(id,zoom,repeat);
                    }
                }
            });
        },

        requestLinks: function(id,zoom,repeat){
            OpenLayers.Request.GET({
                url: App.main.serviceURL + "/" + id + "/linked",
                callback: function(request){
                    onLinkedArticlesReceived(request,zoom,repeat);
                    }
            });

        },

        randomArticle: function(zoom){
            App.main.clear();
            var id = Math.round(365000 - 365000 * Math.random());
            App.main.requestArticle(id,zoom,true);
        },

        addArticle: function(article){

            var self = App.main;
            var layers = self.layers;
            var articles = layers.articles;
            
            if (articles.features.length >= 1) {
            layers.lines.addFeatures([
                    new OpenLayers.Feature.Vector(
                        new OpenLayers.Geometry.LineString(
                            [
                            new OpenLayers.Geometry.Point(article.geometry.x,article.geometry.y),
                            new OpenLayers.Geometry.Point(articles.features[articles.features.length -1].geometry.x,articles.features[articles.features.length -1].geometry.y)
                            ]
                            )
                        )
                    ])
            }
            articles.addFeatures([article]);
        },

        clear: function(id){
            var self = App.main;

            if (id && self.layers[id]){
                self.layers[id].destroyFeatures();
            } else {
                for (var layer in self.layers){
                    if (self.layers[layer].features){
                        self.layers[layer].destroyFeatures();
                    }
                }
            }


        }
    }




})();

(function(){
    Ext.onReady(function() {
        App.layout.init()
    });
 })()
