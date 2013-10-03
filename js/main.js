function lambeth_map(elem) {
    this.types = []; //Array to hold all the possible 'layers' of data
    this.icons = [];
    this.point_layers = [];

    //import config
    this.outline_url    = jQuery(elem).attr('data-map-outline-url');
    this.url            = jQuery(elem).attr('data-map-url'); //URL for geoJSON
    this.fixed_layer_url= jQuery(elem).attr('data-map-fixed-layer-url');
    this.filterField    = jQuery(elem).attr('data-map-filter-on'); // Field used for dropdown/lookup
    this.zoom           = parseInt(jQuery(elem).attr('data-map-zoom')); //Map Zoom
    
    var centre          = jQuery(elem).attr('data-map-centre').split(','); //Map Centre
    this.lat            = parseFloat(centre[0]);
    this.lng            = parseFloat(centre[1]);

    this.postcode_search = jQuery(elem).attr('data-map-postcode-search');
    this.searchType      = jQuery(elem).attr('data-map-search-type');
    
    this.elem = elem; //The HTML element we inserting into
    this.drawMap(); //Init the map                           
}

lambeth_map.prototype.drawMap = function () {

    var maps_object = this;

    //add container for the map
    jQuery(this.elem).append("<div class='map_container'></div>");
    jQuery('.map_container', this.elem).append("<div class='leaflet_container'></div>");

    //do we need to render a control panel? 
    if(this.searchType || this.postcode_search === 'true') {

        //move the main map over 
        jQuery('.leaflet_container', this.elem).addClass("map_with_controls");

        //add control panel 
        var html = '<div class="controls_container"></div>';
        jQuery(".map_container", maps_object.elem).append(html);
    }

    if(this.postcode_search === 'true') {
        this.renderPostcodeLookup();
    }

    this.map = L.map(jQuery('.leaflet_container', this.elem)[0], {
        scrollWheelZoom: false
    }).setView([this.lat, this.lng], this.zoom);

    //using the cloudmade tiles
    L.tileLayer('http://{s}.tile.cloudmade.com/e7b61e61295a44a5b319ca0bd3150890/997/256/{z}/{x}/{y}.png').addTo(this.map);

    //show the boundry of lambeth
    this.renderOutline();
    //this.getJSON(this.url, this.discoverTypes);
    this.getJSON(this.url, this.discoverTypes);
    
    if(this.fixed_layer_url) {
        this.getJSON(this.fixed_layer_url, this.addFixedLayer);
    }
};

lambeth_map.prototype.testFunc = function (geoJsonObject) { 
    console.log('TEST FUNCTION');
    console.log(geoJsonObject);
} 

lambeth_map.prototype.getJSON = function (url, callback) {
    
    var maps_object = this;
    
    jQuery.getJSON(url + "?callback=?", function (geoJsonObject) {
    
        //remove any null features 
        //data.features.filter(function (e) {
            //return e
        //});

        callback.call(maps_object, geoJsonObject);
    });    
}

lambeth_map.prototype.renderOutline = function () {

    var maps_object = this;

    //style the outline - may want to customise this
    this.outline_style = {
        "color": "#004a86",
        fillColor: "#fff",
        weight: 3,
        opacity: 1,
        fillOpacity: 0.3
    };

    //draws the outline of lambeth
    jQuery.getJSON(this.outline_url, function (data) {
        maps_object.outline = data;
        L.geoJson(maps_object.outline, {
            style: maps_object.outline_style
        }).addTo(maps_object.map);
    });
}

lambeth_map.prototype.addFixedLayer = function(data) { 

    this.fixed_layer_data = data;
    
    var maps_object = this;

    //add new stuff
    this.fixed_layer = L.geoJson(this.fixed_layer_data, {
        onEachFeature: function (feature, leaflet_layer) {       
            
            var icon = L.icon({
                iconUrl: feature.properties.uri_rendered,
                iconSize: [39, 50],
                iconAnchor: [19, 25],
                popupAnchor: [0, -25]
            });
            
            if(feature.properties.uri_rendered) {
                leaflet_layer.setIcon(icon);
            }
            leaflet_layer.options.title = feature.properties.name;
            leaflet_layer.bindPopup(feature.properties.name);
        }
    }).addTo(this.map);
    
    //add this element to the key
    var html = '<div class="fixed_layer_key"><div>';
    
    jQuery('.controls_container', this.elem).append(html);
    
    
    var img_url = value.icon_url;
    var html = "<div class='key_item' >hi<img src='" + img_url + "' /><label for='checkbox_" + value.name + "'>" + value.name + "</label></div>";

    jQuery('.fixed_layer_key', maps_object.elem).append(html);
    
}

lambeth_map.prototype.discoverTypes = function (geoJsonObject) {

    
    //List every type of feature in the geo JSON
    var maps_object = this;
    this.data = geoJsonObject;
    
    jQuery.each(this.data.features, function (key, value) {

        //test - do we already have this in the output array ?
        var add_to_types_array = true;

        for(var i = 0; i < maps_object.types.length; i++) {

            if(value.properties[maps_object.filterField] == maps_object.types[i].name) {
                add_to_types_array = false;
            }
        }

        //if it wasn't found it the types array, add it in 
        if(add_to_types_array) {
            var type_name = value.properties[maps_object.filterField];
            if(type_name !== '' && type_name !== null) {

                //add new icon if one is available
                if(value.properties.uri_rendered) {

                    var custom_icon = L.icon({
                        iconUrl: value.properties.uri_rendered,
                        iconSize: [39, 50],
                        iconAnchor: [19, 25],
                        popupAnchor: [0, -25]
                    });

                    var icon_url = value.properties.uri_rendered;

                } else {
                    icon = null;
                    icon_url = null;
                }

                maps_object.types.push({
                    icon: custom_icon,
                    name: type_name,
                    icon_url: icon_url
                });
            }
        }
    });

    //order the types alphabetically 
    this.sortTypes();

    //add types to the data 
    this.addTypesToFeatuers();

    //render the right UX
    if(maps_object.searchType == 'drop-down') {
        maps_object.renderDropDown();
    } else if(maps_object.searchType == 'auto-suggest') {
        maps_object.renderAutoSuggest();
    } else if(maps_object.searchType == 'key') {
        maps_object.renderKey();

    }
}

lambeth_map.prototype.addTypesToFeatuers = function () {

    var maps_object = this;

    jQuery.each(this.data.features, function (key, value) {

        var type_index = null

        for(var i = 0; i < maps_object.types.length; i++) {
            if(value.properties[maps_object.filterField] == maps_object.types[i].name) {
                value.properties.type_id = i;
            }
        }
    });
}

lambeth_map.prototype.sortTypes = function () {
    this.types.sort(function (a, b) {
        var nameA = a.name.toLowerCase(),
        nameB = b.name.toLowerCase()
        if(nameA < nameB) {  //sort string ascending
            return -1
        }
        if(nameA > nameB) { 
            return 1
        }    
        return 0 //default return value (no sorting)
    });
}

lambeth_map.prototype.addLayer = function (type_id) {

    var maps_object = this;

    //add new stuff
    this.point_layers[type_id] = L.geoJson(this.data, {
        onEachFeature: function (feature, leaflet_layer) { //layer here refering to leaflets internal concept of layer        

            if(leaflet_layer.setIcon) {
                leaflet_layer.setIcon(maps_object.types[feature.properties.type_id].icon);
                leaflet_layer.options.title = feature.properties.name;
            }

            leaflet_layer.bindPopup(feature.properties.name);
        },
        filter: function (feature) {
            if(type_id === 'all') {
                return true;
            } else if(feature.properties.type_id == type_id) {
                return true;
            } else {
                return false;
            }
        }
    }).addTo(this.map);
}

lambeth_map.prototype.removeAllLayers = function () {

    var maps_object = this;

    jQuery.each(this.point_layers, function (key, val) {

        if(typeof val !== 'undefined') {
            maps_object.map.removeLayer(val);
        }
    });
}

lambeth_map.prototype.removeLayer = function (type_id) {
    this.map.removeLayer(this.point_layers[type_id]);
}

lambeth_map.prototype.renderDropDown = function () {

    var maps_object = this;

    //add the selector HTML
    var html = '<select  class="type_selector"></selector>';
    jQuery('.controls_container', this.elem).append(html);

    jQuery('.type_selector', this.elem).append("<option value='all'>Select options here</option>");

    jQuery.each(this.types, function (key, value) {
        jQuery('.type_selector', this.elem).append("<option value='" + key + "'>" + value.name + "</option>");
    });

    //ensure there are no events stuck on this element
    jQuery('.type_selector', this.elem).unbind();
    jQuery('.type_selector', this.elem).change(function () {
        maps_object.removeAllLayers();
        var key = jQuery(this).val();
        maps_object.addLayer(parseInt(key));
    });
}

lambeth_map.prototype.renderAutoSuggest = function () {

    var maps_object = this;

    var html = '<div class="autosuggest">Where can I get rid of... </span><input type="text" class="type_suggest" /></div>';

    jQuery('.controls_container', this.elem).append(html);

    jQuery('.type_suggest', this.elem).autocomplete({
        source: maps_object.types,
        change: function (event, ui) {
            layer_id = ui.item.key; //dunno if this will work 
            maps_object.addLayer(layer_id);
        },
        select: function (event, ui) {
            layer_id = ui.item.key; //dunno if this will work 
            maps_object.addLayer(layer_id);
        }
    });
}

lambeth_map.prototype.renderKey = function (options) {

    var maps_object = this;

    //add the selector HTML
    var html = '<div class="key"><div>';
    jQuery('.controls_container', this.elem).append(html);

    jQuery.each(this.types, function (key, value) {

        var img_url = value.icon_url;
        var html = "<div class='key_item' ><img src='" + img_url + "' /><label for='checkbox_" + value.name + "'>" + value.name + "</label><input id='checkbox_" + value.name + "' type='checkbox' value='" + key + "' /></div>";

        jQuery('.key', maps_object.elem).append(html);
    });

    //make the first set selected 
    if(this.types.length == 1) {
        maps_object.addLayer(0);
        jQuery('.key_item input:first').attr('checked', 'checked');
    }

    //ensure there are no events stuck on this element

    jQuery('.key_item input', this.elem).unbind();
    jQuery('.key_item input', this.elem).change(function () {
        var key = jQuery(this).val();
        
        if(jQuery(this).is(':checked')) {
            
            maps_object.addLayer(parseInt(key));
        } else {
            maps_object.removeLayer(parseInt(key));
        }
    });
}
lambeth_map.prototype.renderPostcodeLookup = function () {

    var maps_object = this;

    var html = '<div class="postcode_lookup"><p>Search by location: <input type="text" placeholder="postcode or address" class="postcode_input"  /><input type="button" class="postcode_submit" /></div>';

    jQuery('.controls_container', this.elem).append(html);

    lambeth_map.addPlaceholder();

    jQuery('.postcode_submit', this.elem).click(function () {
        var val = jQuery('.postcode_input', maps_object.elem).val();
        maps_object.postcodeLookup(val);
    });

    jQuery('.postcode_input', this.elem).keyup('enterKey', function (e) {
        if(e.keyCode === 13) {
            var val = jQuery('.postcode_input', maps_object.elem).val();
            maps_object.postcodeLookup(val);
        }
    });
};

lambeth_map.prototype.postcodeLookup = function (postcode) {

    var maps_object = this;

    //remove any current warnings
    jQuery('.warning', maps_object.elem).remove();

    //specific to brixton !! 
    address_array = postcode.split(' ');

    for(i = 0; i < address_array.length; i++) {
        //test if this is a brixton postcode with spaces missing
        if(address_array[i].length == 6 && (address_array[i].toUpperCase().substr(0, 3) == 'SW2' || address_array[i].toUpperCase().substr(0, 3) == 'SW9')) {
            address_array[i] = address_array[i].slice(0, 3) + " " + address_array[i].slice(3);
        }
    }

    jQuery('.postcode_lookup', maps_object.elem).append('<img src="/sites/all/modules/custom/lambeth_interactive_map/img/loading.gif" class="loading_gif" alt="loading" />');

    postcode = address_array.join(' ');
    postcode = encodeURIComponent(postcode);

    var url = 'http://nominatim.openstreetmap.org/search?format=json&q=' + postcode + '&bounded=1&boundingbox="51.417986,51.507918,-0.078743,-0.15216"&json_callback=?';

    //TODO: remove DOM interactions from this method 
    jQuery.getJSON(url, function (data) {

        jQuery('.loading_gif', maps_object.elem).remove();

        if(typeof data[0] === 'undefined') {
            jQuery('.postcode_lookup', maps_object.elem).append('<p style="display:none" class="warning">No results found</p>');
            jQuery('.warning', maps_object.elem).slideDown('slow').delay(5000).slideUp('slow', function () {
                jQuery('.warning', maps_object.elem).remove();
            });
        } else {
            jQuery('.warning', maps_object.elem).remove();
            maps_object.map.setView([data[0].lat, data[0].lon], 15);
            maps_object.hereIAmMarker(data[0].lat, data[0].lon);
        }
    });
};

lambeth_map.prototype.hereIAmMarker = function (lat, lon) {
    if(this.hereMarker) {
        this.map.removeLayer(this.hereMarker);
    } //remove icon if it's in the wrong place
    var hereIcon = new L.icon({
        iconUrl: '/sites/all/modules/custom/lambeth_interactive_map/img/here_i_am.png'
    });
    this.hereMarker = L.marker([lat, lon], {
        icon: hereIcon
    }).addTo(this.map);
};

//INITIALISE... 
jQuery(document).ready(function () {
    //Loop through all the maps elements and init a map
    lambeth_maps = [];
    jQuery('.lambeth_map').each(function (key, val) {
        lambeth_maps.push(new lambeth_map(val));
    });
});

//UTILITY FUNCTIONS 
lambeth_map.htmlDecode = function (input) {
    var e = document.createElement('div');
    e.innerHTML = input;
    return e.childNodes.length === 0 ? "" : e.childNodes[0].nodeValue;
}

lambeth_map.addPlaceholder = function () {
    if(typeof Modernizr === 'undefined') {

        jQuery('[placeholder]').focus(function () {
            var input = jQuery(this);
            if(input.val() == input.attr('placeholder')) {
                input.val('');
                input.removeClass('placeholder');
            }
        }).blur(function () {
            var input = jQuery(this);
            if(input.val() == '' || input.val() == input.attr('placeholder')) {
                input.addClass('placeholder');
                input.val(input.attr('placeholder'));
            }
        }).blur();
        jQuery('[placeholder]').parents('form').submit(function () {
            jQuery(this).find('[placeholder]').each(function () {
                var input = jQuery(this);
                if(input.val() == input.attr('placeholder')) {
                    input.val('');
                }
            })
        });
    }
}