/*
 * @include OpenLayers/Control.js
 * @include OpenLayers/Projection.js
 * @include OpenLayers/Protocol/HTTP.js
 * @include OpenLayers/Format/GeoJSON.js
 * @include OpenLayers/Handler/Click.js
 * @include OpenLayers/Layer/Vector.js
 * @include OpenLayers/Layer/WMS.js
 * @include OpenLayers/Layer/Bing.js
 * @include OpenLayers/Layer/SphericalMercator.js
 * @include GeoExt/data/FeatureStore.js
 * @include GeoExt/data/ProtocolProxy.js
 * @include GeoExt/widgets/grid/FeatureSelectionModel.js
 * @include GeoExt/widgets/Popup.js
 */

Ext.namespace("App");

App.SpatialQuery = OpenLayers.Class(OpenLayers.Control, {
    
    type: OpenLayers.Control.TYPE_TOOL,
    
    handlerOptions: {
        'single': true,
        'keyMask':OpenLayers.Handler.MOD_CTRL
    },

    limit: 30,

    store: null,

    gridPanel:null,

    popup:null,

    lonlat:null,
    
    initialize: function(options) {

        OpenLayers.Control.prototype.initialize.apply(this, arguments);


        this.store = new GeoExt.data.FeatureStore(
        {
            fields: [
            {
                name: 'fid',
                type: 'integer'
            },

            {
                name: 'title',
                type: 'string'
            },

            {
                name: 'links_count',
                type: 'integer'
            }

            ],
          proxy: new GeoExt.data.ProtocolProxy({
                protocol: new OpenLayers.Protocol.HTTP({
                    url: App.main.serviceURL ,
                    params: {
                        epsg: "900913",
                        attrs: "id,title,links_count",
                        order_by: "links_count",
                        dir: "desc",
                        limit: this.limit
                    },
                    format: new OpenLayers.Format.GeoJSON()
                })
            }),
            autoLoad:false
        } );

        this.gridPanel= new Ext.grid.GridPanel({
            store: this.store,
            id: "grid_panel",
            height:168,
            enableHdMenu: false,
            columns: [
            {
                header: "Title",
                width: 200,
                dataIndex: "title",
                id:"title"
            }, {
                header: "Links",
                width: 50,
                dataIndex: "links_count",
                id: "links_count"
            }],
            sm: new GeoExt.grid.FeatureSelectionModel({
                singleSelect:true,
                listeners:{
                    rowselect: function(sm,rowIndex,record){

                        App.main.clear();

                        var feature = record.data.feature;
                        feature.geometry.transform(new OpenLayers.Projection("EPSG:4326"),new OpenLayers.Projection("EPSG:900913"))

                        App.main.currentArticle = feature;
                        App.main.requestLinks(record.get("fid"));

                        this.popup.hide();
                        

                    },
                    scope: this
                }
            })

        });
    },

    draw: function(){

        this.handler = new OpenLayers.Handler.Click(
            this, 
            {"click": this.trigger},
            this.handlerOptions
        );
    },

    trigger: function(e) {
        
        if (App.main.avoidSpatialQuery){
            App.main.avoidSpatialQuery = false;
            return false;
        }

        this.lonlat = this.map.getLonLatFromViewPortPx(e.xy);

        this.store.removeAll();

        var factor = 100;
        var tolerance = Math.round(this.map.getScale() / factor);
        if (tolerance > 100000) tolerance = 100000;

        this.map.div.style.cursor = "wait";

        this.store.load({
            params:{
                lat:this.lonlat.lat,
                lon:this.lonlat.lon,
                tolerance: tolerance
                },
            callback: this.callback,
            scope: this
        })
    },

    callback: function(records,options,success){

        if(!this.popup){
        
            var box = {
                xtype: "box",
                id:"no_articles_found",
                style:{marginTop:"20px",marginLeft:"20px"},
                autoEl: {html: "No articles found near this point"}
            }

            this.popup = new GeoExt.Popup({
                items: [this.gridPanel,box],
                map: this.map,
                closeAction: 'hide',
                unpinnable: false,
                resizable:false,
                height: 200,
                width: 280
            });
        }

        if (records.length){
            this.popup.get("grid_panel").show();
            this.popup.get("no_articles_found").hide();
        } else {
            this.popup.get("grid_panel").hide();
            this.popup.get("no_articles_found").show();
        }

        this.popup.location = this.lonlat;
        this.popup.show();

        this.map.div.style.cursor = "default";

    },
    
    CLASS_NAME: "App.SpatialQuery"
});

